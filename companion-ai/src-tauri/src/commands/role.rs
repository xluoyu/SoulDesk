use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Clone)]
pub struct RoleInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}

fn souldesk_dir() -> PathBuf {
    // ~/.souldesk/ → 项目同级目录 .souldesk/
    // 从 src-tauri 向上找到项目根目录，再向上找到 my-side/
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .join("..")  // companion-ai/
        .join("..")  // my-side/
        .join(".souldesk")
}

fn roles_dir() -> PathBuf {
    souldesk_dir().join("roles")
}

fn parse_frontmatter(content: &str) -> Option<(String, String)> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }

    let after_first = &trimmed[3..];
    let end = after_first.find("---")?;
    let fm_block = &after_first[..end];

    let mut name = String::new();
    let mut description = String::new();

    for line in fm_block.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some((key, val)) = line.split_once(':') {
            let key = key.trim();
            let val = val.trim().trim_matches('"').trim_matches('\'');

            match key {
                "name" => name = val.to_string(),
                "description" => description = val.to_string(),
                _ => {}
            }
        }
    }

    Some((name, description))
}

#[tauri::command]
pub fn list_roles() -> Result<Vec<RoleInfo>, String> {
    let dir = roles_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut roles = vec![];

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let role_id = entry.file_name().to_string_lossy().to_string();
        let skill_path = entry.path().join("SKILL.md");

        if !skill_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&skill_path).map_err(|e| e.to_string())?;

        match parse_frontmatter(&content) {
            Some((name, description)) => {
                let display_name = if name.is_empty() { role_id.clone() } else { name };
                roles.push(RoleInfo {
                    id: role_id,
                    name: display_name,
                    description,
                });
            }
            None => {
                let id = role_id.clone();
                roles.push(RoleInfo {
                    id: role_id,
                    name: id,
                    description: String::new(),
                });
            }
        }
    }

    Ok(roles)
}
