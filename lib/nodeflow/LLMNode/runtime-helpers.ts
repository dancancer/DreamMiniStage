import { type TokenUsage } from "@/lib/adapters/token-usage";
import { getTextContent, postProcessMessages } from "@/lib/core/prompt/post-processor";
import type { ExtendedChatMessage } from "@/lib/core/st-preset-types";
import type { LLMConfig } from "./llm-config";

export type ChatMessage = { role: string; content: string };

function toSimpleMessages(messages: ExtendedChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: typeof message.content === "string"
      ? message.content
      : getTextContent(message.content),
  }));
}

export function normalizeMessages(config: LLMConfig): ChatMessage[] {
  if (!config.messages || config.messages.length === 0) {
    throw new Error("messages[] is required");
  }

  const rawMessages = [...config.messages];

  if (!config.promptNames || !config.postProcessingMode) {
    return rawMessages;
  }

  const processed = postProcessMessages(rawMessages as ExtendedChatMessage[], {
    mode: config.postProcessingMode,
    names: config.promptNames,
    tools: config.tools,
    prefill: config.prefill,
    placeholder: config.placeholder,
  });

  return toSimpleMessages(processed);
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
