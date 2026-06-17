import { Role } from "./loader.js";

export async function buildSystemPrompt(role: Role, loadedModules: string[]): Promise<string> {
  const parts: string[] = [];

  parts.push(role.systemPrompt);

  for (const mod of role.modules) {
    if (mod.alwaysLoad) {
      parts.push(`## ${mod.name}\n${mod.content}`);
    }
  }

  for (const modName of loadedModules) {
    const mod = role.modules.find(m => m.name === modName);
    if (mod && !mod.alwaysLoad) {
      parts.push(`## ${mod.name}\n${mod.content}`);
    }
  }

  if (role.moduleIndex) {
    parts.push(role.moduleIndex);
  }

  return parts.join("\n\n");
}
