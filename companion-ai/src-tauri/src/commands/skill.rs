use crate::db::Database;
use crate::skill::parser::{generate_system_prompt, parse_skill_meta};
use crate::skill::Skill;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Deserialize)]
pub struct UploadSkillRequest {
    pub dir_path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct SkillResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_active: bool,
    pub system_prompt: String,
}

#[tauri::command]
pub async fn upload_skill(
    request: UploadSkillRequest,
    db: State<'_, Arc<Database>>,
) -> Result<SkillResponse, String> {
    let meta = parse_skill_meta(&request.content).map_err(|e| e.to_string())?;

    if meta.id.is_empty() {
        return Err("Skill must have an 'id' field".to_string());
    }

    let system_prompt = generate_system_prompt(&meta, &request.content);
    let meta_json = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Upsert skill
    conn.execute(
        "INSERT OR REPLACE INTO skills (id, dir_path, name, description, meta_json, raw_content, system_prompt, is_active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)",
        rusqlite::params![
            meta.id,
            request.dir_path,
            meta.name,
            meta.description,
            meta_json,
            request.content,
            system_prompt,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(SkillResponse {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        is_active: true,
        system_prompt,
    })
}

#[tauri::command]
pub async fn list_skills(db: State<'_, Arc<Database>>) -> Result<Vec<SkillResponse>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, is_active, system_prompt FROM skills ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let skills = stmt
        .query_map([], |row| {
            Ok(SkillResponse {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i32>(3)? == 1,
                system_prompt: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(skills)
}

#[tauri::command]
pub async fn toggle_skill(
    skill_id: String,
    is_active: bool,
    db: State<'_, Arc<Database>>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE skills SET is_active = ?1 WHERE id = ?2",
        rusqlite::params![is_active as i32, skill_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_skill(
    skill_id: String,
    db: State<'_, Arc<Database>>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![skill_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_active_skills(db: State<'_, Arc<Database>>) -> Result<Vec<SkillResponse>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, is_active, system_prompt FROM skills WHERE is_active = 1")
        .map_err(|e| e.to_string())?;

    let skills = stmt
        .query_map([], |row| {
            Ok(SkillResponse {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i32>(3)? == 1,
                system_prompt: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(skills)
}

#[derive(Serialize)]
pub struct SwitchRoleResponse {
    pub session_id: String,
    pub skill_id: String,
}

#[tauri::command]
pub async fn switch_role(
    new_skill_id: String,
    db: State<'_, Arc<Database>>,
) -> Result<SwitchRoleResponse, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Create new session with the new skill
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sessions (id, skill_id, title, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, ?3)",
        rusqlite::params![session_id, new_skill_id, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(SwitchRoleResponse {
        session_id,
        skill_id: new_skill_id,
    })
}
