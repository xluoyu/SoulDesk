# 桌面陪伴型AI对话应用 — 设计文档

## 一、需求概述

1. **Skill 人格模拟** — 上传 Markdown Skill 文件，AI 严格按照角色设定进行思考和回答
2. **三层记忆架构** — 短期记忆（会话上下文）、用户模型（结构化用户数据）、长期储存（LanceDB 向量存储）
3. **Web Search** — AI 可搜索网络信息以开启新话题
4. **主动推送** — 定时主动向用户发起会话（后续扩展空闲检测）
5. **角色差异化** — 不同角色有独立主题色、头像、配置
6. **自我学习** — 每天定时 webSearch 检索角色相关信息，存储到 Skill 知识库
7. **桌面浮窗** — 角色头像浮窗，新消息脉冲动画提醒，可拖拽，点击唤起会话

## 二、技术选型

| 层级    | 技术                              | 说明                               |
| ----- | ------------------------------- | -------------------------------- |
| 桌面框架  | Tauri v2                        | Rust 后端 + WebView 前端，轻量高性能，纯本地运行 |
| 前端    | React + TypeScript + Ant Design | 组件库丰富，生态成熟                       |
| 状态管理  | Zustand                         | 轻量，适合 Tauri 场景                   |
| AI 后端 | 用户可配置（Claude / OpenAI / Ollama） | 统一适配器模式                          |
| 向量存储  | LanceDB（纯 Rust 内嵌）              | 零外部依赖，包体增加 <5MB                  |
| 结构化存储 | SQLite（rusqlite）                | 内嵌数据库                            |

**纯本地架构**：所有运行数据保存在用户本地，不依赖外部后端服务。

## 三、整体架构

```
┌──────────────── Tauri WebView ────────────────────────────────┐
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ FloatingWin │    │  ChatView    │    │ SettingsWindow   │  │
│  │ (浮窗)      │    │ (会话界面)    │    │ (独立设置窗口)    │  │
│  └──────┬──────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                     │             │
│  ┌──────┴──────────────────┴─────────────────────┴──────────┐ │
│  │              Tauri IPC Bridge (invoke / emit / listen)    │ │
│  └──────────────────────────┬───────────────────────────────┘ │
└─────────────────────────────┼─────────────────────────────────┘
                              │
┌──────────────── Rust Backend (src-tauri) ─────────────────────┐
│  Tauri Commands (chat/role/memory/settings/scheduler/learning) │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │Skill     │ │Chat      │ │Memory    │ │Scheduler │        │
│  │Engine    │ │Engine    │ │Manager   │ │(Push+Learn)│      │
│  └──────────┘ └────┬─────┘ └──────────┘ └──────────┘        │
│            ┌───────┴────────────────────────┐                 │
│            │   AI Adapter Layer             │                 │
│            │  Claude │ OpenAI │ Ollama       │                 │
│            └────────────────────────────────┘                 │
│  Storage: SQLite + LanceDB (向量)                              │
└───────────────────────────────────────────────────────────────┘
```

**窗口模型：**

- **FloatingWindow** — always-on-top, transparent, frameless 小窗口（角色头像）
- **ChatView** — 主会话窗口（微信风格深色界面）
- **SettingsWindow** — 独立设置窗口

**窗口交互逻辑：**

- 浮窗点击 → 打开 ChatView，浮窗隐藏
- ChatView 关闭 → 浮窗重新出现
- 浮窗可在设置中关闭 → 通过 Dock 程序坞打开 ChatView

## 四、界面设计

### 4.1 主会话界面（微信风格深色）

```
┌──────────────────────────────────────────────┐
│ ‹  [头像] 阿信                        ⚙     │
├──────────────────────────────────────────────┤
│                 今天 09:32                   │
│                                              │
│  [头像] ┌─────────────────────┐              │
│         │ 早啊~ 最近在忙...   │              │
│         └─────────────────────┘              │
│                                              │
│         ┌─────────────────────┐  [头像]      │
│         │ 还不错！最近在学吉他 │              │
│         └─────────────────────┘              │
│                                              │
│  [头像] ┌─────────────────────┐              │
│         │ 哦？学吉他！好诶~   │              │
│         └─────────────────────┘              │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │ [头像] 阿信主动找你聊：              │     │
│  │ 今天天气不错，要不要出去走走？        │     │
│  └─────────────────────────────────────┘     │
│                                              │
├──────────────────────────────────────────────┤
│ ⊕  [输入消息...]                      [↑]   │
│   📎 附件    🔍 搜索网络    🎤 语音          │
└──────────────────────────────────────────────┘
```

- 深色主题，极简风格
- 右上角 ⚙ → 打开设置独立窗口
- 推送消息以卡片形式出现在对话流中
- "已搜索"标识（触发 Web Search 时显示）

### 4.2 桌面浮窗

三种状态：

| 状态  | 外观           | 交互       |
| --- | ------------ | -------- |
| 待机  | 角色头像圆形浮窗，带阴影 | 可自由拖拽    |
| 新消息 | 脉冲动画环 + 红点角标 | 悬停显示消息预览 |
| 悬停  | 消息预览气泡       | 点击打开会话界面 |

**技术实现：** Tauri 独立窗口，always-on-top + transparent + frameless

### 4.3 设置窗口（独立）

| Tab  | 内容                        |
| ---- | ------------------------- |
| 角色管理 | 当前角色详情、切换角色、导入新角色、删除角色    |
| 模型配置 | AI 提供商列表、API 密钥、默认模型、参数调节 |
| 推送设置 | 推送开关、间隔时间、免打扰时段、浮窗开关      |
| 记忆管理 | 查看用户画像摘要、清空历史记忆           |
| 关于   | 版本信息、数据目录位置               |

角色切换时：保存当前会话 → 新建会话 → 窗口主题色跟随新角色自动切换。

## 五、Skill 格式设计

### 5.1 Skill 目录结构

```
skills/
├── ashin-perspective/
│   ├── skill.json              # 元数据（角色配置、主题、AI参数）
│   ├── SKILL.md                # 主入口（激活规则、路由表）
│   ├── references/
│   │   ├── modules/            # 模块化内容（按需加载）
│   │   ├── research/           # 研究素材
│   │   └── quotes.md           # 语录库
│   ├── templates/              # 推送模板
│   │   ├── greetings/
│   │   ├── care/
│   │   └── knowledge/
│   └── learnings/              # 自我学习产出
│       └── 2026-06-15.md
├── life-assistant/
│   ├── skill.json
│   ├── SKILL.md
│   └── templates/
└── productivity-mentor/
    ├── skill.json
    ├── SKILL.md
    └── templates/
```

### 5.2 skill.json

```json
{
  "id": "ashin-perspective",
  "name": "阿信",
  "description": "五月天阿信（陈信宏）的思维框架与表达方式",
  "version": 1,
  "tags": ["companion", "philosophy", "music"],
  "trigger_words": ["阿信", "ashin", "五月天"],

  "theme": {
    "primary_color": "#e94560",
    "secondary_color": "#1a1a2e",
    "background": "#0f0f1a",
    "avatar": "assets/avatar.png",
    "font_family": "Noto Sans SC"
  },

  "ai_config": {
    "preferred_model": null,
    "temperature": 0.8,
    "max_tokens": 2048
  },

  "behavior": {
    "daily_mode_enabled": true,
    "deep_mode_enabled": true,
    "max_response_length": 200,
    "web_search_enabled": true
  },

  "self_learning": {
    "enabled": true,
    "search_interval_hours": 24,
    "search_queries": ["五月天 最新动态", "阿信 近期活动"],
    "knowledge_categories": ["活动", "作品", "言论"]
  },

  "modules": {
    "directory": "references/modules",
    "routing_table": {
      "日常闲聊": ["01-daily-persona.md"],
      "粉丝文化": ["02-fan-culture.md"],
      "人生困惑": ["03-mental-models.md", "05-expression-dna.md"]
    }
  }
}
```

## 六、数据结构设计

### 6.1 Rust 核心结构

```rust
// Skill
pub struct SkillMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub theme: ThemeConfig,
    pub ai_config: SkillAIConfig,
    pub behavior: SkillBehavior,
    pub self_learning: SelfLearningConfig,
    pub modules: ModuleConfig,
}

pub struct ThemeConfig {
    pub primary_color: String,
    pub secondary_color: String,
    pub background: String,
    pub avatar: Option<String>,
    pub font_family: Option<String>,
}

// 消息
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: Role,
    pub content: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: Option<MessageMetadata>,
}

pub enum Role { User, Assistant, System }

// 会话
pub struct Session {
    pub id: String,
    pub skill_id: String,
    pub title: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub message_count: u32,
}

// 用户模型（分层）
pub struct UserProfile {
    pub id: String,
    pub name: Option<String>,
    pub core: UserCore,           // 核心层：每次固定注入
    pub details: UserDetails,     // 详细层：按相关性注入
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub struct UserCore {
    pub communication_style: String,  // 沟通风格（1-2句）
    pub personality_keywords: Vec<String>, // 性格关键词
}

pub struct UserDetails {
    pub preferred_topics: Vec<String>,
    pub habit_summary: Option<String>,
    pub personality_traits: Vec<String>,
}

// AI Provider
pub struct AIProviderConfig {
    pub provider_type: ProviderType,
    pub api_key: Option<String>,
    pub base_url: String,
    pub default_model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

pub enum ProviderType { Claude, OpenAI, Ollama, Custom }

// 记忆检索结果
pub struct MemoryRetrieval {
    pub short_term: Vec<Message>,
    pub user_model_core: String,      // 核心层：固定注入
    pub user_model_details: String,    // 详细层：按相关性注入
    pub long_term: Vec<MemoryChunk>,
}

pub struct MemoryChunk {
    pub id: String,
    pub content: String,
    pub similarity: f32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

// 自我学习记录
pub struct LearningRecord {
    pub id: String,
    pub skill_id: String,
    pub date: chrono::NaiveDate,
    pub query: String,
    pub findings: Vec<String>,
    pub impact: String,
    pub raw_content: String,
}

// 推送内容
pub struct PushContent {
    pub content_type: PushContentType,
    pub text: String,
    pub source: Option<String>,
}

pub enum PushContentType {
    Template,    // 模板生成
    AI,          // AI 生成
}
```

### 6.2 SQLite 表结构

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    message_count INTEGER DEFAULT 0
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT,
    is_push BOOLEAN DEFAULT FALSE,
    metadata_json TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    dir_path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    meta_json TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL
);

CREATE TABLE user_profile (
    id TEXT PRIMARY KEY,
    name TEXT,
    core_json TEXT NOT NULL,
    details_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE ai_providers (
    id TEXT PRIMARY KEY,
    provider_type TEXT NOT NULL,
    api_key_encrypted TEXT,
    base_url TEXT NOT NULL,
    default_model TEXT NOT NULL,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    is_enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE learnings (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    date TEXT NOT NULL,
    query TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    impact TEXT,
    raw_content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## 七、关键模块实现方案

### 7.1 推送内容生成（混合策略）

| 场景   | 触发条件          | 生成方式           |
| ---- | ------------- | -------------- |
| 日常问候 | 每天首次打开 / 定时推送 | 模板库随机 + 角色语气微调 |
| 空闲关怀 | 用户超时未使用       | 模板库随机          |
| 知识分享 | 自我学习后有新发现     | 模板 + 学习内容填充    |
| 特殊时机 | 用户生日、纪念日      | AI 完整生成        |
| 主动话题 | 角色有新动态时       | AI 基于学习内容生成    |

模板结构：

```
skills/{role}/templates/
├── greetings/morning.md, afternoon.md, evening.md
├── care/long-time-no-see.md, holiday.md
└── knowledge/new-discovery.md
```

### 7.2 对话中 Web Search

触发判断：

1. 用户明确要求搜索 → 直接执行
2. 涉及事实性问题（事件/人物/数据/新闻）→ AI 自主判断是否需要搜索
3. 闲聊/情感/哲学类 → 直接回答

搜索 API：Tavily（结构化结果）
搜索结果作为 system context 注入，AI 基于结果回答，前端可选显示"已搜索"标识。

### 7.3 用户模型更新（分层注入）

**更新时机：** 每 10 条对话后异步触发

**分层注入规则：**

| 层级  | 内容               | 注入方式           |
| --- | ---------------- | -------------- |
| 核心层 | 沟通风格、性格关键词（1-2句） | 每次固定注入         |
| 详细层 | 偏好话题、习惯摘要、性格特征   | 根据当前对话相关性选择性注入 |

判断逻辑：当前输入做关键词/语义匹配 → 匹配到相关偏好 → 注入该部分。

### 7.4 记忆注入策略

| 记忆层     | 注入方式  | 注入位置          | 数量        |
| ------- | ----- | ------------- | --------- |
| 短期记忆    | 固定注入  | messages 数组末尾 | 最近 20 条   |
| 用户模型核心层 | 固定注入  | system prompt | 每次注入      |
| 用户模型详细层 | 选择性注入 | system prompt | 按相关性      |
| 长期记忆    | 选择性注入 | system prompt | Top-5 相关性 |

最终消息数组结构：

```
[system] 角色设定 + 模块路由 + 自我学习知识
[system] [用户画像-核心] {core}
[system] [用户画像-详情] {details}（按相关性）
[system] [相关历史记忆] {long_term memories}
[system] 相关模块内容（按需加载）
[user/assistant] 短期记忆（最近 20 条）
[user] 当前输入
```

### 7.5 自我学习 Pipeline

静默学习，用户无感知：

1. 定时触发（每 24 小时）
2. 按 skill.json 中的 search\_queries 搜索
3. AI 分析搜索结果，提取与角色相关的新信息
4. 保存到 `learnings/` 目录
5. 向量化写入 LanceDB
6. 下次对话时自动加载最新学习到 system prompt

### 7.6 AI Adapter Layer

统一 trait + 枚举分发：

```rust
#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponseStream, AIError>;
    fn name(&self) -> &str;
}

pub struct ClaudeAdapter { config: AIProviderConfig }
pub struct OpenAIAdapter { config: AIProviderConfig }
pub struct OllamaAdapter { config: AIProviderConfig }
```

### 7.7 桌面浮窗（Tauri 多窗口）

```rust
// 浮窗窗口配置
WindowBuilder::new(app, "floating", WindowUrl::App("floating".into()))
    .inner_size(80.0, 80.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    .build()?;

// 拖拽：前端通过 mousedown/mousemove 事件实现
// 点击：打开 ChatView 窗口，隐藏浮窗
// 关闭 ChatView：显示浮窗
```

### 7.8 Chat Engine（对话编排核心）

```rust
impl ChatEngine {
    pub async fn handle_message(&self, session_id: &str, user_input: &str, skill_id: &str, app_handle: &AppHandle) -> Result<(), ChatError> {
        // 1. 获取 Skill system prompt
        let skill = self.skill_engine.get_skill(skill_id)?;
        let mut messages = vec![ChatMessage { role: "system".into(), content: skill.system_prompt }];

        // 2. 按需加载模块
        let modules = self.resolve_modules(&skill, user_input);
        for module in modules {
            messages.push(ChatMessage { role: "system".into(), content: module });
        }

        // 3. 构建记忆上下文（分层注入）
        let memory_ctx = self.memory.build_context(session_id, user_input, 20).await?;
        messages.push(ChatMessage { role: "system".into(), content: format!("[用户画像]\n{}", memory_ctx.user_model_core) });
        if !memory_ctx.user_model_details.is_empty() {
            messages.push(ChatMessage { role: "system".into(), content: memory_ctx.user_model_details });
        }
        if !memory_ctx.long_term.is_empty() {
            // 注入 Top-5 相关历史
        }
        for msg in memory_ctx.short_term {
            messages.push(ChatMessage { role: msg.role, content: msg.content });
        }

        // 4. 判断是否需要 Web Search
        if self.should_search(user_input, &skill) {
            let search_results = self.search_client.search(user_input).await?;
            messages.push(ChatMessage { role: "system".into(), content: format!("[搜索结果]\n{}", search_results) });
        }

        // 5. 调用 AI（流式）
        messages.push(ChatMessage { role: "user".into(), content: user_input });
        let stream = provider.chat(ChatRequest { messages, stream: true }).await?;

        // 6. 流式推送前端
        // 7. 存储到记忆系统（SQLite + LanceDB）
        Ok(())
    }
}
```

## 八、项目目录结构

```
companion-ai/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/                              # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatView.tsx          # 主会话界面（微信风格深色）
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   ├── StreamingText.tsx
│   │   │   └── PushCard.tsx          # 推送消息卡片
│   │   ├── Floating/
│   │   │   └── FloatingWidget.tsx    # 桌面浮窗组件
│   │   └── Settings/
│   │       ├── SettingsWindow.tsx    # 独立设置窗口
│   │       ├── RoleManager.tsx
│   │       ├── ProviderConfig.tsx
│   │       ├── PushSettings.tsx
│   │       └── MemoryView.tsx
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useMemory.ts
│   │   ├── usePushListener.ts
│   │   └── useSettings.ts
│   ├── stores/
│   │   ├── chatStore.ts
│   │   ├── roleStore.ts
│   │   └── settingsStore.ts
│   ├── services/
│   │   └── tauriBridge.ts
│   ├── types/
│   │   └── index.ts
│   └── styles/
│       └── global.css
├── src-tauri/                        # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── chat.rs
│       │   ├── role.rs
│       │   ├── memory.rs
│       │   ├── settings.rs
│       │   ├── scheduler.rs
│       │   └── learning.rs
│       ├── ai/
│       │   ├── mod.rs
│       │   ├── claude.rs
│       │   ├── openai.rs
│       │   ├── ollama.rs
│       │   └── factory.rs
│       ├── skill/
│       │   ├── mod.rs
│       │   ├── parser.rs
│       │   └── prompt_builder.rs
│       ├── chat/
│       │   ├── mod.rs
│       │   └── engine.rs
│       ├── memory/
│       │   ├── mod.rs
│       │   ├── manager.rs
│       │   ├── sqlite_store.rs
│       │   ├── lancedb_store.rs
│       │   └── user_model.rs
│       ├── search/
│       │   ├── mod.rs
│       │   └── client.rs
│       ├── scheduler/
│       │   ├── mod.rs
│       │   └── push.rs
│       ├── learning/
│       │   ├── mod.rs
│       │   └── pipeline.rs
│       ├── window/
│       │   ├── mod.rs
│       │   └── floating.rs
│       └── db/
│           ├── mod.rs
│           ├── schema.sql
│           └── migrations.rs
├── skills/                           # 内置 Skill
│   └── ashin-perspective/
│       ├── skill.json
│       ├── SKILL.md
│       ├── references/modules/
│       ├── templates/
│       └── learnings/
└── README.md
```

## 九、Cargo.toml 关键依赖

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
lancedb = "0.13"
reqwest = { version = "0.12", features = ["json", "stream"] }
reqwest-eventsource = "0.6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
async-trait = "0.1"
futures = "0.3"
anyhow = "1"
thiserror = "2"
log = "0.4"
env_logger = "0.11"
```

## 十、实现步骤

### 阶段一：项目骨架与基础对话（第1-2周）

| 步骤  | 任务                                             | 产出              |
| --- | ---------------------------------------------- | --------------- |
| 1.1 | create-tauri-app 初始化，React + Vite + TypeScript | 可运行的空壳应用        |
| 1.2 | SQLite 建表                                      | 数据库就绪           |
| 1.3 | AI Adapter trait + OpenAIAdapter               | 能调用 OpenAI API  |
| 1.4 | ChatEngine 最小版本                                | 前端→Rust→AI→流式返回 |
| 1.5 | 前端 ChatView（微信风格深色）                            | 能对话的最小产品        |
| 1.6 | Ant Design 主题配置                                | 统一视觉风格          |

### 阶段二：桌面浮窗 + 窗口管理（第2-3周）

| 步骤  | 任务                                  | 产出      |
| --- | ----------------------------------- | ------- |
| 2.1 | Tauri 多窗口：FloatingWindow + ChatView | 双窗口可切换  |
| 2.2 | 浮窗：透明、always-on-top、可拖拽             | 浮窗可交互   |
| 2.3 | 浮窗动画：脉冲环 + 红点角标                     | 新消息提醒   |
| 2.4 | 浮窗↔会话切换逻辑                           | 点击/关闭联动 |

### 阶段三：Skill 系统（第3-4周）

| 步骤  | 任务                                                      | 产出        |
| --- | ------------------------------------------------------- | --------- |
| 3.1 | SkillEngine：解析 skill.json + SKILL.md + 模块路由             | 能加载 Skill |
| 3.2 | Tauri commands: import\_role, list\_roles, switch\_role | 角色 CRUD   |
| 3.3 | 前端 SettingsWindow（独立窗口）                                 | 可视化管理     |
| 3.4 | 角色切换：保存会话 + 新建会话 + 主题切换                                 | 多角色支持     |
| 3.5 | 内置 ashin-perspective Skill                              | 开箱即用      |

### 阶段四：三层记忆系统（第4-5周）

| 步骤  | 任务                              | 产出       |
| --- | ------------------------------- | -------- |
| 4.1 | 短期记忆：SQLite 存取最近 N 条            | 上下文连贯    |
| 4.2 | LanceDB 集成：消息向量化存储              | 长期记忆可检索  |
| 4.3 | Embedding 分层：Ollama 本地 → OpenAI | 多级降级     |
| 4.4 | 长期记忆检索：相似度 top-K + 时间衰减         | 历史对话召回   |
| 4.5 | 用户模型：分层更新（核心层+详细层）              | 用户画像自动更新 |

### 阶段五：主动推送 + 多提供商（第5-6周）

| 步骤  | 任务                            | 产出     |
| --- | ----------------------------- | ------ |
| 5.1 | PushScheduler 定时触发            | 后台定时推送 |
| 5.2 | 推送模板库                         | 模板生成内容 |
| 5.3 | 前端 PushCard + 系统通知            | 推送可视化  |
| 5.4 | PushSettings：间隔、免打扰、浮窗开关      | 用户可控   |
| 5.5 | ClaudeAdapter + OllamaAdapter | 多模型可用  |

### 阶段六：自我学习 + 搜索集成（第6-7周）

| 步骤  | 任务                              | 产出       |
| --- | ------------------------------- | -------- |
| 6.1 | SearchClient（Tavily）            | AI 可搜索网络 |
| 6.2 | 对话中 Web Search 触发逻辑             | 智能搜索     |
| 6.3 | SelfLearningPipeline：定时搜索→分析→沉淀 | 自我学习闭环   |
| 6.4 | 学习记录写入 + 向量化                    | 知识可检索    |
| 6.5 | ChatEngine 加载学习产出到 prompt       | 新知识参与对话  |

### 阶段七：打磨与发布（第7-8周）

| 步骤  | 任务      | 产出         |
| --- | ------- | ---------- |
| 7.1 | 错误处理与降级 | 健壮性        |
| 7.2 | 系统通知栏集成 | 应用最小化也能收推送 |
| 7.3 | 全局快捷键   | 便捷交互       |
| 7.4 | 打包发布配置  | 可分发安装包     |

## 十一、关键设计决策

| 决策点        | 方案                 | 理由              |
| ---------- | ------------------ | --------------- |
| 向量存储       | LanceDB（纯 Rust）    | 零外部依赖，包体增加 <5MB |
| Embedding  | Ollama 本地 → OpenAI | 零成本优先           |
| 推送内容       | 混合策略（模板+AI）        | 平衡成本和个性化        |
| 用户模型       | 分层注入（核心+详细）        | 节省 token，按需注入   |
| 记忆注入       | 短期固定 + 长期/用户模型选择性  | 平衡连贯性和效率        |
| 桌面浮窗       | Tauri 独立窗口         | 原生支持，性能好        |
| 设置界面       | 独立窗口               | 与对话分离，专注体验      |
| 自我学习       | 静默学习               | 不打扰用户           |
| Web Search | AI 自主判断 + 用户可控     | 兼顾智能和可控         |

