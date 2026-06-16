# Companion AI — Phase 1: Project Skeleton + Basic Chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Tauri v2 + React app with SQLite, a working OpenAI chat adapter, and a dark WeChat-style chat UI that can send/receive messages with streaming.

**Architecture:** Tauri v2 with React/Vite frontend. Rust backend handles AI API calls and SQLite. Frontend is a single chat window with message bubbles and streaming text. No memory, no Skill system, no push — just raw chat to prove the pipeline works end-to-end.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite, Ant Design, SQLite (rusqlite), reqwest, reqwest-eventsource, serde

---

## File Map

| File | Responsibility |
|------|---------------|
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/tauri.conf.json` | Tauri window config (single chat window) |
| `src-tauri/src/main.rs` | Tauri entry point |
| `src-tauri/src/lib.rs` | Tauri builder + command registration |
| `src-tauri/src/db/mod.rs` | SQLite init + schema |
| `src-tauri/src/db/schema.sql` | Table definitions |
| `src-tauri/src/ai/mod.rs` | AIProvider trait + types |
| `src-tauri/src/ai/openai.rs` | OpenAI adapter (streaming) |
| `src-tauri/src/ai/factory.rs` | Provider factory |
| `src-tauri/src/commands/chat.rs` | send_message Tauri command |
| `src-tauri/src/commands/mod.rs` | Command module index |
| `src/main.tsx` | React entry |
| `src/App.tsx` | Root component |
| `src/types/index.ts` | TypeScript types |
| `src/services/tauriBridge.ts` | Tauri invoke wrappers |
| `src/stores/chatStore.ts` | Chat state (Zustand) |
| `src/components/Chat/ChatView.tsx` | Main chat UI |
| `src/components/Chat/MessageBubble.tsx` | Single message bubble |
| `src/components/Chat/MessageInput.tsx` | Input box |
| `src/components/Chat/StreamingText.tsx` | Streaming text renderer |
| `src/styles/global.css` | Dark theme styles |

---

## Task 1: Scaffold Tauri v2 Project

**Files:**
- Create: entire project via `create-tauri-app`

- [ ] **Step 1: Initialize Tauri project**

```bash
cd /Users/changjia/Desktop/my/side
npm create tauri-app@latest companion-ai -- --template react-ts
cd companion-ai
```

Select: React + TypeScript

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install antd @ant-design/icons zustand
```

- [ ] **Step 3: Verify project runs**

```bash
npm run tauri dev
```

Expected: A blank window appears with "Welcome to Tauri + React"

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri v2 + React project"
```

---

## Task 2: SQLite Database Setup

**Files:**
- Create: `src-tauri/src/db/schema.sql`
- Create: `src-tauri/src/db/mod.rs`
- Modify: `src-tauri/Cargo.toml` (add rusqlite)

- [ ] **Step 1: Add rusqlite dependency**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
rusqlite = { version = "0.31", features = ["bundled"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "2"
```

- [ ] **Step 2: Create schema.sql**

Create `src-tauri/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL DEFAULT 'default',
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT,
    is_push INTEGER DEFAULT 0,
    metadata_json TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

- [ ] **Step 3: Create db/mod.rs**

Create `src-tauri/src/db/mod.rs`:

```rust
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
```

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add SQLite database with schema"
```

---

## Task 3: AI Provider Trait + OpenAI Adapter

**Files:**
- Create: `src-tauri/src/ai/mod.rs`
- Create: `src-tauri/src/ai/openai.rs`
- Create: `src-tauri/src/ai/factory.rs`
- Modify: `src-tauri/Cargo.toml` (add reqwest, reqwest-eventsource, async-trait, futures)

- [ ] **Step 1: Add dependencies**

Add to `src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
reqwest-eventsource = "0.6"
async-trait = "0.1"
futures = "0.3"
```

- [ ] **Step 2: Create ai/mod.rs with trait and types**

Create `src-tauri/src/ai/mod.rs`:

```rust
pub mod factory;
pub mod openai;

use async_trait::async_trait;
use futures::stream::BoxStream;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AIError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Stream error: {0}")]
    Stream(String),
    #[error("Config error: {0}")]
    Config(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub stream: bool,
}

#[derive(Debug, Clone)]
pub struct ChatResponseChunk {
    pub delta: String,
    pub finish_reason: Option<String>,
}

pub type ChatResponseStream = BoxStream<'static, Result<ChatResponseChunk, AIError>>;

#[async_trait]
pub trait AIProvider: Send + Sync {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponseStream, AIError>;
    fn name(&self) -> &str;
}
```

- [ ] **Step 3: Create OpenAI adapter**

Create `src-tauri/src/ai/openai.rs`:

```rust
use super::{AIError, AIProvider, ChatRequest, ChatResponseChunk, ChatResponseStream};
use async_trait::async_trait;
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct OpenAIAdapter {
    api_key: String,
    base_url: String,
    client: Client,
}

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<super::ChatMessage>,
    temperature: f32,
    max_tokens: u32,
    stream: bool,
}

#[derive(Deserialize)]
struct OpenAIStreamChunk {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    delta: Option<OpenAIDelta>,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIDelta {
    content: Option<String>,
}

impl OpenAIAdapter {
    pub fn new(api_key: String, base_url: String) -> Self {
        Self {
            api_key,
            base_url,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl AIProvider for OpenAIAdapter {
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponseStream, AIError> {
        let body = OpenAIRequest {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            stream: true,
        };

        let response = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AIError::Config(format!("API error {}: {}", status, text)));
        }

        let byte_stream = response.bytes_stream();
        let stream = byte_stream.filter_map(|chunk| async move {
            match chunk {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let mut results = Vec::new();
                    for line in text.lines() {
                        let line = line.trim();
                        if line.is_empty() || !line.starts_with("data: ") {
                            continue;
                        }
                        let data = &line[6..];
                        if data == "[DONE]" {
                            results.push(Ok(ChatResponseChunk {
                                delta: String::new(),
                                finish_reason: Some("stop".into()),
                            }));
                            continue;
                        }
                        match serde_json::from_str::<OpenAIStreamChunk>(data) {
                            Ok(chunk) => {
                                if let Some(choice) = chunk.choices.first() {
                                    let delta = choice
                                        .delta
                                        .as_ref()
                                        .and_then(|d| d.content.clone())
                                        .unwrap_or_default();
                                    results.push(Ok(ChatResponseChunk {
                                        delta,
                                        finish_reason: choice.finish_reason.clone(),
                                    }));
                                }
                            }
                            Err(_) => continue,
                        }
                    }
                    futures::stream::iter(results).left_stream()
                }
                Err(e) => futures::stream::once(async move {
                    Err(AIError::Stream(e.to_string()))
                })
                .left_stream(),
            }
        });

        Ok(Box::pin(stream))
    }

    fn name(&self) -> &str {
        "openai"
    }
}
```

- [ ] **Step 4: Create factory**

Create `src-tauri/src/ai/factory.rs`:

```rust
use super::{openai::OpenAIAdapter, AIError, AIProvider};
use std::sync::Arc;

pub fn create_provider(
    provider_type: &str,
    api_key: &str,
    base_url: &str,
) -> Result<Arc<dyn AIProvider>, AIError> {
    match provider_type {
        "openai" | "custom" => Ok(Arc::new(OpenAIAdapter::new(
            api_key.to_string(),
            base_url.to_string(),
        ))),
        _ => Err(AIError::Config(format!(
            "Unknown provider: {}",
            provider_type
        ))),
    }
}
```

- [ ] **Step 5: Create ai/mod.rs module index**

Update `src-tauri/src/ai/mod.rs` — add at the top of the file if not already present, or ensure the module declarations exist. The file already defines the trait; the `pub mod` declarations at the top handle sub-modules.

- [ ] **Step 6: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src-tauri/
git commit -m "feat: add AI provider trait and OpenAI streaming adapter"
```

---

## Task 4: Tauri Command — send_message

**Files:**
- Create: `src-tauri/src/commands/chat.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create commands/mod.rs**

Create `src-tauri/src/commands/mod.rs`:

```rust
pub mod chat;
```

- [ ] **Step 2: Create commands/chat.rs**

Create `src-tauri/src/commands/chat.rs`:

```rust
use crate::ai::{ChatMessage, ChatRequest};
use crate::ai::factory::create_provider;
use crate::db::Database;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub session_id: String,
    pub content: String,
    pub provider_type: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Serialize)]
pub struct SendMessageResponse {
    pub message_id: String,
    pub content: String,
}

#[tauri::command]
pub async fn send_message(
    request: SendMessageRequest,
    db: State<'_, Arc<Database>>,
) -> Result<SendMessageResponse, String> {
    // 1. Save user message
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?1, ?2, 'user', ?3, ?4)",
            rusqlite::params![user_msg_id, request.session_id, request.content, now],
        )
        .map_err(|e| e.to_string())?;
    }

    // 2. Load recent messages for context
    let messages = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT 20")
            .map_err(|e| e.to_string())?;
        let rows: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![request.session_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows.into_iter().rev().map(|(role, content)| ChatMessage { role, content }).collect::<Vec<_>>()
    };

    // 3. Call AI
    let provider = create_provider(&request.provider_type, &request.api_key, &request.base_url)
        .map_err(|e| e.to_string())?;

    let chat_request = ChatRequest {
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: true,
    };

    let mut stream = provider.chat(chat_request).await.map_err(|e| e.to_string())?;
    let mut full_response = String::new();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(c) => {
                full_response.push_str(&c.delta);
                if c.finish_reason.is_some() {
                    break;
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    // 4. Save assistant message
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?1, ?2, 'assistant', ?3, ?4)",
            rusqlite::params![assistant_msg_id, request.session_id, full_response, now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(SendMessageResponse {
        message_id: assistant_msg_id,
        content: full_response,
    })
}
```

- [ ] **Step 3: Update lib.rs to register commands**

Replace `src-tauri/src/lib.rs` with:

```rust
mod ai;
mod commands;
mod db;

use db::Database;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("companion-ai")
        .join("data.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).ok();

    let database = Arc::new(Database::new(db_path.to_str().unwrap()).expect("Failed to init DB"));

    tauri::Builder::default()
        .manage(database)
        .invoke_handler(tauri::generate_handler![commands::chat::send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Add dirs dependency**

Add to `src-tauri/Cargo.toml`:

```toml
dirs = "5"
```

- [ ] **Step 5: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/
git commit -m "feat: add send_message Tauri command with streaming"
```

---

## Task 5: Frontend Types + Tauri Bridge

**Files:**
- Create: `src/types/index.ts`
- Create: `src/services/tauriBridge.ts`

- [ ] **Step 1: Create TypeScript types**

Create `src/types/index.ts`:

```typescript
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  is_push?: boolean;
}

export interface SendMessageRequest {
  session_id: string;
  content: string;
  provider_type: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface SendMessageResponse {
  message_id: string;
  content: string;
}

export interface AIProviderConfig {
  provider_type: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
}
```

- [ ] **Step 2: Create Tauri bridge**

Create `src/services/tauriBridge.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { SendMessageRequest, SendMessageResponse } from '../types';

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  return await invoke<SendMessageResponse>('send_message', { request });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/ src/services/
git commit -m "feat: add TypeScript types and Tauri bridge"
```

---

## Task 6: Chat Store (Zustand)

**Files:**
- Create: `src/stores/chatStore.ts`

- [ ] **Step 1: Create chat store**

Create `src/stores/chatStore.ts`:

```typescript
import { create } from 'zustand';
import type { ChatMessage, AIProviderConfig } from '../types';
import { sendMessage } from '../services/tauriBridge';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
  providerConfig: AIProviderConfig;
  addMessage: (msg: ChatMessage) => void;
  send: (content: string) => Promise<void>;
  setProviderConfig: (config: AIProviderConfig) => void;
  clearMessages: () => void;
}

const DEFAULT_CONFIG: AIProviderConfig = {
  provider_type: 'openai',
  api_key: '',
  base_url: 'https://api.openai.com',
  model: 'gpt-4o',
  temperature: 0.7,
  max_tokens: 2048,
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  sessionId: crypto.randomUUID(),
  providerConfig: DEFAULT_CONFIG,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  send: async (content: string) => {
    const { sessionId, providerConfig, messages } = get();

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
    }));

    try {
      const response = await sendMessage({
        session_id: sessionId,
        content,
        ...providerConfig,
      });

      const assistantMsg: ChatMessage = {
        id: response.message_id,
        session_id: sessionId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isLoading: false });
    }
  },

  setProviderConfig: (config) => set({ providerConfig: config }),
  clearMessages: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/
git commit -m "feat: add chat store with Zustand"
```

---

## Task 7: Chat UI Components

**Files:**
- Create: `src/components/Chat/MessageBubble.tsx`
- Create: `src/components/Chat/MessageInput.tsx`
- Create: `src/components/Chat/StreamingText.tsx`
- Create: `src/components/Chat/ChatView.tsx`
- Create: `src/styles/global.css`

- [ ] **Step 1: Create global dark theme CSS**

Create `src/styles/global.css`:

```css
:root {
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-bubble-assistant: rgba(255, 255, 255, 0.06);
  --bg-bubble-user: #e94560;
  --text-primary: rgba(255, 255, 255, 0.85);
  --text-secondary: rgba(255, 255, 255, 0.4);
  --text-muted: rgba(255, 255, 255, 0.2);
  --accent: #e94560;
  --border: rgba(255, 255, 255, 0.06);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  overflow: hidden;
}

#root {
  height: 100vh;
}
```

- [ ] **Step 2: Create MessageBubble**

Create `src/components/Chat/MessageBubble.tsx`:

```tsx
import React from 'react';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
}

const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginBottom: 14,
        alignItems: 'flex-start',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e94560, #c23152)',
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ maxWidth: '72%' }}>
        <div
          style={{
            background: isUser ? 'var(--bg-bubble-user)' : 'var(--bg-bubble-assistant)',
            borderRadius: isUser ? '14px 2px 14px 14px' : '2px 14px 14px 14px',
            padding: '10px 14px',
            color: isUser ? 'white' : 'var(--text-primary)',
            lineHeight: 1.55,
            fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>
        <div
          style={{
            color: 'var(--text-muted)',
            fontSize: 9,
            marginTop: 4,
            paddingLeft: isUser ? 0 : 4,
            paddingRight: isUser ? 4 : 0,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {time}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
```

- [ ] **Step 3: Create MessageInput**

Create `src/components/Chat/MessageInput.tsx`:

```tsx
import React, { useState } from 'react';

interface Props {
  onSend: (content: string) => void;
  disabled: boolean;
}

const MessageInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: '10px 14px',
          color: 'var(--text-primary)',
          fontSize: 13,
          outline: 'none',
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="输入消息..."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        />
      </div>
      <div
        onClick={handleSend}
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: disabled ? '#666' : 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 15,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        ↑
      </div>
    </div>
  );
};

export default MessageInput;
```

- [ ] **Step 4: Create ChatView**

Create `src/components/Chat/ChatView.tsx`:

```tsx
import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatView: React.FC = () => {
  const { messages, isLoading, send } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e94560, #c23152)',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
            Companion AI
          </div>
        </div>
        <div
          style={{
            color: 'var(--text-secondary)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ⚙
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              marginTop: '30vh',
              fontSize: 14,
            }}
          >
            开始对话吧~
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e94560, #c23152)',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                background: 'var(--bg-bubble-assistant)',
                borderRadius: '2px 14px 14px 14px',
                padding: '10px 14px',
                color: 'var(--text-secondary)',
                fontSize: 13,
              }}
            >
              思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={send} disabled={isLoading} />
    </div>
  );
};

export default ChatView;
```

- [ ] **Step 5: Update App.tsx**

Replace `src/App.tsx`:

```tsx
import ChatView from './components/Chat/ChatView';
import './styles/global.css';

function App() {
  return <ChatView />;
}

export default App;
```

- [ ] **Step 6: Update main.tsx if needed**

Ensure `src/main.tsx` renders App correctly (default template should work).

- [ ] **Step 7: Verify app runs**

```bash
npm run tauri dev
```

Expected: Dark chat window appears. Type a message, press Enter. If API key is configured, get a streaming response.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add dark WeChat-style chat UI with streaming"
```

---

## Task 8: End-to-End Test

- [ ] **Step 1: Configure API key for testing**

Set environment variable or hardcode temporarily in `chatStore.ts`:
```typescript
api_key: 'sk-your-test-key',
```

- [ ] **Step 2: Run app and test chat flow**

```bash
npm run tauri dev
```

Test:
1. Type "Hello" → press Enter → see user message appear
2. Wait for streaming response → see assistant message appear
3. Type another message → verify context is maintained (last 20 messages sent to API)

- [ ] **Step 3: Verify SQLite persistence**

Close app, reopen, check if messages are loaded (currently messages load from API context but not from DB on startup — this is expected for Phase 1).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end chat flow adjustments"
```

---

## Phase 1 Complete

**What works:**
- Tauri v2 app with React + TypeScript
- SQLite database with sessions and messages tables
- OpenAI-compatible streaming adapter
- Dark WeChat-style chat UI
- Send/receive messages with streaming
- Messages persisted to SQLite

**What's next (Phase 2):** Desktop floating widget + multi-window management
