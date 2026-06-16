use anyhow::Result;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        // Load built-in skills
        db.load_builtin_skills()?;

        Ok(db)
    }

    fn load_builtin_skills(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;

        // Check if ashin-perspective already exists
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM skills WHERE id = 'ashin-perspective'",
            [],
            |row| row.get(0),
        )?;

        if !exists {
            let skill_content = include_str!("../../../skills/ashin-perspective/SKILL.md");
            let now = chrono::Utc::now().to_rfc3339();

            // Parse the skill content
            let (name, description, system_prompt) = parse_builtin_skill(skill_content);

            conn.execute(
                "INSERT INTO skills (id, dir_path, name, description, meta_json, raw_content, system_prompt, is_active, created_at)
                 VALUES ('ashin-perspective', 'builtin', ?1, ?2, '{}', ?3, ?4, 1, ?5)",
                rusqlite::params![name, description, skill_content, system_prompt, now],
            )?;
        }

        Ok(())
    }
}

fn parse_builtin_skill(content: &str) -> (String, String, String) {
    let mut name = String::from("阿信");
    let mut description = String::new();
    let mut in_frontmatter = false;
    let mut frontmatter_done = false;
    let mut prompt_lines = Vec::new();

    for line in content.lines() {
        if line.trim() == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            } else {
                in_frontmatter = false;
                frontmatter_done = true;
                continue;
            }
        }

        if in_frontmatter {
            if let Some(val) = line.strip_prefix("name:") {
                name = val.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(val) = line.strip_prefix("description:") {
                description = val.trim().trim_matches('"').trim_matches('\'').to_string();
            }
        } else if frontmatter_done {
            prompt_lines.push(line);
        }
    }

    let system_prompt = prompt_lines.join("\n").trim().to_string();
    let system_prompt = format!("你是{}。{}\n\n{}", name, description, system_prompt);

    (name, description, system_prompt)
}
