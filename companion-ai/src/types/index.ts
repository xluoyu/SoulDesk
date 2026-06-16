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

export interface Skill {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  system_prompt: string;
}

export interface UploadSkillRequest {
  dir_path: string;
  content: string;
}
