/**
 * @input  lib/data/roleplay/character-record-operation
 * @output createCharacterAdapters
 * @pos    Slash 执行上下文适配 - 角色查询与标签管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Character Adapter                                   ║
 * ║                                                                           ║
 * ║  职责：角色摘要、角色列表、角色标签 CRUD                                ║
 * ║  模式：工厂函数，接收闭包变量 characterId                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { CharacterSummary } from "@/lib/slash-command/types";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";

/* ────────────────────────────────────────────────────────────
 *  工具函数
 * ──────────────────────────────────────────────────────────── */

export function toCharacterSummary(
  record: {
    id: string;
    data?: {
      name?: string;
      data?: {
        name?: string;
        tags?: unknown[];
      };
    };
  },
): CharacterSummary {
  return {
    id: record.id,
    name: record.data?.name?.trim() || record.data?.data?.name?.trim() || record.id,
    tags: Array.isArray(record.data?.data?.tags)
      ? record.data.data.tags
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
      : undefined,
  };
}

/* ────────────────────────────────────────────────────────────
 *  工厂函数
 * ──────────────────────────────────────────────────────────── */

export function createCharacterAdapters(characterId: string | undefined) {

  const getCurrentCharacter = async (): Promise<CharacterSummary | undefined> => {
    if (!characterId) return undefined;
    const record = await LocalCharacterRecordOperations.getCharacterById(characterId);
    if (!record) return undefined;
    return toCharacterSummary(record);
  };

  const listCharacters = async (): Promise<CharacterSummary[]> => {
    const records = await LocalCharacterRecordOperations.getAllCharacters();
    return records.map(toCharacterSummary);
  };

  const resolveCharacterTagRecord = async (name?: string) => {
    const target = (name || "").trim();
    if (!target || target === "current") {
      if (!characterId) {
        return null;
      }
      return LocalCharacterRecordOperations.getCharacterById(characterId);
    }

    const records = await LocalCharacterRecordOperations.getAllCharacters();
    return records.find((record) => {
      const currentName = record.data?.data?.name || record.data?.name || "";
      return record.id === target || currentName === target;
    }) || null;
  };

  const readCharacterTags = (record: Awaited<ReturnType<typeof resolveCharacterTagRecord>>): string[] => {
    const rawTags = Array.isArray(record?.data?.data?.tags) ? record.data.data.tags : [];
    return Array.from(new Set(
      rawTags
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    ));
  };

  const writeCharacterTags = async (
    record: NonNullable<Awaited<ReturnType<typeof resolveCharacterTagRecord>>>,
    tags: string[],
  ): Promise<boolean> => {
    const updated = await LocalCharacterRecordOperations.updateCharacter(record.id, {
      data: {
        ...record.data.data,
        tags,
      },
    });
    return Boolean(updated);
  };

  const addCharacterTag = async (
    tagName: string,
    options?: { name?: string },
  ): Promise<boolean> => {
    const tag = tagName.trim();
    if (!tag) {
      return false;
    }

    const record = await resolveCharacterTagRecord(options?.name);
    if (!record) {
      return false;
    }

    const tags = readCharacterTags(record);
    if (tags.includes(tag)) {
      return false;
    }

    return writeCharacterTags(record, [...tags, tag]);
  };

  const removeCharacterTag = async (
    tagName: string,
    options?: { name?: string },
  ): Promise<boolean> => {
    const tag = tagName.trim();
    if (!tag) {
      return false;
    }

    const record = await resolveCharacterTagRecord(options?.name);
    if (!record) {
      return false;
    }

    const tags = readCharacterTags(record);
    if (!tags.includes(tag)) {
      return false;
    }

    return writeCharacterTags(record, tags.filter((item) => item !== tag));
  };

  const hasCharacterTag = async (
    tagName: string,
    options?: { name?: string },
  ): Promise<boolean> => {
    const tag = tagName.trim();
    if (!tag) {
      return false;
    }

    const record = await resolveCharacterTagRecord(options?.name);
    if (!record) {
      return false;
    }

    return readCharacterTags(record).includes(tag);
  };

  const listCharacterTags = async (options?: { name?: string }): Promise<string[]> => {
    const record = await resolveCharacterTagRecord(options?.name);
    if (!record) {
      return [];
    }
    return readCharacterTags(record);
  };

  return {
    getCurrentCharacter,
    listCharacters,
    addCharacterTag,
    removeCharacterTag,
    hasCharacterTag,
    listCharacterTags,
  };
}
