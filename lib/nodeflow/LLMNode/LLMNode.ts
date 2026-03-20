import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { LLMNodeTools } from "./LLMNodeTools";
import type { LLMConfig } from "./llm-config";
import { NodeToolRegistry } from "../NodeTool";
import { getScriptToolsAsOpenAI } from "@/hooks/script-bridge";
import { applyContextWindowToMessages } from "@/lib/model-runtime";

/* ═══════════════════════════════════════════════════════════════════════════
   LLM 输入标准化：流式与非流式共用同一路径
   ═══════════════════════════════════════════════════════════════════════════ */

export function buildLLMConfigFromNodeInput(input: NodeInput): LLMConfig {
  const messages = input.messages as Array<{ role: string; content: string }> | undefined;
  const modelName = input.modelName as string;
  const apiKey = input.apiKey as string;
  const baseUrl = input.baseUrl as string | undefined;
  const llmType = (input.llmType || "openai") as LLMConfig["llmType"];
  const temperature = input.temperature as number | undefined;
  const contextWindow = input.contextWindow as number | undefined;
  const maxTokens = input.maxTokens as number | undefined;
  const timeout = input.timeout as number | undefined;
  const maxRetries = input.maxRetries as number | undefined;
  const topP = input.topP as number | undefined;
  const frequencyPenalty = input.frequencyPenalty as number | undefined;
  const presencePenalty = input.presencePenalty as number | undefined;
  const topK = input.topK as number | undefined;
  const repeatPenalty = input.repeatPenalty as number | undefined;
  const language = (input.language || "zh") as LLMConfig["language"];
  const streaming = (input.streaming || false) as boolean;
  const streamUsage = (input.streamUsage ?? true) as boolean;
  const dialogueKey = input.dialogueKey as string | undefined;
  const characterId = input.characterId as string | undefined;
  const stopStrings = input.stopStrings as string[] | undefined;
  const effectivePromptConfig = input.effectivePromptConfig as LLMConfig["effectivePromptConfig"];

  const promptNames = input.promptNames as LLMConfig["promptNames"];
  const postProcessingMode = input.postProcessingMode as LLMConfig["postProcessingMode"];
  const tools = input.tools as boolean | undefined;
  const prefill = input.prefill as string | undefined;
  const placeholder = input.placeholder as string | undefined;
  const mvuToolEnabled = (input.mvuToolEnabled ?? false) as boolean;
  const scriptTools = getScriptToolsAsOpenAI();

  if (!messages || messages.length === 0) {
    throw new Error("messages[] is required for LLMNode");
  }

  const finalMessages = applyContextWindowToMessages(messages, {
    contextWindow: typeof contextWindow === "number" ? contextWindow : undefined,
    maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
  });

  return {
    modelName,
    apiKey,
    baseUrl,
    llmType,
    temperature,
    contextWindow,
    maxTokens,
    timeout,
    maxRetries,
    topP,
    frequencyPenalty,
    presencePenalty,
    topK,
    repeatPenalty,
    language,
    streaming,
    streamUsage,
    dialogueKey,
    characterId,
    messages: finalMessages,
    stopStrings,
    effectivePromptConfig,
    promptNames,
    postProcessingMode,
    tools,
    prefill,
    placeholder,
    mvuToolEnabled,
    scriptTools,
  };
}

export class LLMNode extends NodeBase {
  static readonly nodeName = "llm";
  static readonly description = "Handles LLM requests and responses";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(LLMNodeTools);
    super(config);
    this.toolClass = LLMNodeTools;
  }
  
  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {    
    const llmConfig = buildLLMConfigFromNodeInput(input);

    const llmResponse = await this.executeTool(
      "invokeLLM",
      llmConfig,
    ) as string;

    return {
      llmResponse,
      modelName: llmConfig.modelName,
      llmType: llmConfig.llmType,
    };
  }
}
