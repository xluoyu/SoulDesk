use crate::ai::factory::create_provider;
use crate::ai::{ChatMessage, ChatRequest};
use crate::db::Database;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub session_id: String,
    pub content: String,
    pub provider_type: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Serialize)]
pub struct SendMessageResponse {
    pub message_id: String,
    pub content: String,
}

#[tauri::command]
pub async fn send_message(
    request: SendMessageRequest,
    db: State<'_, Arc<Database>>,
) -> Result<SendMessageResponse, String> {
    // 1. Save user message
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?1, ?2, 'user', ?3, ?4)",
            rusqlite::params![user_msg_id, request.session_id, request.content, now],
        )
        .map_err(|e| e.to_string())?;
    }

    // 2. Load recent messages for context
    let messages = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT 20")
            .map_err(|e| e.to_string())?;
        let rows: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![request.session_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows.into_iter()
            .rev()
            .map(|(role, content)| ChatMessage { role, content })
            .collect::<Vec<_>>()
    };

    // 3. Call AI
    let provider = create_provider(&request.provider_type, &request.api_key, &request.base_url)
        .map_err(|e| e.to_string())?;

    let chat_request = ChatRequest {
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: true,
    };

    let mut stream = provider.chat(chat_request).await.map_err(|e| e.to_string())?;
    let mut full_response = String::new();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(c) => {
                full_response.push_str(&c.delta);
                if c.finish_reason.is_some() {
                    break;
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    // 4. Save assistant message
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?1, ?2, 'assistant', ?3, ?4)",
            rusqlite::params![assistant_msg_id, request.session_id, full_response, now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(SendMessageResponse {
        message_id: assistant_msg_id,
        content: full_response,
    })
}
