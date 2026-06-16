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
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
