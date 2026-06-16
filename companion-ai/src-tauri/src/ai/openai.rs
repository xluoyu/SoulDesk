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

    fn parse_sse_lines(text: &str) -> Vec<Result<ChatResponseChunk, AIError>> {
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
            if let Ok(chunk) = serde_json::from_str::<OpenAIStreamChunk>(data) {
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
        }
        results
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
        let stream = byte_stream
            .map(|chunk| match chunk {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    Self::parse_sse_lines(&text)
                }
                Err(e) => vec![Err(AIError::Stream(e.to_string()))],
            })
            .flat_map(|items| futures::stream::iter(items));

        Ok(Box::pin(stream))
    }

    fn name(&self) -> &str {
        "openai"
    }
}
