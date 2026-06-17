import { invoke } from '@tauri-apps/api/core';

const AGENT_URL = "http://localhost:3456";

export interface ChatEvent {
  type: "token" | "done" | "error";
  content: string;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
}

export interface Session {
  id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}

export async function* streamChat(
  message: string,
  sessionId: string,
  roleId: string
): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, role_id: roleId }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6));
          yield event;
        } catch {}
      }
    }
  }
}

export async function getRoles(): Promise<RoleInfo[]> {
  return await invoke<RoleInfo[]>('list_roles');
}

export async function getRole(id: string) {
  const res = await fetch(`${AGENT_URL}/roles/${id}`);
  return res.json();
}

export async function getSessions(): Promise<Session[]> {
  const res = await fetch(`${AGENT_URL}/sessions`);
  return res.json();
}

export async function getSessionMessages(sessionId: string) {
  const res = await fetch(`${AGENT_URL}/sessions/${sessionId}/messages`);
  return res.json();
}

export async function reloadRoles() {
  const res = await fetch(`${AGENT_URL}/reload`, { method: "POST" });
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${AGENT_URL}/health`);
  return res.json();
}
