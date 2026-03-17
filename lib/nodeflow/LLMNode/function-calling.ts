import { getMvuTool, type OpenAITool } from "@/lib/mvu/function-call";
import type { LLMConfig } from "./llm-config";

export function hasFunctionCalling(config: LLMConfig): boolean {
  return Boolean(
    config.mvuToolEnabled ||
    (config.scriptTools && config.scriptTools.length > 0),
  );
}

export function buildFunctionCallingTools(config: LLMConfig): {
  allTools: OpenAITool[];
  scriptTools: OpenAITool[];
} {
  const allTools: OpenAITool[] = [];
  if (config.mvuToolEnabled) {
    allTools.push(getMvuTool());
  }

  const scriptTools = config.scriptTools || [];
  if (scriptTools.length > 0) {
    allTools.push(...scriptTools);
  }

  return {
    allTools,
    scriptTools,
  };
}
