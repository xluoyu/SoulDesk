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
