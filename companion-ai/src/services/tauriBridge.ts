import { invoke } from '@tauri-apps/api/core';
import type { SendMessageRequest, SendMessageResponse, Skill, UploadSkillRequest } from '../types';

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

export async function openSettingsWindow(): Promise<void> {
  await invoke('open_settings_window');
}

export async function closeSettingsWindow(): Promise<void> {
  await invoke('close_settings_window');
}

// Skill management
export async function uploadSkill(request: UploadSkillRequest): Promise<Skill> {
  return await invoke<Skill>('upload_skill', { request });
}

export async function listSkills(): Promise<Skill[]> {
  return await invoke<Skill[]>('list_skills');
}

export async function toggleSkill(skillId: string, isActive: boolean): Promise<void> {
  await invoke('toggle_skill', { skillId, isActive });
}

export async function deleteSkill(skillId: string): Promise<void> {
  await invoke('delete_skill', { skillId });
}

export async function getActiveSkills(): Promise<Skill[]> {
  return await invoke<Skill[]>('get_active_skills');
}

export async function switchRole(skillId: string): Promise<{ session_id: string; skill_id: string }> {
  return await invoke('switch_role', { newSkillId: skillId });
}
