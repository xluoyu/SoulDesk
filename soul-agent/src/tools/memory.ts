import { z } from "zod";
import { ToolDefinition } from "./registry.js";
import { MemoryManager } from "../memory/manager.js";

const memoryManager = new MemoryManager();

export const recallMemoryTool: ToolDefinition = {
  name: "recall_memory",
  description: "搜索长期记忆，回忆之前与用户的对话内容。当需要回忆用户之前的偏好、事实或对话时使用。",
  parameters: z.object({
    query: z.string().describe("搜索关键词"),
  }),
  handler: async (args: { query: string }) => {
    const memories = await memoryManager.searchMemories(args.query, 5) as any[];
    if (memories.length === 0) {
      return "没有找到相关记忆";
    }
    return memories.map((m: any) => `[${m.category}] ${m.content}`).join("\n");
  },
};

export const storeMemoryTool: ToolDefinition = {
  name: "store_memory",
  description: "存储新的长期记忆。当对话中提取到关于用户的重要信息、偏好或事实时使用。",
  parameters: z.object({
    category: z.string().describe("记忆类别，如 fact, preference, topic"),
    content: z.string().describe("记忆内容"),
  }),
  handler: async (args: { category: string; content: string }) => {
    const result = await memoryManager.storeMemory(args.category, args.content);
    return `已存储记忆: ${result.content}`;
  },
};
