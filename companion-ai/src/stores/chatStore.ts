import { create } from 'zustand';
import type { ChatMessage } from '../types';
import { streamChat } from '../services/agentClient';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
  roleId: string;
  addMessage: (msg: ChatMessage) => void;
  send: (content: string) => Promise<void>;
  setRoleId: (roleId: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  sessionId: crypto.randomUUID(),
  roleId: 'default',

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

  send: async (content: string) => {
    const { sessionId, roleId } = get();

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
      let fullContent = '';
      for await (const event of streamChat(content, sessionId, roleId)) {
        if (event.type === 'done') {
          fullContent = event.content;
        } else if (event.type === 'error') {
          console.error('Chat error:', event.content);
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: fullContent,
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

  setRoleId: (roleId: string) => set({ roleId }),

  clearMessages: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
