mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::window::show_chat_window,
            commands::window::show_floating_widget,
            commands::window::create_floating_window,
            commands::window::close_floating_window,
            commands::window::open_settings_window,
            commands::window::close_settings_window,
            commands::role::list_roles,
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
