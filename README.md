# SoulDesk

本地运行的桌面角色扮演 AI 应用。通过 Markdown Skill 文件定义角色人格，AI 严格按照角色设定进行思考和回答。

## 功能

- **角色扮演** — 通过 SKILL.md 定义角色人格，支持多模块按需加载
- **多模型支持** — OpenAI 兼容接口（DeepSeek/豆包/Mimo 等）+ Anthropic Claude
- **三层记忆** — 短期会话上下文 + 用户模型 + FTS5 长期记忆
- **联网搜索** — AI 可搜索互联网获取实时信息（Tavily API）
- **流式对话** — 实时逐 token 流式输出
- **桌面浮窗** — 角色头像浮窗，新消息脉冲动画提醒
- **角色管理** — 导入/创建/编辑/删除角色，每个角色独立主题色和头像
- **本地优先** — 所有数据存储在用户本地，用户自备 API Key

## 架构

```
┌─────────────── Tauri 桌面端 ───────────────────┐
│                                                 │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐ │
│  │ 聊天窗口  │  │ 角色管理   │  │  设置窗口    │ │
│  └────┬─────┘  └─────┬─────┘  └──────┬──────┘ │
│       └───────────────┼───────────────┘         │
│                ┌──────▼──────┐                  │
│                │ Tauri 轻量后端│                  │
│                │ 窗口/文件/设置│                  │
│                └──────┬──────┘                  │
│                       │ HTTP                    │
└───────────────────────┼─────────────────────────┘
                        │ localhost:3456
┌───────────────────────▼─────────────────────────┐
│              Agent 后端 (Node.js)                │
│                                                 │
│  ┌──────────┐  ┌────────┐  ┌────────────────┐ │
│  │Agent     │  │Role    │  │Memory          │ │
│  │Engine    │  │Loader  │  │Manager         │ │
│  └────┬─────┘  └────┬───┘  └───────┬────────┘ │
│       └──────────────┼──────────────┘           │
│              ┌───────▼────────┐                 │
│              │  Fastify API   │                 │
│              └────────────────┘                 │
└─────────────────────────────────────────────────┘
```

| 层 | 职责 | 技术 |
|---|------|------|
| **Tauri 桌面端** | UI 渲染、窗口管理、文件操作、设置存储 | Tauri v2 + React + TypeScript |
| **Agent 后端** | Agent 循环、LLM 调用、记忆管理、角色加载 | Node.js + TypeScript |
| **通信层** | HTTP REST + SSE 流式对话 | localhost |

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React + TypeScript + Ant Design |
| 状态管理 | Zustand |
| AI 后端 | Node.js + Fastify + LangChain |
| LLM 适配 | @langchain/openai + @langchain/anthropic |
| 存储 | SQLite (better-sqlite3) + FTS5 |
| 搜索 | Tavily API |
| Markdown 解析 | gray-matter |

## 快速开始

### 前置要求

- Node.js >= 18
- Rust toolchain（用于 Tauri 编译）
- 一个 LLM API Key（OpenAI 兼容或 Anthropic）

### 安装

```bash
# 安装 Agent 后端依赖
cd soul-agent
npm install

# 安装桌面端依赖
cd ../companion-ai
npm install
```

### 运行

```bash
# 1. 启动 Agent 后端（端口 3456）
cd soul-agent
npm run dev

# 2. 另开终端，启动桌面端
cd companion-ai
npm run tauri dev
```

### 配置模型

首次启动后，在设置页面（齿轮图标）配置：

1. 选择接入模式（OpenAI 兼容 / Anthropic）
2. 填入 API Key
3. 填入 Base URL（OpenAI 兼容模式需填写，如 `https://api.deepseek.com/v1`）
4. 填入模型名称（如 `deepseek-chat` 或 `claude-sonnet-4-20250514`）

## 项目结构

```
my-side/
├── companion-ai/              # Tauri 桌面端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat/          # 聊天界面
│   │   │   ├── Floating/      # 桌面浮窗
│   │   │   └── Settings/      # 设置窗口
│   │   ├── services/          # HTTP 客户端、Tauri 桥接、主题
│   │   ├── stores/            # Zustand 状态
│   │   └── types/             # TypeScript 类型
│   └── src-tauri/src/         # Rust 后端
│       └── commands/          # 窗口、角色、设置命令
│
├── soul-agent/                # Agent 后端
│   └── src/
│       ├── agent/engine.ts    # Agent 循环核心
│       ├── tools/             # 工具注册（搜索/记忆/角色/技能）
│       ├── role/              # 角色加载、提示词构建、学习
│       ├── memory/            # 三层记忆管理
│       ├── api/server.ts      # Fastify API
│       └── db/database.ts     # SQLite
│
├── .souldesk/                 # 共享数据目录
│   ├── roles/                 # 角色 Skill 文件
│   │   ├── ashin/             # 内置角色：阿信
│   │   └── xianna/            # 示例角色：夏娜
│   ├── data.db                # SQLite 数据库
│   └── settings.json          # 应用配置
│
└── docs/                      # 设计文档
```

## 角色系统

### SKILL.md 格式

每个角色是一个目录，包含 `SKILL.md` 主文件和可选的模块文件：

```markdown
---
name: "角色名称"
version: 1.0
author: "创作者"
description: "角色简介"
theme_color: "#e94560"
avatar: "avatar.jpg"
always_load:
  - personality.md
  - speaking_style.md
---

# 角色设定

（核心 system prompt）

## 模块索引

- `module_name.md` — 当用户讨论 XXX 时查看
```

### 模块加载机制

- `always_load` 中的模块始终注入 system prompt
- 其他模块由 LLM 通过 tool calling 按需加载
- LLM 根据模块索引自主判断何时加载

### 内置角色

- **阿信** — 五月天阿信的思维框架与表达方式，日常陪伴 + 人生哲学顾问

### 创建角色

通过设置页面的"新建角色"按钮，使用 AI 辅助的对话式向导创建角色。也可以手动在 `.souldesk/roles/` 目录下创建 SKILL.md 文件。

## API

Agent 后端运行在 `http://localhost:3456`：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/roles` | 角色列表 |
| GET | `/roles/:id` | 角色详情 |
| GET | `/roles/:id/avatar` | 角色头像 |
| POST | `/chat` | 流式对话（SSE） |
| POST | `/reload` | 重新加载角色 |
| GET | `/sessions` | 会话列表 |
| GET | `/sessions/:id/messages` | 会话消息 |
| GET | `/memories` | 长期记忆列表 |
| GET | `/memories/search?q=xxx` | 搜索记忆 |
| DELETE | `/memories/:id` | 删除记忆 |
| GET | `/profile` | 用户模型 |
| POST | `/profile/update` | 更新用户模型 |

### 流式对话

```
POST /chat
Content-Type: application/json

{
  "message": "你好",
  "session_id": "uuid",
  "role_id": "ashin"
}

Response: text/event-stream

data: {"type":"token","content":"嘿"}
data: {"type":"token","content":"，"}
data: {"type":"done","content":"嘿，你好啊~"}
```

## 配置

配置存储在 `.souldesk/settings.json`：

```json
{
  "model": {
    "access_mode": "openai",
    "api_key": "sk-xxx",
    "base_url": "https://api.deepseek.com/v1",
    "model_name": "deepseek-chat"
  },
  "search": {
    "enabled": true,
    "tavily_api_key": "tvly-xxx"
  },
  "general": {
    "theme_mode": "dark",
    "floating_widget": true
  },
  "agent": {
    "port": 3456,
    "auto_start": true
  }
}
```
