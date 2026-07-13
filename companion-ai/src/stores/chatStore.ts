import { create } from 'zustand';
import type { ChatMessage } from '../types';
import { streamChat } from '../services/agentClient';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  streamingMsgId: string | null;
  sessionId: string;
  roleId: string;
  roleThemeColor: string;
  roleAvatar: string;
  roleName: string;
  addMessage: (msg: ChatMessage) => void;
  send: (content: string) => Promise<void>;
  setRoleId: (roleId: string) => void;
  setRoleInfo: (info: { theme_color?: string; avatar?: string; name?: string }) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  streamingContent: '',
  streamingMsgId: null,
  sessionId: crypto.randomUUID(),
  roleId: 'default',
  roleThemeColor: '#e94560',
  roleAvatar: '',
  roleName: 'Companion AI',

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
    const streamingId = crypto.randomUUID();
    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
      streamingContent: '',
      streamingMsgId: streamingId,
    }));

    try {
      let fullContent = '';
      for await (const event of streamChat(content, sessionId, roleId)) {
        if (event.type === 'token') {
          fullContent += event.content;
          set({ streamingContent: fullContent });
        } else if (event.type === 'done') {
          fullContent = event.content;
        } else if (event.type === 'error') {
          console.error('Chat error:', event.content);
        }
      }

      const assistantMsg: ChatMessage = {
        id: streamingId,
        session_id: sessionId,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({
        messages: [...state.messages, assistantMsg],
        isLoading: false,
        streamingContent: '',
        streamingMsgId: null,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isLoading: false, streamingContent: '', streamingMsgId: null });
    }
  },

  setRoleId: (roleId: string) => set({ roleId }),

  setRoleInfo: (info) => set((state) => ({
    roleThemeColor: info.theme_color || state.roleThemeColor,
    roleAvatar: info.avatar || state.roleAvatar,
    roleName: info.name || state.roleName,
  })),

  clearMessages: () => set({ messages: [], sessionId: crypto.randomUUID() }),
}));
