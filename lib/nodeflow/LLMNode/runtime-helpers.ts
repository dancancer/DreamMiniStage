import { type TokenUsage } from "@/lib/adapters/token-usage";
import { getTextContent, postProcessMessages } from "@/lib/core/prompt/post-processor";
import { PostProcessingMode, type ExtendedChatMessage } from "@/lib/core/st-preset-types";
import { getTemplateById } from "@/lib/core/instruct";
import { applyTemplateToMessages } from "@/lib/core/instruct/apply";
import type { LLMConfig } from "./llm-config";

export type ChatMessage = {
  role: string;
  content: string;
  tool_calls?: ExtendedChatMessage["tool_calls"];
  tool_call_id?: string;
  reasoning_content?: string;
};

const DEEPSEEK_USER_PLACEHOLDER = "Let's get started.";

function toSimpleMessages(messages: ExtendedChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const transportMessage: ChatMessage = {
      role: message.role,
      content: typeof message.content === "string"
        ? message.content
        : getTextContent(message.content),
    };
    const rawMessage = message as ExtendedChatMessage & Record<string, unknown>;

    if (message.tool_calls?.length) {
      transportMessage.tool_calls = message.tool_calls;
    }

    if (message.tool_call_id) {
      transportMessage.tool_call_id = message.tool_call_id;
    }

    if (typeof rawMessage.reasoning_content === "string") {
      transportMessage.reasoning_content = rawMessage.reasoning_content;
    }

    return transportMessage;
  });
}

function isDeepSeekReasonerConfig(config: LLMConfig): boolean {
  if (config.llmType !== "openai") {
    return false;
  }

  return /\bdeepseek-reasoner\b/i.test(config.modelName) || /\bdeepseek[-_/ ]r1\b/i.test(config.modelName);
}

function stripReasoningMetadata(messages: ExtendedChatMessage[]): {
  messages: ExtendedChatMessage[];
  strippedCount: number;
} {
  const reasoningKeys = ["reasoning_content", "thinkingContent", "signature"] as const;
  let strippedCount = 0;

  const sanitizedMessages = messages.map((message) => {
    const nextMessage = { ...message } as ExtendedChatMessage & Record<string, unknown>;

    for (const key of reasoningKeys) {
      if (key in nextMessage) {
        delete nextMessage[key];
        strippedCount += 1;
      }
    }

    return nextMessage;
  });

  return {
    messages: sanitizedMessages,
    strippedCount,
  };
}

function summarizeRoles(messages: ExtendedChatMessage[]): string {
  return messages.map((message) => message.role).join(" > ");
}

function addDeepSeekReasonerToolCallCompatibility(messages: ExtendedChatMessage[]): {
  messages: ExtendedChatMessage[];
  injectedCount: number;
} {
  let injectedCount = 0;

  const compatibleMessages = messages.map((message) => {
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      return message;
    }

    const rawMessage = message as ExtendedChatMessage & Record<string, unknown>;
    if (typeof rawMessage.reasoning_content === "string") {
      return rawMessage;
    }

    injectedCount += 1;
    return {
      ...rawMessage,
      reasoning_content: "",
    } as ExtendedChatMessage;
  });

  return {
    messages: compatibleMessages,
    injectedCount,
  };
}

function ensureDeepSeekReasonerUserTail(messages: ExtendedChatMessage[]): {
  messages: ExtendedChatMessage[];
  appendedUserPlaceholderCount: number;
} {
  if (messages.length === 0) {
    return {
      messages,
      appendedUserPlaceholderCount: 0,
    };
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "assistant") {
    return {
      messages,
      appendedUserPlaceholderCount: 0,
    };
  }

  return {
    messages: [
      ...messages,
      { role: "user", content: DEEPSEEK_USER_PLACEHOLDER },
    ],
    appendedUserPlaceholderCount: 1,
  };
}

export function normalizeMessages(config: LLMConfig): ChatMessage[] {
  if (!config.messages || config.messages.length === 0) {
    throw new Error("messages[] is required");
  }

  const rawMessages = [...config.messages] as ExtendedChatMessage[];
  const usesDeepSeekReasoner = isDeepSeekReasonerConfig(config);
  const { messages: sanitizedMessages, strippedCount } = usesDeepSeekReasoner
    ? stripReasoningMetadata(rawMessages)
    : { messages: rawMessages, strippedCount: 0 };

  if (!config.promptNames || !config.postProcessingMode) {
    return toSimpleMessages(sanitizedMessages);
  }

  const effectiveMode = usesDeepSeekReasoner
    ? PostProcessingMode.STRICT
    : config.postProcessingMode;

  const processed = postProcessMessages(sanitizedMessages, {
    mode: effectiveMode,
    names: config.promptNames,
    tools: config.tools,
    prefill: config.prefill,
    placeholder: config.placeholder,
  });
  const {
    messages: deepSeekTailNormalizedMessages,
    appendedUserPlaceholderCount,
  } = usesDeepSeekReasoner
    ? ensureDeepSeekReasonerUserTail(processed)
    : { messages: processed, appendedUserPlaceholderCount: 0 };
  const {
    messages: deepSeekCompatibleMessages,
    injectedCount,
  } = usesDeepSeekReasoner
    ? addDeepSeekReasonerToolCallCompatibility(deepSeekTailNormalizedMessages)
    : { messages: deepSeekTailNormalizedMessages, injectedCount: 0 };

  if (usesDeepSeekReasoner) {
    const roleSummaryBefore = summarizeRoles(sanitizedMessages);
    const roleSummaryAfter = summarizeRoles(deepSeekCompatibleMessages);
    const modeChanged = config.postProcessingMode !== effectiveMode;

    if (modeChanged || strippedCount > 0 || appendedUserPlaceholderCount > 0 || injectedCount > 0 || roleSummaryBefore !== roleSummaryAfter) {
      console.info("[DeepSeekReasoner] Prompt normalized", {
        mode: effectiveMode,
        strippedMetadataCount: strippedCount,
        appendedUserPlaceholderCount,
        injectedReasoningContentCount: injectedCount,
        roleSummaryBefore,
        roleSummaryAfter,
      });
    }
  }

  const simpleMessages = toSimpleMessages(deepSeekCompatibleMessages);

  // ═══════════════════════════════════════════════════════════════════════
  // Instruction Mode 模板应用
  //
  // 仅对 openai/ollama 后端生效（Claude/Gemini 有专用格式转换器）
  // 将消息内容用模板标记包裹，使不自动应用 chat template 的推理后端
  // 能正确理解消息结构。同时注入模板的停止序列。
  // ═══════════════════════════════════════════════════════════════════════
  if (config.instructTemplateId && (config.llmType === "openai" || config.llmType === "ollama")) {
    const template = getTemplateById(config.instructTemplateId);
    if (template) {
      const wrapped = applyTemplateToMessages(simpleMessages, template);
      // 追加模板停止序列到 config（如果尚未包含）
      const existingStops = new Set(config.stopStrings || []);
      const newStops = template.stopSequences.filter((s) => !existingStops.has(s));
      if (newStops.length > 0) {
        config.stopStrings = [...(config.stopStrings || []), ...newStops];
      }
      return wrapped;
    }
  }

  return simpleMessages;
}

export function emitPromptCapturedEvent(
  config: LLMConfig,
  messages: ChatMessage[],
): void {
  if (typeof window === "undefined" || !config.dialogueKey) {
    return;
  }

  const promptEvent = new CustomEvent("llm-prompt-captured", {
    detail: {
      dialogueKey: config.dialogueKey,
      characterId: config.characterId,
      modelName: config.modelName,
      timestamp: Date.now(),
      messages,
      effectiveConfig: config.effectivePromptConfig,
    },
  });
  window.dispatchEvent(promptEvent);
}

export function publishTokenUsage(tokenUsage: TokenUsage): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedUsage = {
    prompt_tokens: tokenUsage.promptTokens,
    completion_tokens: tokenUsage.completionTokens,
    total_tokens: tokenUsage.totalTokens,
  };

  window.lastTokenUsage = normalizedUsage;
  window.dispatchEvent(new CustomEvent("llm-token-usage", {
    detail: { tokenUsage: normalizedUsage },
  }));
}
