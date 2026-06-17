use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    #[serde(default)]
    pub model: ModelSettings,
    #[serde(default)]
    pub general: GeneralSettings,
    #[serde(default)]
    pub search: SearchSettings,
    #[serde(default)]
    pub agent: AgentSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            model: ModelSettings::default(),
            general: GeneralSettings::default(),
            search: SearchSettings::default(),
            agent: AgentSettings::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelSettings {
    /// "openai" or "anthropic"
    pub access_mode: String,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
}

impl Default for ModelSettings {
    fn default() -> Self {
        Self {
            access_mode: "openai".into(),
            api_key: String::new(),
            base_url: String::new(),
            model_name: String::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GeneralSettings {
    /// "dark", "light", or "system"
    pub theme_mode: String,
    pub floating_widget: bool,
    pub proactive_push: bool,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            theme_mode: "dark".into(),
            floating_widget: true,
            proactive_push: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchSettings {
    pub enabled: bool,
    pub tavily_api_key: String,
}

impl Default for SearchSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            tavily_api_key: String::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AgentSettings {
    pub port: u16,
    pub auto_start: bool,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            port: 3456,
            auto_start: true,
        }
    }
}

fn souldesk_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .join("..")  // companion-ai/
        .join("..")  // my-side/
        .join(".souldesk")
}

fn settings_path() -> PathBuf {
    souldesk_dir().join("settings.json")
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    let path = settings_path();
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}
