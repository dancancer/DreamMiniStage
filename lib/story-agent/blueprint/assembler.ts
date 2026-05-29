import type {
  CompiledPromptMessage,
  PromptStackMessage,
  SessionBlueprint,
} from "./types";

export function assemblePromptMessages(
  blueprint: Pick<SessionBlueprint, "promptStack">,
): CompiledPromptMessage[] {
  return blueprint.promptStack.messages
    .filter(isEnabledMessage)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sourcePath: message.sourcePath,
    }));
}

function isEnabledMessage(message: PromptStackMessage): boolean {
  return message.enabled && message.content.trim().length > 0;
}
