import { create } from 'zustand';
import type { ChatMessage, AIProviderConfig } from '../types';
import { sendMessage, switchRole } from '../services/tauriBridge';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
  skillId: string;
  providerConfig: AIProviderConfig;
  addMessage: (msg: ChatMessage) => void;
  send: (content: string) => Promise<void>;
  setProviderConfig: (config: AIProviderConfig) => void;
  switchToRole: (skillId: string) => Promise<void>;
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
  skillId: 'default',
  providerConfig: DEFAULT_CONFIG,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  send: async (content: string) => {
    const { sessionId, providerConfig } = get();

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

  switchToRole: async (skillId: string) => {
    try {
      const result = await switchRole(skillId);
      set({
        sessionId: result.session_id,
        skillId: result.skill_id,
        messages: [],
      });
    } catch (error) {
      console.error('Failed to switch role:', error);
    }
  },

  clearMessages: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
