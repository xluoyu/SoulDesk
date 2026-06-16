pub mod parser;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: u32,
    pub theme: Option<ThemeConfig>,
    pub ai_config: Option<AIConfig>,
    pub behavior: Option<BehaviorConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub primary_color: Option<String>,
    pub secondary_color: Option<String>,
    pub background: Option<String>,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub preferred_model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorConfig {
    pub max_response_length: Option<u32>,
    pub web_search_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub dir_path: String,
    pub name: String,
    pub description: String,
    pub meta_json: String,
    pub raw_content: String,
    pub system_prompt: String,
    pub is_active: bool,
    pub created_at: String,
}
