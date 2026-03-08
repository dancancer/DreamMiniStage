import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { LLMNodeTools } from "./LLMNodeTools";
import { NodeToolRegistry } from "../NodeTool";
import { getScriptToolsAsOpenAI } from "@/hooks/script-bridge";
import { applyContextWindowToMessages } from "@/lib/model-runtime";

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
    const messages = input.messages as Array<{ role: string; content: string }> | undefined;
    const modelName = input.modelName;
    const apiKey = input.apiKey;
    const baseUrl = input.baseUrl;
    const llmType = input.llmType || "openai";
    const temperature = input.temperature;
    const contextWindow = input.contextWindow;
    const maxTokens = input.maxTokens;
    const maxRetries = input.maxRetries;
    const topP = input.topP;
    const frequencyPenalty = input.frequencyPenalty;
    const presencePenalty = input.presencePenalty;
    const topK = input.topK;
    const repeatPenalty = input.repeatPenalty;
    const language = input.language || "zh";
    const streaming = input.streaming || false;
    const streamUsage = input.streamUsage ?? true;
    const dialogueKey = input.dialogueKey;
    const characterId = input.characterId;

    /* ─────────────────────────────────────────────────────────────────────────
       后处理选项 (Requirements: 7.1, 8.1)
       ───────────────────────────────────────────────────────────────────────── */
    const promptNames = input.promptNames;
    const postProcessingMode = input.postProcessingMode;
    const tools = input.tools;
    const prefill = input.prefill;
    const placeholder = input.placeholder;
    const scriptTools = getScriptToolsAsOpenAI();

    /* ═══════════════════════════════════════════════════════════════════════
       messages-only 架构：messages[] 是唯一事实源
       
       Requirements 1.1: LLMNode 发送请求时 SHALL 仅使用 messages[] 作为最终内容
       ═══════════════════════════════════════════════════════════════════════ */

    if (!messages || messages.length === 0) {
      throw new Error("messages[] is required for LLMNode");
    }

    const finalMessages = applyContextWindowToMessages(messages, {
      contextWindow: typeof contextWindow === "number" ? contextWindow : undefined,
      maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
    });

    const llmResponse = await this.executeTool(
      "invokeLLM",
      {
        modelName,
        apiKey,
        baseUrl,
        llmType,
        temperature,
        contextWindow,
        maxTokens,
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
        // 后处理选项
        promptNames,
        postProcessingMode,
        tools,
        prefill,
        placeholder,
        scriptTools,
      },
    ) as string;

    return {
      llmResponse,
      modelName,
      llmType,
    };
  }
}
