import type {
  CompiledPromptMessage,
  PromptStackMessage,
  SessionBlueprint,
} from "./types";

/** 单条提示词条目的会话级覆盖（结构与 runtime 的 StorySessionPromptOverride 一致，不跨层耦合）。 */
export interface PromptMessageOverride {
  enabled?: boolean;
  content?: string;
}

export function assemblePromptMessages(
  blueprint: Pick<SessionBlueprint, "promptStack">,
  overrides?: Record<string, PromptMessageOverride>,
): CompiledPromptMessage[] {
  return blueprint.promptStack.messages
    .map((message) => applyOverride(message, overrides?.[message.id]))
    .filter(isEnabledMessage)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sourcePath: message.sourcePath,
    }));
}

function applyOverride(
  message: PromptStackMessage,
  override?: PromptMessageOverride,
): PromptStackMessage {
  if (!override) return message;
  return {
    ...message,
    enabled: override.enabled ?? message.enabled,
    content: override.content ?? message.content,
  };
}

function isEnabledMessage(message: PromptStackMessage): boolean {
  return message.enabled && message.content.trim().length > 0;
}
