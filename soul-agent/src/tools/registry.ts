import { z } from "zod";
import { DynamicTool } from "@langchain/core/tools";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  handler: (args: any) => Promise<string>;
}

const registry: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition) {
  registry.set(tool.name, tool);
}

export function getTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function toLangChainTools(tools: ToolDefinition[]) {
  return tools.map(tool =>
    new DynamicTool({
      name: tool.name,
      description: tool.description,
      func: tool.handler,
    })
  );
}
