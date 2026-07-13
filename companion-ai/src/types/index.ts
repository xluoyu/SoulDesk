export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
  theme_color: string;
  avatar: string;
}
