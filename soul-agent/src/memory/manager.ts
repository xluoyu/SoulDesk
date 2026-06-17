import db from "../db/database.js";
import { v4 as uuid } from "uuid";

export class MemoryManager {
  async searchMemories(query: string, limit = 5) {
    return db.prepare(`
      SELECT m.id, m.category, m.content, m.created_at
      FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
  }

  async storeMemory(category: string, content: string, sourceSessionId?: string) {
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO memories (id, category, content, source_session_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, category, content, sourceSessionId || null, now);
    // 同步 FTS 索引
    db.prepare("INSERT INTO memories_fts (rowid, content) SELECT rowid, content FROM memories WHERE id = ?")
      .run(id);
    return { id, category, content, created_at: now };
  }

  async listMemories(limit = 50) {
    return db.prepare("SELECT * FROM memories ORDER BY created_at DESC LIMIT ?").all(limit);
  }

  async deleteMemory(id: string) {
    const row = db.prepare("SELECT rowid FROM memories WHERE id = ?").get(id) as any;
    if (row) {
      db.prepare("DELETE FROM memories_fts WHERE rowid = ?").run(row.rowid);
    }
    db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  async getUserProfile() {
    const row = db.prepare("SELECT profile_json FROM user_profile WHERE id = 1").get() as any;
    return row ? JSON.parse(row.profile_json) : { name: null, preferences: [], facts: [], communication_style: null, topics_of_interest: [] };
  }

  async updateUserProfile(updates: any) {
    const current = await this.getUserProfile();
    const merged = { ...current, ...updates };
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_profile (id, profile_json, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET profile_json = ?, updated_at = ?
    `).run(JSON.stringify(merged), now, JSON.stringify(merged), now);
  }

  async buildMemoryContext(userMessage: string): Promise<string> {
    const parts: string[] = [];

    // 用户模型
    const profile = await this.getUserProfile();
    if (profile.name) parts.push(`用户姓名: ${profile.name}`);
    if (profile.preferences?.length) parts.push(`用户偏好: ${profile.preferences.join(", ")}`);
    if (profile.facts?.length) parts.push(`用户事实: ${profile.facts.join(", ")}`);

    // 相关长期记忆
    const memories = await this.searchMemories(userMessage, 5) as any[];
    if (memories.length) {
      parts.push(`相关记忆:\n${memories.map(m => `- ${m.content}`).join("\n")}`);
    }

    return parts.join("\n\n");
  }
}
