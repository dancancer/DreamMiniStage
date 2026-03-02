/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Character Command Handlers                             ║
 * ║                                                                           ║
 * ║  角色命令 - char / character / char-find                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler, CharacterSummary } from "../types";

function findCharacterMatches(characters: CharacterSummary[], keyword: string): CharacterSummary[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return characters;
  return characters.filter((character) => (
    character.name.toLowerCase().includes(normalized) ||
    character.id.toLowerCase().includes(normalized)
  ));
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

  await ctx.switchCharacter(target);
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
