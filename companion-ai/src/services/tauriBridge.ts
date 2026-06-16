import { invoke } from '@tauri-apps/api/core';
import type { SendMessageRequest, SendMessageResponse } from '../types';

export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  return await invoke<SendMessageResponse>('send_message', { request });
}
