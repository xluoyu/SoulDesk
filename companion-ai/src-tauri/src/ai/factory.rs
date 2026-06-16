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
