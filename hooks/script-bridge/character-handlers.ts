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
import type { RawCharacterData } from "@/lib/models/rawdata-model";

// ============================================================================
//                              角色数据类型
// ============================================================================

interface CharacterData {
  id: string;
  name: string;
  avatar?: string;
  version?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  first_messages?: string[];
  mesExample?: string;
  creatorNotes?: string;
  worldbook?: string | null;
  extensions?: Record<string, unknown>;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  tags?: string[];
  creator?: string;
  characterVersion?: string;
}

interface CharacterPatch {
  avatar?: string;
  version?: string;
  creator?: string;
  creator_notes?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  mes_example?: string;
  first_messages?: string[];
  worldbook?: string | null;
  extensions?: Record<string, unknown>;
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
    return characters.map((c: CharacterRecord) => c.data.data?.name || c.data.name);
  },

  /**
   * getCharacter - 获取指定角色详情
   * @param args [name?: string] 角色名称，不传则返回当前角色
   */
  "getCharacter": async (args: unknown[], ctx: ApiCallContext): Promise<CharacterData | null> => {
    const [name] = args as [string?];

    // 如果指定名称，按名称查找
    if (name) {
      const char = await findCharacterByName(name);
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

  "getCurrentCharacterName": async (_args: unknown[], ctx: ApiCallContext): Promise<string | null> => {
    if (!ctx.characterId) {
      return null;
    }

    const char = await LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
    if (!char) {
      return null;
    }

    return char.data.data?.name || char.data.name || null;
  },

  "createCharacter": async (args: unknown[], _ctx: ApiCallContext): Promise<boolean> => {
    const [nameRaw, patchRaw] = args as [unknown, CharacterPatch?];
    const characterName = ensureCharacterName(nameRaw, "createCharacter");
    const existing = await findCharacterByName(characterName);
    if (existing) {
      return false;
    }

    const patch = normalizeCharacterPatch(patchRaw, "createCharacter");
    const characterId = createCharacterId();
    const imagePath = resolveCharacterAvatarPath(characterId, patch.avatar);
    const data = buildCharacterRawData(characterId, characterName, patch);
    await LocalCharacterRecordOperations.createCharacter(characterId, data, imagePath);
    return true;
  },

  "deleteCharacter": async (args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    const [nameRaw] = args as [unknown];
    const target = await resolveCharacterRecord(nameRaw, ctx, "deleteCharacter");
    if (!target) {
      return false;
    }
    return LocalCharacterRecordOperations.deleteCharacter(target.id);
  },

  "replaceCharacter": async (args: unknown[], ctx: ApiCallContext): Promise<boolean> => {
    const [nameRaw, patchRaw] = args as [unknown, CharacterPatch?];
    const target = await resolveCharacterRecord(nameRaw, ctx, "replaceCharacter");
    if (!target) {
      return false;
    }

    const characterName = target.data.data?.name || target.data.name;
    const patch = normalizeCharacterPatch(patchRaw, "replaceCharacter");
    const nextData = buildCharacterRawData(target.id, characterName, patch, target.data);
    const updated = await LocalCharacterRecordOperations.updateCharacter(target.id, nextData);
    return Boolean(updated);
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
  const extensions = isPlainObject(extended?.extensions)
    ? extended.extensions
    : {};

  return {
    id: record.id,
    name: raw.name,
    avatar: record.imagePath,
    version: extended?.character_version,
    description: raw.description,
    personality: raw.personality,
    scenario: raw.scenario,
    firstMes: raw.first_mes,
    first_messages: [raw.first_mes, ...(extended?.alternate_greetings || [])].filter(
      (value): value is string => typeof value === "string",
    ),
    mesExample: raw.mes_example,
    creatorNotes: extended?.creator_notes,
    worldbook: typeof extensions.world === "string"
      ? extensions.world
      : extensions.world === null
        ? null
        : null,
    extensions,
    systemPrompt: extended?.system_prompt,
    postHistoryInstructions: extended?.post_history_instructions,
    tags: extended?.tags || [],
    creator: extended?.creator,
    characterVersion: extended?.character_version,
  };
}

function createCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureCharacterName(rawName: unknown, apiName: string): string {
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    throw new Error(`${apiName} requires character name`);
  }

  const name = rawName.trim();
  if (name === "current") {
    throw new Error(`${apiName} does not allow name='current'`);
  }
  return name;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCharacterPatch(rawPatch: unknown, apiName: string): CharacterPatch {
  if (rawPatch === undefined) {
    return {};
  }
  if (!isPlainObject(rawPatch)) {
    throw new Error(`${apiName} patch must be object`);
  }
  if (
    rawPatch.first_messages !== undefined &&
    !Array.isArray(rawPatch.first_messages)
  ) {
    throw new Error(`${apiName} first_messages must be array`);
  }
  if (
    rawPatch.extensions !== undefined &&
    !isPlainObject(rawPatch.extensions)
  ) {
    throw new Error(`${apiName} extensions must be plain object`);
  }
  if (
    rawPatch.worldbook !== undefined &&
    rawPatch.worldbook !== null &&
    typeof rawPatch.worldbook !== "string"
  ) {
    throw new Error(`${apiName} worldbook must be string|null`);
  }
  return rawPatch as CharacterPatch;
}

async function findCharacterByName(name: string): Promise<CharacterRecord | null> {
  const characters = await LocalCharacterRecordOperations.getAllCharacters();
  const target = characters.find((item) => {
    const displayName = item.data.data?.name || item.data.name;
    return displayName === name;
  });
  return target || null;
}

async function resolveCharacterRecord(
  rawName: unknown,
  ctx: ApiCallContext,
  apiName: string,
): Promise<CharacterRecord | null> {
  if (rawName === "current" || rawName === undefined || rawName === null || rawName === "") {
    if (!ctx.characterId) {
      return null;
    }
    return LocalCharacterRecordOperations.getCharacterById(ctx.characterId);
  }

  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    throw new Error(`${apiName} requires character name`);
  }

  return findCharacterByName(rawName.trim());
}

function resolveCharacterAvatarPath(characterId: string, avatar?: string): string {
  if (typeof avatar === "string" && avatar.trim().length > 0) {
    return avatar.trim();
  }
  return `${characterId}.png`;
}

function normalizeCharacterMessages(
  patch: CharacterPatch,
  previous?: RawCharacterData,
): string[] {
  if (Array.isArray(patch.first_messages)) {
    return patch.first_messages
      .map((item) => String(item ?? ""))
      .filter((item) => item.length > 0);
  }

  const firstMes = previous?.first_mes || previous?.data?.first_mes || "";
  const alternates = Array.isArray(previous?.data?.alternate_greetings)
    ? previous?.data?.alternate_greetings
    : [];
  return [firstMes, ...alternates].filter((item) => typeof item === "string" && item.length > 0);
}

function mergeCharacterExtensions(
  patch: CharacterPatch,
  previous?: RawCharacterData,
): Record<string, unknown> {
  const previousExtensions = isPlainObject(previous?.data?.extensions)
    ? { ...previous.data.extensions }
    : {};
  const nextExtensions = patch.extensions
    ? { ...previousExtensions, ...patch.extensions }
    : previousExtensions;

  if (patch.worldbook !== undefined) {
    if (patch.worldbook === null) {
      delete nextExtensions.world;
    } else {
      nextExtensions.world = patch.worldbook;
    }
  }

  return nextExtensions;
}

function buildCharacterRawData(
  characterId: string,
  characterName: string,
  patch: CharacterPatch,
  previous?: RawCharacterData,
): RawCharacterData {
  const base = previous || {
    id: characterId,
    name: characterName,
    description: "",
    personality: "",
    first_mes: "",
    scenario: "",
    mes_example: "",
    creatorcomment: "",
    avatar: "",
    sample_status: "",
    data: {
      name: characterName,
      description: "",
      personality: "",
      first_mes: "",
      scenario: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags: [],
      creator: "",
      character_version: "",
      alternate_greetings: [],
      character_book: {
        entries: [],
      },
      extensions: {},
    },
  };

  const messages = normalizeCharacterMessages(patch, previous);
  const firstMes = messages[0] || "";
  const alternateGreetings = messages.slice(1);
  const extensions = mergeCharacterExtensions(patch, previous);

  return {
    ...base,
    id: characterId,
    name: characterName,
    description: patch.description ?? base.description ?? "",
    personality: patch.personality ?? base.personality ?? "",
    first_mes: firstMes,
    scenario: patch.scenario ?? base.scenario ?? "",
    mes_example: patch.mes_example ?? base.mes_example ?? "",
    creatorcomment: patch.creator_notes ?? base.creatorcomment ?? "",
    avatar: patch.avatar ?? base.avatar ?? "",
    sample_status: base.sample_status ?? "",
    data: {
      ...base.data,
      name: characterName,
      description: patch.description ?? base.data?.description ?? base.description ?? "",
      personality: patch.personality ?? base.data?.personality ?? base.personality ?? "",
      first_mes: firstMes,
      scenario: patch.scenario ?? base.data?.scenario ?? base.scenario ?? "",
      mes_example: patch.mes_example ?? base.data?.mes_example ?? base.mes_example ?? "",
      creator_notes: patch.creator_notes ?? base.data?.creator_notes ?? "",
      creator: patch.creator ?? base.data?.creator ?? "",
      character_version: patch.version ?? base.data?.character_version ?? "",
      alternate_greetings: alternateGreetings,
      character_book: base.data?.character_book || {
        entries: [],
      },
      extensions,
    },
  };
}
