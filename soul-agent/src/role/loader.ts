import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

const ROLES_DIR = path.resolve(__dirname, "../../../.souldesk", "roles");

export interface SkillModule {
  name: string;
  content: string;
  alwaysLoad: boolean;
}

export interface Role {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  themeColor: string;
  avatar: string;
  isManager: boolean;
  systemPrompt: string;
  modules: SkillModule[];
  moduleIndex: string;
}

export async function listRoles(): Promise<{ id: string; name: string; description: string; themeColor: string; avatar: string }[]> {
  await fs.mkdir(ROLES_DIR, { recursive: true });
  const entries = await fs.readdir(ROLES_DIR, { withFileTypes: true });
  const roles = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      try {
        const skillPath = path.join(ROLES_DIR, entry.name, "SKILL.md");
        const content = await fs.readFile(skillPath, "utf-8");
        const { data } = matter(content);
        roles.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description || "",
          themeColor: data.theme_color || "#e94560",
          avatar: data.avatar || "",
        });
      } catch {
        // 跳过没有 SKILL.md 的目录
      }
    }
  }

  return roles;
}

export async function loadRole(roleId: string): Promise<Role> {
  const roleDir = path.join(ROLES_DIR, roleId);
  const skillPath = path.join(roleDir, "SKILL.md");
  const content = await fs.readFile(skillPath, "utf-8");
  const { data, content: body } = matter(content);

  const files = await fs.readdir(roleDir);
  const modules: SkillModule[] = [];
  const alwaysLoad = data.always_load || [];

  for (const file of files) {
    if (file.endsWith(".md") && file !== "SKILL.md") {
      const modContent = await fs.readFile(path.join(roleDir, file), "utf-8");
      modules.push({
        name: file,
        content: modContent,
        alwaysLoad: alwaysLoad.includes(file),
      });
    }
  }

  const moduleIndexMatch = body.match(/## 模块索引[\s\S]*$/);
  const moduleIndex = moduleIndexMatch ? moduleIndexMatch[0] : "";

  return {
    id: roleId,
    name: data.name || roleId,
    version: data.version || "1.0",
    author: data.author || "",
    description: data.description || "",
    themeColor: data.theme_color || "#e94560",
    avatar: data.avatar || "",
    isManager: data.role === "manager",
    systemPrompt: body,
    modules,
    moduleIndex,
  };
}

export async function loadModule(roleId: string, moduleName: string): Promise<string> {
  const filePath = path.join(ROLES_DIR, roleId, moduleName);
  return await fs.readFile(filePath, "utf-8");
}
