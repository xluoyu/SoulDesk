import { z } from "zod";
import { ToolDefinition } from "./registry.js";

export const searchWebTool: ToolDefinition = {
  name: "search_web",
  description: "搜索互联网获取实时信息。当用户问到最新事件、天气、或你不确定的事实时使用。",
  parameters: z.object({
    query: z.string().describe("搜索关键词"),
  }),
  handler: async (args: { query: string }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "搜索功能未配置，请设置 TAVILY_API_KEY 环境变量";
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          max_results: 3,
        }),
      });
      const data = await response.json();
      return data.results?.map((r: any) => `${r.title}: ${r.content}`).join("\n\n") || "未找到结果";
    } catch (e) {
      return `搜索出错: ${e}`;
    }
  },
};
