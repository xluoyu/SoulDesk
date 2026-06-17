import { z } from "zod";
import { loadModule } from "../role/loader.js";
import { ToolDefinition } from "./registry.js";

export function createSkillTools(roleId: string): ToolDefinition[] {
  return [{
    name: "load_skill_module",
    description: "当对话涉及特定主题时，加载对应的角色知识模块。参见 system prompt 中的模块索引。",
    parameters: z.object({
      module_name: z.string().describe("模块文件名，如 relationships.md"),
    }),
    handler: async (args: { module_name: string }) => {
      return await loadModule(roleId, args.module_name);
    },
  }];
}
