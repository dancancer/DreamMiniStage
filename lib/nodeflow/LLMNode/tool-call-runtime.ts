import {
  extractMvuToolCall,
  functionCallToUpdateContent,
  MVU_VARIABLE_UPDATE_FUNCTION,
  type OpenAITool,
  type ToolCallBatches,
} from "@/lib/mvu/function-call";
import { invokeScriptTool } from "@/hooks/script-bridge";

export interface ToolCallRuntimeCallbacks {
  onToolCallStart?: (toolName: string) => void;
  onToolCallResult?: (toolName: string, output: string) => void;
}

interface RawOpenAIToolCall {
  id?: string;
  name: string;
  args: unknown;
}

function parseScriptToolArguments(toolName: string, rawArgs: unknown): Record<string, unknown> {
  if (rawArgs === undefined || rawArgs === null) {
    return {};
  }

  if (typeof rawArgs === "string") {
    try {
      const parsed = JSON.parse(rawArgs) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error(`Tool '${toolName}' arguments JSON 必须为对象`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool '${toolName}' arguments 解析失败: ${detail}`);
    }
  }

  if (typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }

  throw new Error(`Tool '${toolName}' arguments 类型不受支持: ${typeof rawArgs}`);
}

function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

async function executeScriptToolCalls(
  rawToolCalls: RawOpenAIToolCall[],
  scriptToolNames: Set<string>,
  callbacks?: ToolCallRuntimeCallbacks,
): Promise<string[]> {
  const outputs: string[] = [];
  for (const call of rawToolCalls) {
    if (!scriptToolNames.has(call.name)) {
      continue;
    }
    callbacks?.onToolCallStart?.(call.name);
    const args = parseScriptToolArguments(call.name, call.args);
    const result = await invokeScriptTool(call.name, args);
    const serialized = `[tool:${call.name}] ${serializeToolResult(result)}`;
    callbacks?.onToolCallResult?.(call.name, serialized);
    outputs.push(serialized);
  }
  return outputs;
}

export async function applyOpenAIToolCalls(
  baseText: string,
  input: {
    rawToolCalls: RawOpenAIToolCall[];
    scriptTools: OpenAITool[];
    callbacks?: ToolCallRuntimeCallbacks;
  },
): Promise<string> {
  const { rawToolCalls, scriptTools, callbacks } = input;

  if (rawToolCalls.length === 0) {
    return baseText;
  }

  const toolCalls: ToolCallBatches = [rawToolCalls.map((call) => ({
    id: call.id || "",
    type: "function" as const,
    function: {
      name: call.name,
      arguments: typeof call.args === "string" ? call.args : JSON.stringify(call.args),
    },
  }))];

  let textContent = baseText;
  const mvuArgs = extractMvuToolCall(toolCalls);
  if (mvuArgs) {
    callbacks?.onToolCallStart?.(MVU_VARIABLE_UPDATE_FUNCTION.name);
    const updateContent = functionCallToUpdateContent(mvuArgs);
    callbacks?.onToolCallResult?.(MVU_VARIABLE_UPDATE_FUNCTION.name, updateContent);
    textContent = textContent ? `${textContent}\n\n${updateContent}` : updateContent;
  }

  const scriptToolNames = new Set(scriptTools.map((tool) => tool.function.name));
  const scriptOutputs = await executeScriptToolCalls(rawToolCalls, scriptToolNames, callbacks);
  if (scriptOutputs.length === 0) {
    return textContent;
  }

  const outputText = scriptOutputs.join("\n");
  return textContent ? `${textContent}\n\n${outputText}` : outputText;
}
