import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { loadRole } from "../role/loader.js";
import { buildSystemPrompt } from "../role/prompt.js";
import { createSkillTools } from "../tools/skill.js";
import { recallMemoryTool, storeMemoryTool } from "../tools/memory.js";
import { ToolDefinition, toLangChainTools } from "../tools/registry.js";
import { MemoryManager } from "../memory/manager.js";
import db from "../db/database.js";
import { v4 as uuid } from "uuid";

export interface ChatRequest {
  message: string;
  session_id: string;
  role_id: string;
}

export interface ChatEvent {
  type: "token" | "done" | "error";
  content: string;
}

const memoryManager = new MemoryManager();

export class AgentEngine {
  private apiKey: string;
  private baseURL: string;
  private modelName: string;

  constructor(apiKey: string, baseURL: string, modelName: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.modelName = modelName;
  }

  private createLLM() {
    return new ChatOpenAI({
      configuration: { baseURL: this.baseURL },
      apiKey: this.apiKey,
      modelName: this.modelName,
      temperature: 0.7,
      streaming: true,
    });
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const { message, session_id, role_id } = request;
    const llm = this.createLLM();

    const role = await loadRole(role_id);
    this.ensureSession(session_id, role_id);
    this.saveMessage(session_id, "user", message);

    const history = this.getRecentMessages(session_id, 20);

    // 构建工具列表
    const skillTools = createSkillTools(role_id);
    const allToolDefs: ToolDefinition[] = [...skillTools, recallMemoryTool, storeMemoryTool];
    const langChainTools = toLangChainTools(allToolDefs);

    // 构建记忆上下文
    const memoryContext = await memoryManager.buildMemoryContext(message);

    // 构建 system prompt
    const loadedModules: string[] = [];
    let systemPrompt = await buildSystemPrompt(role, loadedModules);
    if (memoryContext) {
      systemPrompt += `\n\n## 用户信息\n${memoryContext}`;
    }

    const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [
      new SystemMessage({ content: systemPrompt }),
      ...history.map(m => m.role === "user"
        ? new HumanMessage({ content: m.content })
        : new AIMessage({ content: m.content })
      ),
      new HumanMessage({ content: message }),
    ];

    // Agent 循环
    const maxRounds = 10;
    for (let round = 0; round < maxRounds; round++) {
      const llmWithTools = llm.bindTools(langChainTools);
      const response = await llmWithTools.invoke(messages);
      messages.push(response as AIMessage);

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          const tool = allToolDefs.find(t => t.name === toolCall.name);
          let result: string;

          if (tool) {
            try {
              result = await tool.handler(toolCall.args);
            } catch (e) {
              result = `工具执行错误: ${e}`;
            }
          } else {
            result = `未知工具: ${toolCall.name}`;
          }

          // 如果是加载模块，更新 system prompt
          if (toolCall.name === "load_skill_module") {
            loadedModules.push(toolCall.args.module_name);
            systemPrompt = await buildSystemPrompt(role, loadedModules);
            if (memoryContext) {
              systemPrompt += `\n\n## 用户信息\n${memoryContext}`;
            }
            messages[0] = new SystemMessage({ content: systemPrompt });
          }

          messages.push(new ToolMessage({
            content: result,
            tool_call_id: toolCall.id!,
          }));
        }
        continue;
      }

      // 没有工具调用，返回最终回复
      const finalContent = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      this.saveMessage(session_id, "assistant", finalContent);

      yield { type: "done", content: finalContent };
      return;
    }

    yield { type: "error", content: "超过最大对话轮次" };
  }

  private ensureSession(sessionId: string, roleId: string) {
    const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare("INSERT INTO sessions (id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(sessionId, roleId, now, now);
    }
  }

  private saveMessage(sessionId: string, role: string, content: string) {
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)")
      .run(id, sessionId, role, content, now);
  }

  private getRecentMessages(sessionId: string, limit: number) {
    return db.prepare(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?"
    ).all(sessionId, limit).reverse() as { role: string; content: string }[];
  }
}
