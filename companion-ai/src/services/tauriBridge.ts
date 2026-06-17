import { invoke } from '@tauri-apps/api/core';

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

// Settings
export interface Settings {
  model: {
    access_mode: string;
    api_key: string;
    base_url: string;
    model_name: string;
  };
  general: {
    theme_mode: string;
    floating_widget: boolean;
    proactive_push: boolean;
  };
  search: {
    enabled: boolean;
    tavily_api_key: string;
  };
  agent: {
    port: number;
    auto_start: boolean;
  };
}

export async function getSettings(): Promise<Settings> {
  return await invoke<Settings>('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await invoke('save_settings', { settings });
}
