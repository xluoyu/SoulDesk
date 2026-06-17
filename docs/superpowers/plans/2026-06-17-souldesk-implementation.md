# SoulDesk 实施文档

> 本文档供 AI 实施会话使用，包含完整的项目背景、技术决策、实施步骤和代码模板。

## 项目背景

SoulDesk 是一个本地运行的桌面角色扮演 AI 应用，由两个独立项目组成：

1. **companion-ai**（现有项目，位于 `/Users/changjia/Desktop/my/side/companion-ai/`）— Tauri 桌面端
2. **soul-agent**（需要新建）— 独立的 Node.js Agent 后端

两个项目通过 HTTP/WebSocket 通信，通过共享数据目录 `.souldesk/`（项目同级）协调角色文件。

## 核心技术决策

| 项           | 决策                            | 原因                                     |
| ----------- | ----------------------------- | -------------------------------------- |
| 语言          | Node.js + TypeScript          | 用户偏好                                   |
| Agent 循环    | 手写 while 循环                   | 单 agent 场景，LangGraph 过重                |
| LLM 调用      | @langchain/openai + baseURL   | 国内模型（DeepSeek/豆包/Mimo）通过 OpenAI 兼容接口接入 |
| 存储          | SQLite (better-sqlite3)       | 零配置，本地运行                               |
| API 服务      | Fastify + WebSocket           | 异步、流式支持                                |
| 搜索          | Tavily                        | 角色学习用                                  |
| Markdown 解析 | gray-matter                   | frontmatter 解析                         |
| 角色 Skill    | Markdown 多模块，LLM 自主按需加载       | 类似 Claude Code 的 CLAUDE.md 模式          |
| 桌面端         | Tauri v2 + React + Ant Design | 现有项目改造                                 |

## 共享数据目录

```
my-side/
├── companion-ai/              # Tauri 桌面端
├── soul-agent/                # Agent 后端
└── .souldesk/                 # 共享数据目录
    ├── roles/                 # 角色 Skill 文件（两个项目共享）
    │   ├── xianna/
    │   │   ├── SKILL.md
    │   │   └── ...
    ├── data.db                # Agent SQLite 数据库
    └── settings.json          # 桌面端配置
```

## ·功能优先级

| 优先级    | 功能             | 说明                      |
| ------ | -------------- | ----------------------- |
| **P0** | Agent 基础对话     | Agent 循环、LLM 调用、流式输出    |
| **P0** | 多模块 Skill 加载   | SKILL.md 解析、LLM 按需加载模块  |
| **P0** | 桌面端聊天窗口        | Tauri UI、消息展示、输入框       |
| **P0** | 模型配置           | 设置界面输入 API Key、Base URL |
| **P1** | 三层记忆           | 短期会话、用户模型、FTS5 长期记忆     |
| **P1** | 角色导入/管理        | 桌面端导入 Skill 包、角色列表      |
| **P1** | WebSocket 流式对话 | 实时流式输出                  |
| **P2** | 联网搜索           | Tavily 搜索集成             |
| **P2** | 角色自动学习         | 激活时搜索 + 每周周期学习          |
| **P2** | 角色管理界面         | 查看、删除、编辑角色              |

***

## 阶段一：Agent 后端基础（P0）

### 目标

创建 `soul-agent` 项目，实现基础 Agent 循环 + Skill 加载 + HTTP API。

### 步骤 1.1：初始化项目

在 `/Users/changjia/Desktop/my/side/` 下创建 `soul-agent` 目录：

```bash
mkdir -p soul-agent/src/{agent,tools,role,memory,api,db}
cd soul-agent
npm init -y
npm install @langchain/openai @langchain/core fastify @fastify/websocket better-sqlite3 gray-matter zod uuid
npm install -D typescript @types/node @types/better-sqlite3 @types/uuid tsx
npx tsc --init --target ES2022 --module NodeNext --moduleResolution NodeNext --outDir dist --rootDir src --strict
```

### 步骤 1.2：数据库初始化

创建 `src/db/database.ts`：

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const SOULDESK_DIR = path.resolve(__dirname, "../../.souldesk");
const DB_DIR = SOULDESK_DIR;
const DB_PATH = path.join(DB_DIR, "data.db");

// 确保目录存在
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// 启用 WAL 模式
db.pragma("journal_mode = WAL");

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'fact',
    content TEXT NOT NULL,
    source_session_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content,
    content='memories',
    content_rowid='rowid'
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    profile_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );
`);

export default db;
```

### 步骤 1.3：角色加载器

创建 `src/role/loader.ts`：

```typescript
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const ROLES_DIR = path.resolve(__dirname, "../../.souldesk", "roles");

export interface SkillModule {
  name: string;
  content: string;
  alwaysLoad: boolean;
}

export interface Role {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  isManager: boolean;
  systemPrompt: string;
  modules: SkillModule[];
  moduleIndex: string;  // SKILL.md 中的模块索引部分
}

export async function listRoles(): Promise<{ id: string; name: string; description: string }[]> {
  await fs.mkdir(ROLES_DIR, { recursive: true });
  const entries = await fs.readdir(ROLES_DIR, { withFileTypes: true });
  const roles = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      try {
        const skillPath = path.join(ROLES_DIR, entry.name, "SKILL.md");
        const content = await fs.readFile(skillPath, "utf-8");
        const { data } = matter(content);
        roles.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description || "",
        });
      } catch {
        // 跳过没有 SKILL.md 的目录
      }
    }
  }

  return roles;
}

export async function loadRole(roleId: string): Promise<Role> {
  const roleDir = path.join(ROLES_DIR, roleId);
  const skillPath = path.join(roleDir, "SKILL.md");
  const content = await fs.readFile(skillPath, "utf-8");
  const { data, content: body } = matter(content);

  // 加载所有 .md 模块
  const files = await fs.readdir(roleDir);
  const modules: SkillModule[] = [];
  const alwaysLoad = data.always_load || [];

  for (const file of files) {
    if (file.endsWith(".md") && file !== "SKILL.md") {
      const modContent = await fs.readFile(path.join(roleDir, file), "utf-8");
      modules.push({
        name: file,
        content: modContent,
        alwaysLoad: alwaysLoad.includes(file),
      });
    }
  }

  // 提取模块索引部分
  const moduleIndexMatch = body.match(/## 模块索引[\s\S]*$/);
  const moduleIndex = moduleIndexMatch ? moduleIndexMatch[0] : "";

  return {
    id: roleId,
    name: data.name || roleId,
    version: data.version || "1.0",
    author: data.author || "",
    description: data.description || "",
    isManager: data.role === "manager",
    systemPrompt: body,
    modules,
    moduleIndex,
  };
}

export async function loadModule(roleId: string, moduleName: string): Promise<string> {
  const filePath = path.join(ROLES_DIR, roleId, moduleName);
  return await fs.readFile(filePath, "utf-8");
}
```

### 步骤 1.4：System Prompt 构建

创建 `src/role/prompt.ts`：

```typescript
import { Role, loadModule } from "./loader";

export async function buildSystemPrompt(role: Role, loadedModules: string[]): Promise<string> {
  const parts: string[] = [];

  // 核心设定（从 SKILL.md 正文）
  parts.push(role.systemPrompt);

  // 加载 always_load 模块
  for (const mod of role.modules) {
    if (mod.alwaysLoad) {
      parts.push(`## ${mod.name}\n${mod.content}`);
    }
  }

  // 加载已按需加载的模块
  for (const modName of loadedModules) {
    const mod = role.modules.find(m => m.name === modName);
    if (mod && !mod.alwaysLoad) {
      parts.push(`## ${mod.name}\n${mod.content}`);
    }
  }

  // 模块索引（让 LLM 知道可以加载什么）
  if (role.moduleIndex) {
    parts.push(role.moduleIndex);
  }

  return parts.join("\n\n");
}
```

### 步骤 1.5：工具注册系统

创建 `src/tools/registry.ts`：

```typescript
import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  handler: (args: any) => Promise<string>;
}

const registry: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition) {
  registry.set(tool.name, tool);
}

export function getTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

// 转换为 LangChain 格式
export function toLangChainTools(tools: ToolDefinition[]) {
  const { DynamicTool } = require("@langchain/core/tools");
  return tools.map(tool =>
    new DynamicTool({
      name: tool.name,
      description: tool.description,
      func: tool.handler,
    })
  );
}
```

### 步骤 1.6：内置工具

创建 `src/tools/skill.ts`：

```typescript
import { registerTool } from "./registry";
import { z } from "zod";
import { loadModule } from "../role/loader";

// 这些工具在 agent engine 中动态注册，因为需要 roleId
export function createSkillTools(roleId: string) {
  return [{
    name: "load_skill_module",
    description: "当对话涉及特定主题时，加载对应的角色知识模块。参见 system prompt 中的模块索引。",
    parameters: z.object({
      module_name: z.string().describe("模块文件名，如 relationships.md"),
    }),
    handler: async (args: { module_name: string }) => {
      return await loadModule(roleId, args.module_name);
    },
  }];
}
```

### 步骤 1.7：Agent Engine

创建 `src/agent/engine.ts`：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { Role, loadRole } from "../role/loader";
import { buildSystemPrompt } from "../role/prompt";
import { createSkillTools } from "../tools/skill";
import db from "../db/database";
import { v4 as uuid } from "uuid";

export interface ChatRequest {
  message: string;
  session_id: string;
  role_id: string;
}

export interface ChatEvent {
  type: "token" | "done" | "error";
  content: string;
}

export class AgentEngine {
  private llm: ChatOpenAI;

  constructor(apiKey: string, baseURL: string, modelName: string) {
    this.llm = new ChatOpenAI({
      configuration: { baseURL },
      apiKey,
      modelName,
      temperature: 0.7,
      streaming: true,
    });
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const { message, session_id, role_id } = request;

    // 1. 加载角色
    const role = await loadRole(role_id);

    // 2. 确保会话存在
    this.ensureSession(session_id, role_id);

    // 3. 保存用户消息
    this.saveMessage(session_id, "user", message);

    // 4. 加载历史消息（最近 20 条）
    const history = this.getRecentMessages(session_id, 20);

    // 5. 构建工具列表
    const skillTools = createSkillTools(role_id);
    const allToolDefs = [...skillTools];
    const langChainTools = this.toLangChainTools(allToolDefs);

    // 6. 构建消息列表
    const loadedModules: string[] = [];
    let systemPrompt = await buildSystemPrompt(role, loadedModules);
    const messages = [
      new SystemMessage({ content: systemPrompt }),
      ...history.map(m => m.role === "user"
        ? new HumanMessage({ content: m.content })
        : new AIMessage({ content: m.content })
      ),
      new HumanMessage({ content: message }),
    ];

    // 7. Agent 循环
    const maxRounds = 10;
    for (let round = 0; round < maxRounds; round++) {
      const llmWithTools = this.llm.bindTools(langChainTools);
      const response = await llmWithTools.invoke(messages);
      messages.push(response);

      // 检查是否有工具调用
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          const tool = allToolDefs.find(t => t.name === toolCall.name);
          let result: string;

          if (tool) {
            try {
              result = await tool.handler(toolCall.args);
            } catch (e) {
              result = `工具执行错误: ${e}`;
            }
          } else {
            result = `未知工具: ${toolCall.name}`;
          }

          // 如果是加载模块，更新 system prompt
          if (toolCall.name === "load_skill_module") {
            loadedModules.push(toolCall.args.module_name);
            systemPrompt = await buildSystemPrompt(role, loadedModules);
            messages[0] = new SystemMessage({ content: systemPrompt });
          }

          messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolCall.id!,
          }));
        }
        continue;
      }

      // 没有工具调用，返回最终回复
      const finalContent = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      this.saveMessage(session_id, "assistant", finalContent);

      yield { type: "done", content: finalContent };
      return;
    }

    yield { type: "error", content: "超过最大对话轮次" };
  }

  private ensureSession(sessionId: string, roleId: string) {
    const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare("INSERT INTO sessions (id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(sessionId, roleId, now, now);
    }
  }

  private saveMessage(sessionId: string, role: string, content: string) {
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run(id, sessionId, role, content, now);
  }

  private getRecentMessages(sessionId: string, limit: number) {
    return db.prepare(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?"
    ).all(sessionId, limit).reverse() as { role: string; content: string }[];
  }

  private toLangChainTools(tools: any[]) {
    return tools.map(tool =>
      new DynamicTool({
        name: tool.name,
        description: tool.description,
        func: tool.handler,
      })
    );
  }
}
```

### 步骤 1.8：Fastify API

创建 `src/api/server.ts`：

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { AgentEngine } from "../agent/engine";
import { listRoles, loadRole } from "../role/loader";
import db from "../db/database";

const app = Fastify({ logger: true });

// 配置（从 settings.json 读取）
let agentEngine: AgentEngine | null = null;

function getSettings() {
  const fs = require("fs");
  const path = require("path");
  const settingsPath = path.resolve(__dirname, "../../.souldesk", "settings.json");
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
}

// CORS
app.register(cors, { origin: true });

// 健康检查
app.get("/health", async () => ({ status: "ok" }));

// 获取角色列表
app.get("/roles", async () => listRoles());

// 获取角色详情
app.get("/roles/:id", async (request) => {
  const { id } = request.params as { id: string };
  return await loadRole(id);
});

// 流式对话
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

// 重新加载角色
app.post("/reload", async () => {
  initEngine();
  return { status: "reloaded" };
});

// 获取会话列表
app.get("/sessions", async () => {
  return db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all();
});

// 获取会话消息
app.get("/sessions/:id/messages", async (request) => {
  const { id } = request.params as { id: string };
  return db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp").all(id);
});

export async function startServer(port = 3456) {
  initEngine();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Agent server running on http://localhost:${port}`);
}
```

### 步骤 1.9：入口文件

创建 `src/index.ts`：

```typescript
import { startServer } from "./api/server";

const port = parseInt(process.env.PORT || "3456");
startServer(port);
```

### 步骤 1.10：package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### 步骤 1.11：创建示例角色

在 `.souldesk/roles/xianna/` 下创建 `SKILL.md`：

```markdown
---
name: "夏娜"
version: 1.0
author: "示例"
description: "灼眼的夏娜中的女主角"
always_load:
  - personality.md
  - speaking_style.md
---

# 夏娜 角色设定

你是夏娜，一个傲娇、直率的女孩。你说话直接，有时毒舌但内心温柔。

## 模块索引

以下是你可以按需加载的知识模块：

- `relationships.md` — 当用户提到其他角色名时查看
- `world_setting.md` — 当用户讨论战斗、神器时查看
```

创建 `personality.md`：

```markdown
# 性格设定

- 傲娇：嘴上不承认但行动上很关心人
- 直率：有什么说什么，不喜欢拐弯抹角
- 认真：对待战斗和责任非常认真
- 偶尔毒舌：会用「笨蛋」之类的词，但没有恶意
```

创建 `speaking_style.md`：

```markdown
# 说话风格

- 使用「我」自称
- 生气时语速加快，会说「哼」、「切」
- 关心人时会变得小声，然后立刻转移话题
- 不知道的事情会说「这种事我怎么知道」
- 经常用「笨蛋」称呼对方，但语气并不真的生气
```

### 步骤 1.12：验证 Agent 后端

```bash
cd soul-agent
npm run dev

# 测试健康检查
curl http://localhost:3456/health

# 测试角色列表
curl http://localhost:3456/roles

# 测试对话（注意：需要先配置 API Key）
curl -X POST http://localhost:3456/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","session_id":"test-1","role_id":"xianna"}'
```

***

## 阶段二：Tauri 桌面端改造（P0）

### 目标

改造现有 companion-ai 项目，移除 Rust 中的 agent 逻辑，改为通过 HTTP 调用 Agent 后端。

### 步骤 2.1：清理 Rust 后端

删除以下文件/目录：

- `src-tauri/src/ai/` — 整个目录
- `src-tauri/src/commands/chat.rs`
- `src-tauri/src/commands/memory.rs`
- `src-tauri/src/commands/skill.rs`
- `src-tauri/src/db/` — 整个目录
- `src-tauri/src/memory/` — 整个目录
- `src-tauri/src/skill/` — 整个目录

### 步骤 2.2：精简 Cargo.toml

移除不再需要的依赖（reqwest, futures, uuid, chrono, rusqlite, lancedb 等）。

### 步骤 2.3：精简 lib.rs

```rust
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
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 步骤 2.4：新建 settings.rs

创建 `src-tauri/src/commands/settings.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default)]
pub struct Settings {
    pub model: ModelSettings,
    pub agent: AgentSettings,
}

#[derive(Serialize, Deserialize, Default)]
pub struct ModelSettings {
    pub provider: String,
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct AgentSettings {
    pub port: u16,
    pub auto_start: bool,
}

fn souldesk_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.join("..").join("..").join(".souldesk")
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
```

### 步骤 2.5：新建前端 Agent 客户端

创建 `src/services/agentClient.ts`：

```typescript
const AGENT_URL = "http://localhost:3456";

export interface ChatEvent {
  type: "token" | "done" | "error";
  content: string;
}

export async function* streamChat(
  message: string,
  sessionId: string,
  roleId: string
): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, role_id: roleId }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6));
          yield event;
        } catch {}
      }
    }
  }
}

export async function getRoles() {
  const res = await fetch(`${AGENT_URL}/roles`);
  return res.json();
}

export async function getSessions() {
  const res = await fetch(`${AGENT_URL}/sessions`);
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${AGENT_URL}/health`);
  return res.json();
}
```

### 步骤 2.6：更新 tauriBridge.ts

将原来通过 `invoke` 调用 Rust 的方式改为通过 `agentClient.ts` 调用 HTTP API。

### 步骤 2.7：验证桌面端

```bash
cd companion-ai
npm run tauri dev
```

***

## 阶段三：三层记忆（P1）

### 步骤 3.1：Memory Manager

创建 `src/memory/manager.ts`：

```typescript
import db from "../db/database";
import { v4 as uuid } from "uuid";

export class MemoryManager {
  // 搜索长期记忆（FTS5）
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

  // 存储记忆
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

  // 获取用户模型
  async getUserProfile() {
    const row = db.prepare("SELECT profile_json FROM user_profile WHERE id = 1").get() as any;
    return row ? JSON.parse(row.profile_json) : { name: null, preferences: [], facts: [], communication_style: null, topics_of_interest: [] };
  }

  // 更新用户模型
  async updateUserProfile(updates: any) {
    const current = await this.getUserProfile();
    const merged = { ...current, ...updates };
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_profile (id, profile_json, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET profile_json = ?, updated_at = ?
    `).run(JSON.stringify(merged), now, JSON.stringify(merged), now);
  }

  // 构建记忆上下文（注入到 system prompt）
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
```

### 步骤 3.2：在 Agent Engine 中集成记忆

在 `agent/engine.ts` 中：

- 构建 system prompt 时调用 `memoryManager.buildMemoryContext()`
- 增加 `recall_memory` 和 `store_memory` 工具

***

## 阶段四：联网搜索 + 角色学习（P2）

### 步骤 4.1：Tavily 搜索工具

创建 `src/tools/search.ts`：

```typescript
import { z } from "zod";

export const searchWebTool = {
  name: "search_web",
  description: "搜索互联网获取实时信息。当用户问到最新事件、天气、或你不确定的事实时使用。",
  parameters: z.object({
    query: z.string().describe("搜索关键词"),
  }),
  handler: async (args: { query: string }) => {
    // Tavily API 调用
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: args.query,
        max_results: 3,
      }),
    });
    const data = await response.json();
    return data.results?.map((r: any) => `${r.title}: ${r.content}`).join("\n\n") || "未找到结果";
  },
};
```

### 步骤 4.2：角色学习器

创建 `src/role/learner.ts`：

```typescript
import db from "../db/database";
import { loadRole } from "./loader";
import { MemoryManager } from "../memory/manager";

const memoryManager = new MemoryManager();

export async function learnAboutRole(roleId: string) {
  const role = await loadRole(roleId);
  const query = `${role.name} 角色设定 性格 背景`;

  // 调用 Tavily 搜索
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 5,
    }),
  });
  const data = await response.json();

  // 存入记忆
  for (const result of data.results || []) {
    await memoryManager.storeMemory("role_knowledge", `${role.name}: ${result.title} - ${result.content}`);
  }
}
```

***

## 附录：SKILL.md 格式规范

```markdown
---
name: "角色名称"           # 必填
version: "1.0"            # 可选
author: "创作者"           # 可选
description: "角色简介"    # 可选
role: "manager"           # 可选，标记为管理者角色
always_load:              # 必填，始终加载的模块
  - personality.md
  - speaking_style.md
---

# 角色名称 角色设定

（核心 system prompt 内容）

## 模块索引

（告诉 LLM 有哪些模块可按需加载）

- `module_name.md` — 当用户讨论 XXX 时查看
```

## 附录：Agent API 接口

| 方法   | 路径                       | 说明        |
| ---- | ------------------------ | --------- |
| GET  | `/health`                | 健康检查      |
| GET  | `/roles`                 | 角色列表      |
| GET  | `/roles/:id`             | 角色详情      |
| POST | `/chat`                  | 流式对话（SSE） |
| POST | `/reload`                | 重新加载角色    |
| GET  | `/sessions`              | 会话列表      |
| GET  | `/sessions/:id/messages` | 会话消息      |

