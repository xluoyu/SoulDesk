# SoulDesk 设计文档

> 一个基于角色扮演的桌面 AI 应用，由 Tauri 桌面端 + 独立 Agent 后端组成，支持多模块 Skill 按需加载、三层记忆、联网搜索、自动学习。

## 1. 项目定位

SoulDesk 是一个**本地运行**的桌面角色扮演 AI 应用。核心特点：

- **本地优先**：所有数据存储在用户本地，不做云端服务
- **桌面互动**：通过 Tauri 桌面窗口与角色 Agent 对话
- **角色扮演**：通过 Markdown Skill 文件定义角色人格，LLM 所有输出经过角色设定过滤
- **多模块 Skill**：角色知识拆分为多个模块，由 LLM 自主判断何时加载
- **Skill 分发**：角色 Skill 作为独立文件包，可通过网盘等方式传播，用户导入即用
- **三层记忆**：短期会话上下文 + 用户模型 + 长期 FTS 记忆
- **联网学习**：角色激活时搜索学习 + 每周周期性学习
- **多模型支持**：通过 OpenAI 兼容接口接入 DeepSeek、豆包、Mimo 等国内模型
- **可扩展**：Agent 后端独立运行，支持 HTTP 调用，后续可接入 Web 端

## 2. 功能优先级

| 优先级    | 功能                | 说明                      |
| ------ | ----------------- | ----------------------- |
| **P0** | Agent 基础对话        | Agent 循环、LLM 调用、流式输出    |
| **P0** | 多模块 Skill 加载      | SKILL.md 解析、LLM 按需加载模块  |
| **P0** | 桌面端聊天窗口           | Tauri UI、消息展示、输入框       |
| **P0** | 模型配置              | 设置界面输入 API Key、Base URL |
| **P1** | 三层记忆              | 短期会话、用户模型、FTS5 长期记忆     |
| **P1** | 角色导入/管理           | 桌面端导入 Skill 包、角色列表      |
| **P1** | WebSocket 流式对话    | 实时流式输出                  |
| **P2** | 联网搜索              | Tavily 搜索集成             |
| **P2** | 角色自动学习            | 激活时搜索 + 每周周期学习          |
| **P2** | 角色管理界面            | 查看、删除、编辑角色              |
| **P3** | huashu-nuwa 管理者角色 | 文件操作工具、角色创建/修改          |

## 3. 整体架构

```
┌─────────────────── Tauri 桌面端 ───────────────────┐
│                                                     │
│  ┌──────────────┐  ┌───────────┐  ┌─────────────┐ │
│  │  聊天窗口     │  │ 角色管理   │  │  设置窗口    │ │
│  │  ChatPanel   │  │ RoleMgr   │  │  Settings    │ │
│  └──────┬───────┘  └─────┬─────┘  └──────┬──────┘ │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          │                           │
│                ┌─────────▼─────────┐               │
│                │   Tauri 轻量后端    │               │
│                │   (Rust/Node)      │               │
│                │   - 窗口管理        │               │
│                │   - 文件系统操作     │               │
│                │   - 设置存储        │               │
│                │   - Agent 通信代理  │               │
│                └─────────┬─────────┘               │
│                          │ HTTP/WebSocket            │
└──────────────────────────┼──────────────────────────┘
                           │
                           │ 本地 localhost
                           │
┌──────────────────────────▼──────────────────────────┐
│                Agent 后端 (Node.js)                  │
│                                                     │
│  ┌──────────────┐  ┌───────────┐  ┌─────────────┐ │
│  │  Agent Engine │  │ Role      │  │  Memory     │ │
│  │  (while 循环) │  │ Engine    │  │  Manager    │ │
│  └──────┬───────┘  └─────┬─────┘  └──────┬──────┘ │
│         └────────────────┼────────────────┘         │
│                ┌─────────▼─────────┐               │
│                │    Fastify API     │               │
│                │    HTTP + WS      │               │
│                └───────────────────┘               │
└─────────────────────────────────────────────────────┘
```

### 职责划分

| 层             | 职责                                 | 技术                            |
| ------------- | ---------------------------------- | ----------------------------- |
| **Tauri 桌面端** | UI 渲染、窗口管理、文件系统操作、设置存储、启动/停止 Agent | Tauri v2 + React + TypeScript |
| **Agent 后端**  | Agent 循环、LLM 调用、记忆管理、角色加载、搜索学习     | Node.js + TypeScript          |
| **通信层**       | HTTP REST + WebSocket 流式对话         | localhost 通信                  |

## 3. Tauri 桌面端

### 3.1 窗口设计

```
┌─────────────────────────────────────────┐
│  SoulDesk                    ─  □  ✕    │
├─────────────────────────────────────────┤
│  ┌─────────┐                            │
│  │ 角色头像  │  夏娜                       │
│  │         │  在线                        │
│  └─────────┘                            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 用户消息气泡...                   │   │
│  └─────────────────────────────────┘   │
│                                         │
│         ┌───────────────────────────┐   │
│         │  夏娜回复气泡...            │   │
│         └───────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌────┐    │
│  │ 输入消息...            │  │ 发送 │    │
│  └───────────────────────┘  └────┘    │
└─────────────────────────────────────────┘

设置窗口（独立弹窗）:
┌─────────────────────────────────────────┐
│  设置                          ✕        │
├─────────────────────────────────────────┤
│  模型配置                                │
│  ├─ 提供商: [DeepSeek ▾]                │
│  ├─ API Key: [sk-xxx........]           │
│  ├─ Base URL: [https://api.deepseek.com]│
│  └─ 模型: [deepseek-chat]               │
│                                         │
│  角色管理                                │
│  ├─ [导入角色文件]                        │
│  ├─ 夏娜          [编辑] [删除]           │
│  ├─ 鸣人          [编辑] [删除]           │
│  └─ + 新建角色                            │
│                                         │
│  记忆管理                                │
│  ├─ [查看长期记忆]                        │
│  └─ [清除所有记忆]                        │
└─────────────────────────────────────────┘
```

### 3.2 Tauri 后端职责

Tauri 的 Rust/Node 后端主要处理**系统级操作**，不包含 Agent 逻辑：

```rust
// Tauri Commands
- show_chat_window()        // 显示聊天窗口
- open_settings_window()    // 打开设置窗口
- import_role(file_path)    // 从文件系统导入角色 Skill 包
- delete_role(role_id)      // 删除角色
- get_settings()            // 读取本地设置（API Key 等）
- save_settings(settings)   // 保存设置
- start_agent()             // 启动 Agent 后端进程
- stop_agent()              // 停止 Agent 后端进程
```

### 3.3 设置存储

用户配置存储在本地 JSON 文件中（Tauri data 目录）：

```json
{
  "model": {
    "provider": "deepseek",
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com/v1",
    "model_name": "deepseek-chat"
  },
  "agent": {
    "port": 3456,
    "auto_start": true
  }
}
```

### 3.4 角色导入流程

```
用户点击"导入角色文件"
  → Tauri 打开系统文件选择器
  → 用户选择 .zip 或文件夹（Skill 包）
  → Tauri 将文件复制到本地 roles 目录
  → 通知 Agent 后端重新加载角色列表
  → 角色出现在角色管理列表中
```

### 3.5 前端与 Agent 通信

```typescript
// Tauri 前端通过 HTTP/WebSocket 与 Agent 后端通信
const AGENT_URL = "http://localhost:3456";

// 流式对话
async function sendMessage(message: string, sessionId: string) {
  const response = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId })
  });
  
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = JSON.parse(new TextDecoder().decode(value));
    // 流式显示回复
  }
}

// WebSocket 实时对话
const ws = new WebSocket(`ws://localhost:3456/ws/chat`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  appendToChat(data.content);
};
```

## 4. Agent 后端

### 4.1 技术选型

| 层               | 技术                      | 说明                       |
| --------------- | ----------------------- | ------------------------ |
| **语言**          | Node.js + TypeScript    | 独立服务                     |
| **LLM 调用**      | @langchain/openai       | 通过 OpenAI 兼容接口接入国内模型     |
| **Agent 循环**    | 手写 while 循环             | 单 agent 场景，LangGraph 过重  |
| **存储**          | SQLite (better-sqlite3) | 会话、记忆、用户模型               |
| **API 服务**      | Fastify + WebSocket     | HTTP 流式 + WebSocket 实时对话 |
| **搜索**          | Tavily                  | 角色学习内容抓取                 |
| **Markdown 解析** | gray-matter             | frontmatter 解析           |
| **定时任务**        | node-cron               | 每周角色学习调度                 |
| **类型校验**        | zod                     | 工具参数校验                   |

### 4.2 Agent Engine 核心

采用经典 ReAct 模式，手写 while 循环：

```
用户消息
  → 构建消息列表（SystemMessage + HumanMessage）
  → while 循环:
      → 调用 LLM（绑定工具）
      → 检查 finish_reason:
          → "tool_calls": 执行工具，结果加入消息列表，继续循环
          → "stop": 返回最终回复，循环结束
      → 安全阀: 最大 10 轮防止无限循环
```

### 4.3 消息结构

```
[0] SystemMessage  ← 角色设定（始终在最前面，是所有回复的"滤镜"）
[1] HumanMessage   ← 用户消息
[2] AssistantMessage (tool_call) ← LLM 决定调工具
[3] ToolMessage    ← 工具执行结果
[4] AssistantMessage (tool_call) ← LLM 继续调工具
[5] ToolMessage    ← 工具执行结果
...（循环继续）
[N] AssistantMessage ← 最终回复（受角色设定约束）
```

### 4.4 角色设定注入

SystemMessage 始终包含完整的角色设定，LLM 的每一次输出都经过它过滤：

```
SystemMessage 内容:
├── 核心性格（始终加载）
├── 说话风格（始终加载）
├── 行为规则（始终加载）
├── 已加载的模块内容（按需）
└── 模块索引（告诉 LLM 有哪些模块可加载）
```

## 5. 多模块 Skill 系统

### 5.1 共享角色目录

两个独立项目通过共享数据目录协调角色 Skill 文件：

```
~/.souldesk/
├── roles/                    # 角色 Skill 文件
│   ├── xianna/
│   │   ├── SKILL.md
│   │   ├── personality.md
│   │   └── ...
│   ├── naruto/
│   │   └── ...
│   └── huashu-nuwa/
│       └── ...
├── data.db                   # Agent SQLite 数据库
└── settings.json             # 桌面端配置（API Key 等）
```

- **桌面端**：导入 Skill 包时，解压到 `~/.souldesk/roles/<role_id>/`
- **Agent 后端**：从 `~/.souldesk/roles/` 读取角色文件
- **两个项目独立运行**，通过共享目录协调，互不依赖

### 5.2 Skill 包结构

角色 Skill 作为独立分发包，用户通过导入功能加载：

```
xianna.zip (分发包)
├── SKILL.md              # 主文件（路由表 + 核心设定）
├── personality.md        # 性格（always_load）
├── speaking_style.md     # 说话风格（always_load）
├── world_setting.md      # 世界观（按需）
├── relationships.md      # 人物关系（按需）
├── plot_arc.md           # 剧情线（按需）
├── daily_life.md         # 日常生活（按需）
└── abilities.md          # 能力设定（按需）
```

### 5.2 SKILL.md 格式

主 SKILL.md 作为"路由表"，由 LLM 自主决定何时加载其他模块：

```markdown
---
name: "夏娜"
version: 1.0
author: "创作者"
description: "灼眼的夏娜中的女主角"
always_load:
  - personality.md
  - speaking_style.md
---

# 夏娜 角色设定

你是夏娜，一个傲娇、直率的女孩...

## 模块索引

以下是你可以按需加载的知识模块：

- `world_setting.md` — 当用户讨论战斗、神器、红世之徒时查看
- `relationships.md` — 当用户提到其他角色名（悠二、玛蒂尔达）时查看
- `plot_arc.md` — 当用户讨论剧情、故事发展时查看
- `daily_life.md` — 当用户讨论日常生活、校园场景时查看
- `abilities.md` — 当用户询问战斗能力、封绝时查看
```

### 5.3 按需加载机制

LLM 通过 tool calling 自主决定加载模块：

```
用户: "你和悠二最近怎么样了？"
        │
        ▼
LLM 读取 SKILL.md → 看到"提到悠二时查看 relationships.md"
        │
        ▼
LLM 返回 tool_call: load_skill_module("relationships.md")
        │
        ▼
Agent 执行加载 → 模块内容注入消息列表
        │
        ▼
LLM 基于完整知识回复（角色语气）
```

## 6. 三层记忆系统

### 6.1 架构

```
┌─────────────────────────────────────────────┐
│                Memory Manager                │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 短期记忆  │  │ 用户模型  │  │ 长期记忆  │  │
│  │          │  │          │  │          │  │
│  │ 当前会话  │  │ 结构化    │  │ FTS5     │  │
│  │ 最近N条   │  │ 用户信息  │  │ 全文搜索  │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### 6.2 短期记忆

存储当前会话最近 N 条消息（默认 20 条），作为 LLM 上下文的一部分。

### 6.3 用户模型

结构化的用户信息，存储在 SQLite 中：

```json
{
  "name": "张三",
  "preferences": ["喜欢科幻", "晚上活跃"],
  "facts": ["住在北京", "是程序员"],
  "communication_style": "喜欢简洁回复",
  "topics_of_interest": ["AI", "编程", "动漫"]
}
```

### 6.4 长期记忆

基于 FTS5 全文搜索的历史记忆，支持语义检索。

### 6.5 记忆上下文构建

每次对话时，Memory Manager 构建记忆上下文注入到 system prompt：

```
用户模型信息 + 相关长期记忆（FTS5 搜索） → 注入 SystemMessage
```

## 7. Tool 系统

### 7.1 内置工具

| 工具                  | 描述        | 触发场景         |
| ------------------- | --------- | ------------ |
| `load_skill_module` | 加载角色知识模块  | LLM 根据模块索引判断 |
| `recall_memory`     | 搜索长期记忆    | 需要回忆之前对话     |
| `store_memory`      | 存储新记忆     | 对话中提取到重要信息   |
| `search_web`        | Tavily 搜索 | 需要实时信息或验证事实  |

### 7.2 扩展工具

使用装饰器模式，新增工具只需创建文件加装饰器：

```typescript
@tool("get_weather", "查询指定城市的天气", z.object({
  city: z.string().describe("城市名称")
}))
async function getWeather(city: string): Promise<string> {
  // 实现...
}
```

## 8. 角色学习系统

### 8.1 学习时机

1. **角色激活时**：首次加载角色时，搜索该角色的相关内容并存入记忆
2. **每周周期性**：通过 node-cron 定时触发，搜索角色最新动态

### 8.2 学习流程

```
角色激活 / 定时触发
  → 构建搜索关键词（角色名 + 相关主题）
  → 调用 Tavily API 搜索
  → LLM 分析搜索结果，提取有价值的信息
  → 存入 memories 表（category: 'role_knowledge'）
```

## 9. API 设计

### 9.1 Agent 后端 API

```
POST   /chat              # 流式对话（SSE）
POST   /chat              # WebSocket 对话（ws://localhost:3456/ws/chat）
GET    /roles              # 获取角色列表
POST   /roles/activate     # 激活角色（触发学习）
GET    /sessions           # 获取会话列表
GET    /sessions/:id       # 获取会话消息历史
DELETE /sessions/:id       # 删除会话
GET    /memories           # 获取长期记忆
DELETE /memories/:id       # 删除记忆
GET    /profile            # 获取用户模型
POST   /profile/update     # 更新用户模型
POST   /reload             # 重新加载角色（导入新角色后调用）
GET    /health             # 健康检查
```

### 9.2 流式对话格式

```
POST /chat
Body: { "message": "...", "session_id": "...", "role_id": "..." }
Response: text/event-stream

data: {"type":"token","content":"哼"}
data: {"type":"token","content":"，"}
data: {"type":"token","content":"这种事"}
data: {"type":"done","content":"完整回复"}
```

## 10. 项目结构

两个独立项目，通过 HTTP/WebSocket 通信：

```
my-side/
├── companion-ai/                  # 桌面端项目（现有，改造）
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── window.rs     # 窗口管理（保留）
│   │   │   │   └── settings.rs   # 设置读写（新建）
│   │   │   └── lib.rs            # 精简：移除 agent 逻辑
│   │   └── Cargo.toml            # 精简：移除不需要的依赖
│   ├── src/                       # React 前端
│   │   ├── components/
│   │   │   ├── Chat/             # 聊天窗口（保留）
│   │   │   ├── Skill/            # 角色管理（保留）
│   │   │   ├── Settings/         # 设置窗口（保留）
│   │   │   └── Floating/         # 浮窗（保留）
│   │   ├── services/
│   │   │   └── agentClient.ts    # 新建：HTTP/WS 客户端（替代 tauriBridge）
│   │   ├── stores/               # Zustand（保留）
│   │   └── types/                # 类型定义（保留）
│   └── package.json
│
└── soul-agent/                    # Agent 后端项目（新建）
    ├── src/
    │   ├── index.ts              # 入口
    │   ├── agent/
    │   │   ├── engine.ts         # Agent 循环核心
    │   │   └── state.ts
    │   ├── tools/
    │   │   ├── registry.ts       # 工具注册中心
    │   │   ├── skill.ts          # load_skill_module
    │   │   ├── memory.ts         # recall_memory, store_memory
    │   │   └── search.ts         # search_web (Tavily)
    │   ├── role/
    │   │   ├── loader.ts         # Markdown 解析
    │   │   └── learner.ts        # 角色学习
    │   ├── memory/
    │   │   ├── manager.ts        # 三层记忆管理
    │   │   ├── short-term.ts
    │   │   ├── user-model.ts
    │   │   └── long-term.ts
    │   ├── api/
    │   │   └── server.ts         # Fastify API
    │   ├── db/
    │   │   └── database.ts       # SQLite
    │   └── types.ts
    ├── roles/                    # 角色 Skill 文件（本地存储）
    │   └── xianna/
    │       ├── SKILL.md
    │       └── ...
    ├── package.json
    └── tsconfig.json
```

### 两个项目的职责边界

| <br />   | companion-ai (桌面端)            | soul-agent (Agent 后端)   |
| -------- | ----------------------------- | ----------------------- |
| **技术栈**  | Tauri v2 + React + TypeScript | Node.js + TypeScript    |
| **职责**   | UI 渲染、窗口管理、文件操作、设置存储          | Agent 循环、LLM 调用、记忆、角色加载 |
| **启动方式** | 用户打开桌面应用                      | 随桌面应用自动启动，或独立运行         |
| **数据存储** | 本地 JSON 配置文件                  | SQLite（会话、记忆、用户模型）      |
| **通信**   | HTTP/WebSocket 调用 Agent       | Fastify API 服务          |

### 桌面端改造清单

**删除**：`src-tauri/src/ai/`、`commands/chat.rs`、`commands/memory.rs`、`commands/skill.rs`、`db/`、`memory/`、`skill/`

**保留**：`commands/window.rs`、React UI 组件、Zustand stores、类型定义

**改造**：

- `tauriBridge.ts` → `agentClient.ts`（invoke 改为 HTTP 调用）
- 新增 `commands/settings.rs`（本地 JSON 配置读写）
- 新增 `start_agent` / `stop_agent` 命令（管理 Agent 进程）

### 桌面端保留的 Tauri Commands

```rust
// 只保留这些：
- show_chat_window()
- show_floating_widget()
- open_settings_window()
- close_settings_window()
- import_role()          // 文件系统操作：导入 Skill 包
- get_settings()         // 读取本地配置（API Key 等）
- save_settings()        // 保存本地配置
- start_agent()          // 启动 soul-agent 进程
- stop_agent()           // 停止 soul-agent 进程
```

## 11. 数据库设计

```sql
-- 会话表
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 消息表
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

-- Skill 模块表
CREATE TABLE skill_modules (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  always_load INTEGER NOT NULL DEFAULT 0,
  keywords TEXT,
  content TEXT NOT NULL
);

-- 长期记忆表
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'fact',
  content TEXT NOT NULL,
  source_session_id TEXT,
  created_at TEXT NOT NULL
);

-- FTS5 全文索引
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content,
  content='memories',
  content_rowid='rowid'
);

-- 用户模型表
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  profile_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
```

## 12. 核心依赖

### Agent 后端

```json
{
  "dependencies": {
    "@langchain/openai": "^0.5.0",
    "@langchain/core": "^0.3.0",
    "better-sqlite3": "^11.0.0",
    "fastify": "^5.0.0",
    "@fastify/websocket": "^11.0.0",
    "tavily": "^0.2.0",
    "gray-matter": "^4.0.3",
    "node-cron": "^3.0.0",
    "zod": "^3.23.0"
  }
}
```

### Tauri 桌面端

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^19.0.0",
    "antd": "^5.0.0",
    "zustand": "^5.0.0"
  }
}
```

## 13. 对话流程完整示例

```
用户在桌面端输入: "你觉得我今天应该穿什么衣服呢？"

Tauri 前端 → POST http://localhost:3456/chat

Agent 后端处理:

消息列表构建:
[0] SystemMessage ← 角色设定（夏娜，傲娇... + 模块索引）
[1] HumanMessage  ← "你觉得我今天应该穿什么衣服呢？"

第 1 轮循环:
  LLM → tool_call: recall_memory("居住地")
  ToolMessage ← "北京市"

第 2 轮循环:
  LLM → tool_call: search_web("北京今天天气")
  ToolMessage ← "晴，25°C，微风"

第 3 轮循环:
  LLM → 最终回复（角色语气）:
  "哼，这种事还要问我吗？北京今天25度，穿件薄外套就行了。
   别穿得太难看给我丢脸，笨蛋。"

Tauri 前端 → 流式显示回复
```

