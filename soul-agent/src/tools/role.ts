import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { ToolDefinition } from "./registry.js";

const SOULDESK_DIR = path.resolve(__dirname, "../../../.souldesk");
const ROLES_DIR = path.join(SOULDESK_DIR, "roles");

export const createRoleTool: ToolDefinition = {
  name: "create_role",
  description:
    "创建新角色。当用户确认了角色信息后，调用此工具生成角色文件。参数包含所有模块的内容。",
  parameters: z.object({
    role_id: z.string().describe("角色ID，英文小写加连字符，如 xianna"),
    name: z.string().describe("角色中文名"),
    description: z.string().describe("一句话描述"),
    skill_md: z.string().describe("SKILL.md 完整内容"),
    personality_md: z.string().describe("personality.md 完整内容"),
    speaking_style_md: z.string().describe("speaking_style.md 完整内容"),
    relationships_md: z.string().describe("relationships.md 完整内容"),
    world_setting_md: z.string().describe("world_setting.md 完整内容"),
  }),
  handler: async (args) => {
    const roleDir = path.join(ROLES_DIR, args.role_id);

    const existing = await fs
      .stat(roleDir)
      .then(() => true)
      .catch(() => false);
    if (existing) {
      return `错误：角色 "${args.role_id}" 已存在`;
    }

    await fs.mkdir(roleDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(roleDir, "SKILL.md"), args.skill_md),
      fs.writeFile(path.join(roleDir, "personality.md"), args.personality_md),
      fs.writeFile(path.join(roleDir, "speaking_style.md"), args.speaking_style_md),
      fs.writeFile(path.join(roleDir, "relationships.md"), args.relationships_md),
      fs.writeFile(path.join(roleDir, "world_setting.md"), args.world_setting_md),
    ]);

    return `角色 "${args.name}" 已创建成功！文件位于 ${roleDir}`;
  },
};
