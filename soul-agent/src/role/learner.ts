import { loadRole } from "./loader.js";
import { MemoryManager } from "../memory/manager.js";

const memoryManager = new MemoryManager();

export async function learnAboutRole(roleId: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("TAVILY_API_KEY 未设置，跳过角色学习");
    return;
  }

  const role = await loadRole(roleId);
  const query = `${role.name} 角色设定 性格 背景`;

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
      }),
    });
    const data = await response.json();

    for (const result of data.results || []) {
      await memoryManager.storeMemory(
        "role_knowledge",
        `${role.name}: ${result.title} - ${result.content}`
      );
    }

    console.log(`角色学习完成: ${role.name}，存储了 ${(data.results || []).length} 条记忆`);
  } catch (e) {
    console.error(`角色学习失败: ${e}`);
  }
}
