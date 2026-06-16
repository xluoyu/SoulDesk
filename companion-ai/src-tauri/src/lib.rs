mod ai;
mod commands;
mod db;

use db::Database;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("companion-ai")
        .join("data.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).ok();

    let database = Arc::new(
        Database::new(db_path.to_str().unwrap()).expect("Failed to init DB"),
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(database)
        .invoke_handler(tauri::generate_handler![commands::chat::send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
