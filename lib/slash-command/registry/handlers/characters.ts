/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Character Command Handlers                             ║
 * ║                                                                           ║
 * ║  角色命令 - char / character / char-find / ask                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { CharacterSummary, CharacterSwitchResult } from "../../types";
import { parseBoolean } from "../utils/helpers";

function findCharacterMatches(characters: CharacterSummary[], keyword: string): CharacterSummary[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return characters;
  return characters.filter((character) => (
    character.name.toLowerCase().includes(normalized) ||
    character.id.toLowerCase().includes(normalized)
  ));
}

function isCharacterSwitchResult(value: unknown): value is CharacterSwitchResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CharacterSwitchResult>;
  return (
    typeof candidate.target === "string" &&
    typeof candidate.characterId === "string" &&
    typeof candidate.characterName === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.sessionName === "string"
  );
}

function normalizeAskReturnType(raw: string | undefined): "pipe" | "none" {
  const normalized = (raw || "pipe").trim().toLowerCase();
  if (normalized === "pipe" || normalized === "none") {
    return normalized;
  }
  throw new Error(`/ask invalid return value: ${raw || ""}`);
}

function parseStrictOptionalBoolean(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw}`);
  }
  return parsed;
}

function normalizeDupeResult(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new Error("/dupe host returned non-string result");
  }
  return value;
}

/** /char [name|id] - 读取当前角色，或切换角色 */
export const handleCharacter: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const target = (args.join(" ") || namedArgs.name || namedArgs.id || pipe || "").trim();

  if (!target) {
    if (!ctx.getCurrentCharacter) {
      throw new Error("/char is not available in current context");
    }
    const current = await ctx.getCurrentCharacter();
    return current ? JSON.stringify(current) : "";
  }

  if (!ctx.switchCharacter) {
    throw new Error("/char switch is not available in current context");
  }

  const switchResult = await ctx.switchCharacter(target);
  if (isCharacterSwitchResult(switchResult)) {
    return JSON.stringify(switchResult);
  }
  return target;
};

/** /char-find [query] - 按名称/ID 查找角色 */
export const handleCharacterFind: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.listCharacters) {
    throw new Error("/char-find is not available in current context");
  }

  const query = (args.join(" ") || namedArgs.query || pipe || "").trim();
  const characters = await ctx.listCharacters();
  return JSON.stringify(findCharacterMatches(characters, query));
};

/** /ask name=<character> [prompt] - 询问指定角色 */
export const handleAsk: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.askCharacter) {
    throw new Error("/ask is not available in current context");
  }

  const target = (namedArgs.name || "").trim();
  if (!target) {
    throw new Error("/ask requires name=<character>");
  }

  const prompt = args.join(" ") || pipe || "";
  const returnType = normalizeAskReturnType(namedArgs.return);
  const result = await Promise.resolve(ctx.askCharacter(target, prompt, { returnType }));

  if (returnType === "none") {
    return "";
  }
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result !== "string") {
    throw new Error("/ask host returned non-string result");
  }
  return result;
};

/** /dupe - 复制当前角色 */
export const handleDupe: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.duplicateCharacter) {
    throw new Error("/dupe is not available in current context");
  }

  const result = await Promise.resolve(ctx.duplicateCharacter());
  return normalizeDupeResult(result);
};

/** /rename-char <name> - 重命名当前角色 */
export const handleRenameCharacter: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.renameCurrentCharacter) {
    throw new Error("/rename-char is not available in current context");
  }

  const nextName = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!nextName) {
    throw new Error("/rename-char requires a character name");
  }

  const silent = parseStrictOptionalBoolean(namedArgs.silent, "rename-char", "silent");
  const chats = parseStrictOptionalBoolean(namedArgs.chats, "rename-char", "chats");
  const result = await Promise.resolve(ctx.renameCurrentCharacter(nextName, { silent, chats }));
  if (typeof result !== "string") {
    throw new Error("/rename-char host returned non-string result");
  }
  return result;
};
