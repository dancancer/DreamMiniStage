import { BaseWorkflow, WorkflowConfig, WorkflowParams } from "@/lib/workflow/BaseWorkflow";
import { WorkflowEngine } from "@/lib/nodeflow/WorkflowEngine";
import { NodeContext } from "@/lib/nodeflow/NodeContext";
import { NodeCategory } from "@/lib/nodeflow/types";
import { UserInputNode } from "@/lib/nodeflow/UserInputNode/UserInputNode";
import { HistoryPreNode } from "@/lib/nodeflow/HistoryPreNode/HistoryPreNode";
import { ContextNode } from "@/lib/nodeflow/ContextNode/ContextNode";
import { WorldBookNode } from "@/lib/nodeflow/WorldBookNode/WorldBookNode";
import { PresetNode } from "@/lib/nodeflow/PresetNode/PresetNode";
import { buildLLMConfigFromNodeInput, LLMNode } from "@/lib/nodeflow/LLMNode/LLMNode";
import { RegexNode } from "@/lib/nodeflow/RegexNode/RegexNode";
import { PluginNode } from "@/lib/nodeflow/PluginNode/PluginNode";
import { PluginMessageNode } from "@/lib/nodeflow/PluginNode/PluginMessageNode";
import { OutputNode } from "@/lib/nodeflow/OutputNode/OutputNode";
import type { SystemPresetType } from "@/lib/nodeflow/PresetNode/PresetNodeTools";
import type { PromptNames, PostProcessingMode, STContextPreset, STSyspromptPreset } from "@/lib/core/st-preset-types";
import type { EffectivePromptConfigSummary } from "@/lib/prompt-config/state";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                   Dialogue Workflow Parameters                            ║
 * ║                                                                           ║
 * ║  对话工作流参数 - 扩展 WorkflowParams 以满足索引签名要求                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
export interface DialogueWorkflowParams extends WorkflowParams {
  dialogueKey?: string;  // 会话 ID（用于隔离不同会话的历史）
  characterId: string;
  userInput: string;
  number?: number;
  language?: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType?: "openai" | "ollama" | "gemini";
  temperature?: number;
  contextWindow?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  fastModel?: boolean;
  systemPresetType?: SystemPresetType;
  contextPreset?: STContextPreset;
  sysprompt?: STSyspromptPreset & { enabled?: boolean };
  stopStrings?: string[];
  promptNames?: PromptNames;
  postProcessingMode?: PostProcessingMode;
  effectivePromptConfig?: EffectivePromptConfigSummary;
}

export class DialogueWorkflow extends BaseWorkflow {
  protected getNodeRegistry() {
    return {
      "userInput": {
        nodeClass: UserInputNode,
      },
      "pluginMessage": {
        nodeClass: PluginMessageNode,
      },
      "historyPre": {
        nodeClass: HistoryPreNode,
      },
      "context": {
        nodeClass: ContextNode,
      },
      "worldBook": {
        nodeClass: WorldBookNode,
      },
      "preset": {
        nodeClass: PresetNode,
      },
      "llm": {
        nodeClass: LLMNode,
      },
      "regex": {
        nodeClass: RegexNode,
      },
      "plugin": {
        nodeClass: PluginNode,
      },
      "output": {
        nodeClass: OutputNode,
      },
    };
  }

  protected getWorkflowConfig(): WorkflowConfig {
    return {
      id: "complete-dialogue-workflow",
      name: "Complete Dialogue Processing Workflow",
      nodes: [
        /* ═══════════════════════════════════════════════════════════════════
           入口节点：接收用户输入和配置参数
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "user-input-1",
          name: "userInput",
          category: NodeCategory.ENTRY,
          next: ["plugin-message-1"],
          initParams: ["dialogueKey", "characterId", "userInput", "number", "language", "username", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "contextWindow", "maxTokens", "timeout", "maxRetries", "topP", "frequencyPenalty", "presencePenalty", "topK", "repeatPenalty", "fastModel", "systemPresetType", "streaming", "streamUsage", "contextPreset", "sysprompt", "stopStrings", "promptNames", "postProcessingMode", "effectivePromptConfig"],
          inputFields: [],
          outputFields: ["dialogueKey", "characterId", "userInput", "number", "language", "username", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "contextWindow", "maxTokens", "timeout", "maxRetries", "topP", "frequencyPenalty", "presencePenalty", "topK", "repeatPenalty", "fastModel", "systemPresetType", "streaming", "streamUsage", "contextPreset", "sysprompt", "stopStrings", "promptNames", "postProcessingMode", "effectivePromptConfig"],
        },

        /* ═══════════════════════════════════════════════════════════════════
           插件消息节点：处理插件对用户输入的修改
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "plugin-message-1",
          name: "pluginMessage",
          category: NodeCategory.MIDDLE,
          next: ["history-pre-1"],
          initParams: [],
          inputFields: ["dialogueKey", "characterId", "userInput"],
          outputFields: ["dialogueKey", "characterId", "userInput", "number", "language", "username", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "contextWindow", "maxTokens", "timeout", "maxRetries", "topP", "frequencyPenalty", "presencePenalty", "topK", "repeatPenalty", "fastModel", "systemPresetType", "streaming", "streamUsage", "contextPreset", "sysprompt", "stopStrings", "promptNames", "postProcessingMode", "effectivePromptConfig"],
        },

        /* ═══════════════════════════════════════════════════════════════════
           历史数据前置节点：在 PresetNode 之前提供结构化历史数据
           Requirements: 2.1 - DialogueWorkflow 执行时，系统应在 PresetNode 之前运行 HistoryPreNode
           
           输出：
           - chatHistoryMessages: 结构化历史消息数组 → PresetNode
           - conversationContext: 短上下文 → memory/RAG 子系统
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "history-pre-1",
          name: "historyPre",
          category: NodeCategory.MIDDLE,
          next: ["preset-1"],
          initParams: [],
          inputFields: ["dialogueKey", "characterId", "userInput"],
          outputFields: ["chatHistoryMessages", "conversationContext", "userInput"],
        },

        /* ═══════════════════════════════════════════════════════════════════
           预设节点：根据 preset 配置构建 messages[] 数组
           Requirements: 2.6 - PresetNode 构建 MacroEnv 时应包含来自 HistoryPreNode 的 chatHistoryMessages
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "preset-1",
          name: "preset",
          category: NodeCategory.MIDDLE,
          next: ["context-1"],
          initParams: [],
          inputFields: ["characterId", "language", "username", "number", "fastModel", "systemPresetType", "dialogueKey", "userInput", "chatHistoryMessages", "contextPreset", "sysprompt", "promptNames", "postProcessingMode"],
          outputFields: ["messages", "presetId"],
          inputMapping: {
            "userInput": "currentUserInput",
          },
        },

        /* ═══════════════════════════════════════════════════════════════════
           上下文节点：消息中转层（不做字符串兼容替换）
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "context-1",
          name: "context",
          category: NodeCategory.MIDDLE,
          next: ["world-book-1"],
          initParams: [],
          inputFields: ["messages"],
          outputFields: ["messages"],
        },
        {
          id: "world-book-1",
          name: "worldBook",
          category: NodeCategory.MIDDLE,
          next: ["llm-1"],
          initParams: [],
          inputFields: ["dialogueKey", "characterId", "userInput", "messages"],
          outputFields: ["messages"],
          inputMapping: {
            "userInput": "currentUserInput",
          },
        },
        {
          id: "llm-1",
          name: "llm",
          category: NodeCategory.MIDDLE,
          next: ["regex-1"],
          initParams: [],
          inputFields: ["messages", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "contextWindow", "maxTokens", "timeout", "maxRetries", "topP", "frequencyPenalty", "presencePenalty", "topK", "repeatPenalty", "language", "streaming", "streamUsage", "dialogueKey", "characterId", "stopStrings", "promptNames", "postProcessingMode", "effectivePromptConfig"],
          optionalInputFields: ["temperature", "contextWindow", "timeout", "maxRetries", "topP", "frequencyPenalty", "presencePenalty", "topK", "repeatPenalty", "stopStrings", "promptNames", "postProcessingMode", "effectivePromptConfig"],
          outputFields: ["llmResponse"],
        },
        {
          id: "regex-1",
          name: "regex",
          category: NodeCategory.MIDDLE,
          next: ["plugin-1"],
          initParams: [],
          inputFields: ["llmResponse", "characterId", "presetId"],
          outputFields: ["thinkingContent", "screenContent", "fullResponse", "nextPrompts", "event"],
        },
        {
          id: "plugin-1",
          name: "plugin",
          category: NodeCategory.MIDDLE,
          next: ["output-1"],
          initParams: [],
          inputFields: ["thinkingContent", "screenContent", "fullResponse", "nextPrompts", "event", "characterId"],
          outputFields: ["thinkingContent", "screenContent", "fullResponse", "nextPrompts", "event"],
        },
        {
          id: "output-1",
          name: "output",
          category: NodeCategory.EXIT,
          next: [],
          initParams: [],
          inputFields: ["thinkingContent", "screenContent", "fullResponse", "nextPrompts", "event"],
          outputFields: ["thinkingContent", "screenContent", "fullResponse", "nextPrompts", "event"],
        },
      ],
    };
  }

  async prepareExecution(params: DialogueWorkflowParams): Promise<{
    context: NodeContext;
    llmInput: import("@/lib/nodeflow/LLMNode/llm-config").LLMConfig;
  }> {
    this.resetContext();
    const context = this.getContext();
    const engine = new WorkflowEngine(
      this.getWorkflowConfig(),
      this.getNodeRegistry() as import("@/lib/nodeflow/types").NodeRegistry,
      context,
    );

    const prepared = await engine.executeUntil("llm-1", params, context);
    return {
      context: prepared.context,
      llmInput: buildLLMConfigFromNodeInput(prepared.targetInput),
    };
  }

  async finalizeExecution(
    context: NodeContext,
    llmResponse: string,
  ): Promise<{
    outputData: Record<string, unknown>;
  }> {
    context.setCache("llmResponse", llmResponse);
    const engine = new WorkflowEngine(
      this.getWorkflowConfig(),
      this.getNodeRegistry() as import("@/lib/nodeflow/types").NodeRegistry,
      context,
    );

    const result = await engine.executeFrom("regex-1", context);
    return {
      outputData: result.outputData,
    };
  }
} 
