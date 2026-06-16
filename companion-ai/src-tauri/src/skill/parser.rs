use super::{AIConfig, BehaviorConfig, SkillMeta, ThemeConfig};
use anyhow::Result;

pub fn parse_skill_meta(content: &str) -> Result<SkillMeta> {
    let mut id = String::new();
    let mut name = String::new();
    let mut description = String::new();
    let mut version = 1;
    let mut theme = None;
    let mut ai_config = None;
    let mut behavior = None;

    // Try to parse JSON frontmatter between --- markers
    if let Some(start) = content.find("---") {
        if let Some(end) = content[start + 3..].find("---") {
            let frontmatter = &content[start + 3..start + 3 + end];
            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(frontmatter) {
                id = meta["id"].as_str().unwrap_or("").to_string();
                name = meta["name"].as_str().unwrap_or("").to_string();
                description = meta["description"].as_str().unwrap_or("").to_string();
                version = meta["version"].as_u64().unwrap_or(1) as u32;

                if let Some(theme_obj) = meta.get("theme") {
                    theme = serde_json::from_value(theme_obj.clone()).ok();
                }
                if let Some(ai_obj) = meta.get("ai_config") {
                    ai_config = serde_json::from_value(ai_obj.clone()).ok();
                }
                if let Some(behavior_obj) = meta.get("behavior") {
                    behavior = serde_json::from_value(behavior_obj.clone()).ok();
                }
            }
        }
    }

    // If no frontmatter, try to extract from the beginning of the file
    if id.is_empty() {
        // Look for YAML-style frontmatter
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("id:") {
                id = line[3..].trim().trim_matches('"').trim_matches('\'').to_string();
            } else if line.starts_with("name:") {
                name = line[5..].trim().trim_matches('"').trim_matches('\'').to_string();
            } else if line.starts_with("description:") {
                description = line[12..].trim().trim_matches('"').trim_matches('\'').to_string();
            }
        }
    }

    Ok(SkillMeta {
        id,
        name,
        description,
        version,
        theme,
        ai_config,
        behavior,
    })
}

pub fn extract_system_prompt(content: &str) -> String {
    // Skip frontmatter and extract the main content
    let mut in_frontmatter = false;
    let mut prompt_lines = Vec::new();

    for line in content.lines() {
        if line.trim() == "---" {
            in_frontmatter = !in_frontmatter;
            continue;
        }
        if !in_frontmatter {
            prompt_lines.push(line);
        }
    }

    prompt_lines.join("\n").trim().to_string()
}

pub fn generate_system_prompt(meta: &SkillMeta, content: &str) -> String {
    let base_prompt = extract_system_prompt(content);

    format!(
        "你是{}。{}\n\n{}",
        meta.name,
        meta.description,
        base_prompt
    )
}
