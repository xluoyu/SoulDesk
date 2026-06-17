import Fastify from "fastify";
import cors from "@fastify/cors";
import { AgentEngine } from "../agent/engine.js";
import { listRoles, loadRole } from "../role/loader.js";
import { MemoryManager } from "../memory/manager.js";
import db from "../db/database.js";
import fs from "fs";
import path from "path";

const memoryManager = new MemoryManager();

const app = Fastify({ logger: true });

let agentEngine: AgentEngine | null = null;

function getSettings() {
  const settingsPath = path.resolve(__dirname, "../../../.souldesk", "settings.json");
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  } catch {
    return {
      model: {
        provider: "deepseek",
        api_key: "",
        base_url: "https://api.deepseek.com/v1",
        model_name: "deepseek-chat",
      },
      agent: { port: 3456 },
    };
  }
}

function initEngine() {
  const settings = getSettings();
  agentEngine = new AgentEngine(
    settings.model.api_key,
    settings.model.base_url,
    settings.model.model_name
  );
  // 同步搜索配置到环境变量
  if (settings.search?.tavily_api_key) {
    process.env.TAVILY_API_KEY = settings.search.tavily_api_key;
  }
}

app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

app.get("/roles", async () => listRoles());

app.get("/roles/:id", async (request) => {
  const { id } = request.params as { id: string };
  return await loadRole(id);
});

app.post("/chat", async (request, reply) => {
  if (!agentEngine) initEngine();
  const { message, session_id, role_id } = request.body as any;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    for await (const event of agentEngine!.streamChat({ message, session_id, role_id })) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (e: any) {
    reply.raw.write(`data: ${JSON.stringify({ type: "error", content: e.message })}\n\n`);
  }

  reply.raw.end();
});

app.post("/reload", async () => {
  initEngine();
  return { status: "reloaded" };
});

app.get("/sessions", async () => {
  return db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all();
});

app.get("/sessions/:id/messages", async (request) => {
  const { id } = request.params as { id: string };
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp").all(id);
});

// 记忆管理
app.get("/memories", async (request) => {
  const { limit } = request.query as { limit?: string };
  return memoryManager.listMemories(limit ? parseInt(limit) : 50);
});

app.get("/memories/search", async (request) => {
  const { query, limit } = request.query as { query: string; limit?: string };
  return memoryManager.searchMemories(query, limit ? parseInt(limit) : 5);
});

app.delete("/memories/:id", async (request) => {
  const { id } = request.params as { id: string };
  await memoryManager.deleteMemory(id);
  return { status: "deleted" };
});

// 用户模型
app.get("/profile", async () => {
  return memoryManager.getUserProfile();
});

app.post("/profile/update", async (request) => {
  const updates = request.body as any;
  await memoryManager.updateUserProfile(updates);
  return { status: "updated" };
});

export async function startServer(port = 3456) {
  initEngine();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Agent server running on http://localhost:${port}`);
}
