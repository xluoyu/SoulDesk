use tauri::Manager;

#[tauri::command]
pub async fn show_chat_window(app: tauri::AppHandle) -> Result<(), String> {
    // Hide floating widget
    if let Some(floating) = app.get_webview_window("floating") {
        floating.hide().map_err(|e| e.to_string())?;
    }

    // Show main chat window
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn show_floating_widget(app: tauri::AppHandle) -> Result<(), String> {
    // Hide main chat window
    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|e| e.to_string())?;
    }

    // Show floating widget
    if let Some(floating) = app.get_webview_window("floating") {
        floating.show().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn create_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // Check if floating window already exists
    if app.get_webview_window("floating").is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "floating", WebviewUrl::App("index.html".into()))
        .title("Floating Widget")
        .inner_size(80.0, 80.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_floating_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(floating) = app.get_webview_window("floating") {
        floating.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // Check if settings window already exists
    if let Some(settings) = app.get_webview_window("settings") {
        settings.show().map_err(|e| e.to_string())?;
        settings.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html".into()))
        .title("设置")
        .inner_size(640.0, 520.0)
        .resizable(true)
        .decorations(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings) = app.get_webview_window("settings") {
        settings.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
