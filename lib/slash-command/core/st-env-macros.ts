import { createMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import type { ExecutionContext } from "@/lib/slash-command/types";

type MacroPrimitive = string | number | boolean;

function toMacroPrimitive(value: unknown): MacroPrimitive | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return undefined;
}

function pickMacroVariables(
  source: Record<string, unknown> | undefined,
): Record<string, MacroPrimitive> {
  if (!source) {
    return {};
  }

  const result: Record<string, MacroPrimitive> = {};
  for (const [key, value] of Object.entries(source)) {
    const primitive = toMacroPrimitive(value);
    if (primitive !== undefined) {
      result[key] = primitive;
    }
  }
  return result;
}

function findLastMessageContent(
  messages: Array<{ role: string; content: string }>,
  matcher: (role: string) => boolean,
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && matcher(message.role)) {
      return message.content;
    }
  }
  return "";
}

async function resolveCharacterName(ctx: ExecutionContext): Promise<string> {
  const currentCharacter = await Promise.resolve(ctx.getCurrentCharacter?.());
  if (currentCharacter?.name?.trim()) {
    return currentCharacter.name.trim();
  }

  if (!ctx.characterId) {
    return "Character";
  }

  const record = await LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
  const displayName = record?.data?.data?.name || record?.data?.name;
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName.trim();
  }

  return ctx.characterId;
}

function protectSlashCompatMacros(command: string): {
  restore: (input: string) => string;
  value: string;
} {
  const protectedEntries: string[] = [];
  const value = command.replace(
    /\{\{((?:arg|var|getvar|globalvar|getglobalvar)::[^}]+)\}\}/gi,
    (match) => {
      const token = `__DMS_SLASH_MACRO_${protectedEntries.length}__`;
      protectedEntries.push(match);
      return token;
    },
  );

  return {
    value,
    restore: (input: string) => protectedEntries.reduce(
      (current, entry, index) => current.replaceAll(`__DMS_SLASH_MACRO_${index}__`, entry),
      input,
    ),
  };
}

async function buildMacroEnv(ctx: ExecutionContext): Promise<MacroEnv> {
  const globalVariables = ctx.dumpScopedVariables?.("global")
    ?? {};
  const localVariables = ctx.dumpScopedVariables?.("local")
    ?? ctx.dumpVariables?.()
    ?? {};
  const personaName = ctx.getPersonaName
    ? await Promise.resolve(ctx.getPersonaName())
    : "User";
  const lastMessage = ctx.messages[ctx.messages.length - 1];

  return {
    user: typeof personaName === "string" && personaName.trim().length > 0
      ? personaName.trim()
      : "User",
    char: await resolveCharacterName(ctx),
    lastMessage: lastMessage?.content || "",
    lastUserMessage: findLastMessageContent(ctx.messages, (role) => role === "user"),
    lastCharMessage: findLastMessageContent(
      ctx.messages,
      (role) => role !== "user" && role !== "system",
    ),
    lastMessageId: ctx.messages.length > 0 ? ctx.messages.length - 1 : undefined,
    messageCount: ctx.messages.length,
    ...pickMacroVariables(globalVariables),
    ...pickMacroVariables(localVariables),
  };
}

function replaceExecutionOnlyMacros(
  value: string,
  env: MacroEnv,
): string {
  return value.replace(
    /\{\{messageCount\}\}/gi,
    () => String(env.messageCount ?? 0),
  );
}

export async function expandStEnvMacros(
  value: string,
  ctx: ExecutionContext,
): Promise<string> {
  if (!value.includes("{{")) {
    return value;
  }

  const protectedValue = protectSlashCompatMacros(value);
  if (!protectedValue.value.includes("{{")) {
    return protectedValue.restore(protectedValue.value);
  }

  const macroEnv = await buildMacroEnv(ctx);
  const evaluator = createMacroEvaluator();
  const expanded = evaluator.evaluate(protectedValue.value, macroEnv);
  return protectedValue.restore(replaceExecutionOnlyMacros(expanded, macroEnv));
}
