/**
 * @input  hooks/script-bridge/types, lib/data/roleplay/character-record-operation
 * @output characterHandlers
 * @pos    角色 API Handlers - SillyTavern 兼容的角色数据查询
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Character Handlers                                 ║
 * ║                                                                            ║
 * ║  实现 SillyTavern 兼容的角色 API                                          ║
 * ║  设计：从 IndexedDB 角色存储读取数据                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import {
  LocalCharacterRecordOperations,
  type CharacterRecord,
} from "@/lib/data/roleplay/character-record-operation";

// ============================================================================
//                              角色数据类型
// ============================================================================

interface CharacterData {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  mesExample?: string;
  creatorNotes?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  tags?: string[];
  creator?: string;
  characterVersion?: string;
}

// ============================================================================
//                              Handler 实现
// ============================================================================

export const characterHandlers: ApiHandlerMap = {
  /**
   * getCharacterNames - 获取所有角色名称列表
   */
  "getCharacterNames": async (_args: unknown[], _ctx: ApiCallContext): Promise<string[]> => {
    const characters = await LocalCharacterRecordOperations.getAllCharacters();
    return characters.map((c: CharacterRecord) => c.data.name);
  },

  /**
   * getCharacter - 获取指定角色详情
   * @param args [name?: string] 角色名称，不传则返回当前角色
   */
  "getCharacter": async (args: unknown[], ctx: ApiCallContext): Promise<CharacterData | null> => {
    const [name] = args as [string?];

    // 如果指定名称，按名称查找
    if (name) {
      const characters = await LocalCharacterRecordOperations.getAllCharacters();
      const char = characters.find((c: CharacterRecord) => c.data.name === name);
      if (!char) return null;

      return mapToCharacterData(char);
    }

    // 否则返回当前角色
    if (!ctx.characterId) return null;
    const char = await LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
    if (!char) return null;

    return mapToCharacterData(char);
  },

  /**
   * getCurrentCharacter - 获取当前角色完整数据
   */
  "getCurrentCharacter": async (_args: unknown[], ctx: ApiCallContext): Promise<CharacterData | null> => {
    if (!ctx.characterId) return null;

    const char = await LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
    if (!char) return null;

    return mapToCharacterData(char);
  },

  /**
   * getCharacterById - 按 ID 获取角色
   */
  "getCharacterById": async (args: unknown[], _ctx: ApiCallContext): Promise<CharacterData | null> => {
    const [id] = args as [string];
    if (!id) return null;

    const char = await LocalCharacterRecordOperations.getCharacterById(id);
    if (!char) return null;

    return mapToCharacterData(char);
  },
};

// ============================================================================
//                              辅助函数
// ============================================================================

/**
 * 将内部角色格式映射为 SillyTavern 兼容格式
 */
function mapToCharacterData(record: CharacterRecord): CharacterData {
  const raw = record.data;
  // 扩展数据在嵌套的 data 对象中
  const extended = raw.data;

  return {
    id: record.id,
    name: raw.name,
    avatar: record.imagePath,
    description: raw.description,
    personality: raw.personality,
    scenario: raw.scenario,
    firstMes: raw.first_mes,
    mesExample: raw.mes_example,
    creatorNotes: extended?.creator_notes,
    systemPrompt: extended?.system_prompt,
    postHistoryInstructions: extended?.post_history_instructions,
    tags: extended?.tags || [],
    creator: extended?.creator,
    characterVersion: extended?.character_version,
  };
}
