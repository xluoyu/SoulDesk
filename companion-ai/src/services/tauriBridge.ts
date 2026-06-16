import { invoke } from '@tauri-apps/api/core';
import type { SendMessageRequest, SendMessageResponse } from '../types';

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  return await invoke<SendMessageResponse>('send_message', { request });
}

// Window management
export async function showChatWindow(): Promise<void> {
  await invoke('show_chat_window');
}

export async function showFloatingWidget(): Promise<void> {
  await invoke('show_floating_widget');
}

export async function createFloatingWindow(): Promise<void> {
  await invoke('create_floating_window');
}

export async function closeFloatingWindow(): Promise<void> {
  await invoke('close_floating_window');
}
