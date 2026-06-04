/**
 * @input  hooks/script-bridge/types, lib/data/roleplay/world-book-operation, lib/data/roleplay/world-book-keys, function/worldbook/*
 * @output worldbookHandlers
 * @pos    世界书操作 Handlers - WorldBook 的完整 CRUD 与绑定管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         世界书操作 Handlers                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import {
  createCharacterWorldBookRecordKey,
  isWorldBookSettingsRecordKey,
} from "@/lib/data/roleplay/world-book-keys";
import { importWorldBookFromJson } from "@/function/worldbook/import";
import {
  listGlobalWorldBooks,
  importFromGlobalWorldBook,
  saveAsGlobalWorldBook,
  deleteGlobalWorldBook,
} from "@/function/worldbook/global";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { ApiCallContext, ApiHandlerMap } from "./types";

// ============================================================================
//                              基础 CRUD
// ============================================================================

function getCurrentCharacterWorldBookKey(ctx: ApiCallContext): string | null {
  return ctx.characterId ? createCharacterWorldBookRecordKey(ctx.characterId) : null;
}

function resolveTargetWorldBookKey(ctx: ApiCallContext, target?: string): string | null {
  const normalized = target?.trim();
  return normalized || getCurrentCharacterWorldBookKey(ctx);
}

async function get(args: unknown[], ctx: ApiCallContext) {
  const [id] = args as [string];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey) return null;
  const wb = await WorldBookOperations.getWorldBook(worldBookKey);
  if (!wb) return null;
  const normalizedId = String(id);
  return (
    Object.values(wb).find(
      (e: WorldBookEntry) =>
        (e.id !== undefined && String(e.id) === normalizedId) ||
        (e.entry_id !== undefined && String(e.entry_id) === normalizedId)
    ) ||
    wb[id as keyof typeof wb] ||
    null
  );
}

async function search(args: unknown[], ctx: ApiCallContext) {
  const [query] = args as [string];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !query) return [];
  const wb = await WorldBookOperations.getWorldBook(worldBookKey);
  if (!wb) return [];
  const lowerQuery = query.toLowerCase();
  return Object.values(wb).filter(
    (e: WorldBookEntry) =>
      e.keys.some((k: string) => k.toLowerCase().includes(lowerQuery)) ||
      e.content.toLowerCase().includes(lowerQuery)
  );
}

async function replace(args: unknown[], ctx: ApiCallContext) {
  const [entries] = args as [Record<string, WorldBookEntry> | WorldBookEntry[]];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey) return false;
  return WorldBookOperations.updateWorldBook(worldBookKey, entries || {});
}

async function createEntry(args: unknown[], ctx: ApiCallContext) {
  const [entry] = args as [WorldBookEntry];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !entry) return null;
  return WorldBookOperations.addWorldBookEntry(worldBookKey, entry);
}

async function updateEntry(args: unknown[], ctx: ApiCallContext) {
  const [entryId, updates] = args as [string, Partial<WorldBookEntry>];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !entryId) return false;
  return WorldBookOperations.updateWorldBookEntry(worldBookKey, entryId, updates || {});
}

async function deleteEntry(args: unknown[], ctx: ApiCallContext) {
  const [entryId] = args as [string];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !entryId) return false;
  return WorldBookOperations.deleteWorldBookEntry(worldBookKey, entryId);
}

// ============================================================================
//                              导入导出
// ============================================================================

async function importJson(args: unknown[], ctx: ApiCallContext) {
  const [json, options] = args as [string | Record<string, unknown>, Record<string, unknown>?];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey) return { success: false, message: "Missing characterId" };
  const content = typeof json === "string" ? json : JSON.stringify(json || {});
  return importWorldBookFromJson(worldBookKey, JSON.parse(content), options as any);
}

async function exportWb(args: unknown[], ctx: ApiCallContext) {
  const [targetId] = args as [string?];
  const target = resolveTargetWorldBookKey(ctx, targetId);
  if (!target) return null;
  return WorldBookOperations.getWorldBook(target);
}

// ============================================================================
//                              名称列表
// ============================================================================

async function getNames() {
  const worldBooks = await WorldBookOperations.getWorldBooks();
  return Object.keys(worldBooks).filter((key) => !isWorldBookSettingsRecordKey(key));
}

async function getGlobalNames() {
  const result = await listGlobalWorldBooks();
  if (!result.success) return [];
  return result.globalWorldBooks.map((book) => book.name || book.id);
}

// ============================================================================
//                              全局世界书绑定
// ============================================================================

async function rebindGlobalWorldbooks(args: unknown[]) {
  const [names] = args as [string[]];
  await WorldBookOperations.updateWorldBookSettings("global_binding", {
    metadata: { selected: names || [] },
  });
  return names || [];
}

async function saveAsGlobal(args: unknown[], ctx: ApiCallContext) {
  const [name, description] = args as [string, string?];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !name) return { success: false, message: "Missing character or name" };
  return saveAsGlobalWorldBook(worldBookKey, name, description, ctx.characterId);
}

async function importFromGlobal(args: unknown[], ctx: ApiCallContext) {
  const [globalId] = args as [string];
  const worldBookKey = getCurrentCharacterWorldBookKey(ctx);
  if (!worldBookKey || !globalId) return { success: false, message: "Missing ids" };
  return importFromGlobalWorldBook(worldBookKey, globalId);
}

async function deleteGlobal(args: unknown[]) {
  const [globalId] = args as [string];
  if (!globalId) return { success: false, message: "Missing globalId" };
  return deleteGlobalWorldBook(globalId);
}

// ============================================================================
//                              角色世界书绑定
// ============================================================================

async function getCharWorldbookNames(args: unknown[], ctx: ApiCallContext) {
  const [target] = args as [string?];
  const targetId = !target || target === "current" ? ctx.characterId : target;
  if (!targetId) return { primary: null, additional: [] };
  const settings = await WorldBookOperations.getWorldBookSettings(targetId);
  const bindings = (settings as any)?.metadata?.bindings?.character || {};
  return {
    primary: bindings.primary ?? targetId,
    additional: bindings.additional ?? [],
  };
}

async function rebindCharWorldbooks(args: unknown[], ctx: ApiCallContext) {
  const [target, bindings] = args as [string, { primary?: string; additional?: string[] }];
  const targetId = !target || target === "current" ? ctx.characterId : target;
  if (!targetId) return false;
  const settings = await WorldBookOperations.getWorldBookSettings(targetId);
  await WorldBookOperations.updateWorldBookSettings(targetId, {
    ...settings,
    metadata: {
      ...(settings as any)?.metadata,
      bindings: {
        ...((settings as any)?.metadata?.bindings || {}),
        character: {
          primary: bindings?.primary ?? targetId,
          additional: bindings?.additional ?? [],
        },
      },
    },
  });
  return true;
}

// ============================================================================
//                              聊天世界书绑定
// ============================================================================

async function getChatWorldbookName(args: unknown[], ctx: ApiCallContext) {
  const [chat] = args as [string?];
  const targetChat = !chat || chat === "current" ? ctx.characterId : chat;
  if (!targetChat) return null;
  const settings = await WorldBookOperations.getWorldBookSettings(targetChat);
  return (settings as any)?.metadata?.bindings?.chat || targetChat;
}

async function rebindChatWorldbook(args: unknown[], ctx: ApiCallContext) {
  const [chat, name] = args as [string, string];
  const targetChat = !chat || chat === "current" ? ctx.characterId : chat;
  if (!targetChat) return false;
  const settings = await WorldBookOperations.getWorldBookSettings(targetChat);
  await WorldBookOperations.updateWorldBookSettings(targetChat, {
    ...settings,
    metadata: {
      ...(settings as any)?.metadata,
      bindings: { ...(settings as any)?.metadata?.bindings, chat: name },
    },
  });
  return name;
}

async function getOrCreateChatWorldbook(args: unknown[], ctx: ApiCallContext) {
  const [chat, name] = args as [string?, string?];
  const targetChat = !chat || chat === "current" ? ctx.characterId : chat;
  const targetName = name || targetChat;
  if (!targetName) return null;
  const wb = await WorldBookOperations.getWorldBook(targetName);
  if (!wb) {
    await WorldBookOperations.updateWorldBook(targetName, {});
  }
  return targetName;
}

// ============================================================================
//                              世界书管理
// ============================================================================

async function createWorldbook(args: unknown[], ctx: ApiCallContext) {
  const [name, entries] = args as [string, Record<string, WorldBookEntry> | WorldBookEntry[] | undefined];
  const targetName = resolveTargetWorldBookKey(ctx, name);
  if (!targetName) return null;
  await WorldBookOperations.updateWorldBook(targetName, entries || {});
  return targetName;
}

async function deleteWorldbook(args: unknown[], ctx: ApiCallContext) {
  const [name] = args as [string];
  const targetName = resolveTargetWorldBookKey(ctx, name);
  if (!targetName) return false;
  return WorldBookOperations.deleteWorldBook(targetName);
}

async function replaceWorldbook(args: unknown[], ctx: ApiCallContext) {
  const [entries, target] = args as [Record<string, WorldBookEntry> | WorldBookEntry[], string?];
  const targetName = resolveTargetWorldBookKey(ctx, target);
  if (!targetName) return false;
  return WorldBookOperations.updateWorldBook(targetName, entries || {});
}

async function updateWorldbookWith(args: unknown[], ctx: ApiCallContext) {
  const [entries, target] = args as [Record<string, WorldBookEntry>, string?];
  const targetName = resolveTargetWorldBookKey(ctx, target);
  if (!targetName) return false;
  const current = (await WorldBookOperations.getWorldBook(targetName)) || {};
  const merged = { ...current, ...(entries || {}) };
  return WorldBookOperations.updateWorldBook(targetName, merged);
}

async function createWorldbookEntries(args: unknown[], ctx: ApiCallContext) {
  const [entries, target] = args as [WorldBookEntry[], string?];
  const targetName = resolveTargetWorldBookKey(ctx, target);
  if (!targetName || !Array.isArray(entries)) return [];
  const current = (await WorldBookOperations.getWorldBook(targetName)) || {};
  const createdIds: string[] = [];
  for (const entry of entries) {
    const entryId = `entry_${Object.keys(current).length + createdIds.length}`;
    current[entryId] = entry;
    createdIds.push(entryId);
  }
  await WorldBookOperations.updateWorldBook(targetName, current);
  return createdIds;
}

async function deleteWorldbookEntries(args: unknown[], ctx: ApiCallContext) {
  const [entryIds, target] = args as [string[], string?];
  const targetName = resolveTargetWorldBookKey(ctx, target);
  if (!targetName || !Array.isArray(entryIds)) return false;
  const current = (await WorldBookOperations.getWorldBook(targetName)) || {};
  entryIds.forEach((id) => delete current[id]);
  return WorldBookOperations.updateWorldBook(targetName, current);
}

// ============================================================================
//                              导出 Handler Map
// ============================================================================

export const worldbookHandlers: ApiHandlerMap = {
  // 基础 CRUD
  "worldbook.get": get,
  "worldbook.search": search,
  "worldbook.replace": replace,
  "worldbook.createEntry": createEntry,
  "worldbook.updateEntry": updateEntry,
  "worldbook.deleteEntry": deleteEntry,
  // 导入导出
  "worldbook.importJson": importJson,
  "worldbook.export": exportWb,
  // 名称列表
  "worldbook.getNames": getNames,
  "getWorldbookNames": getNames,
  "worldbook.getGlobalNames": getGlobalNames,
  "getGlobalWorldbookNames": getGlobalNames,
  // 全局绑定
  "worldbook.rebindGlobalWorldbooks": rebindGlobalWorldbooks,
  "worldbook.saveAsGlobal": saveAsGlobal,
  "worldbook.importFromGlobal": importFromGlobal,
  "worldbook.deleteGlobal": deleteGlobal,
  // 角色绑定
  "worldbook.getCharWorldbookNames": getCharWorldbookNames,
  "worldbook.rebindCharWorldbooks": rebindCharWorldbooks,
  // 聊天绑定
  "worldbook.getChatWorldbookName": getChatWorldbookName,
  "worldbook.rebindChatWorldbook": rebindChatWorldbook,
  "worldbook.getOrCreateChatWorldbook": getOrCreateChatWorldbook,
  // 世界书管理
  "worldbook.createWorldbook": createWorldbook,
  "worldbook.createOrReplaceWorldbook": createWorldbook,
  "worldbook.deleteWorldbook": deleteWorldbook,
  "worldbook.replaceWorldbook": replaceWorldbook,
  "worldbook.updateWorldbookWith": updateWorldbookWith,
  "worldbook.createWorldbookEntries": createWorldbookEntries,
  "worldbook.deleteWorldbookEntries": deleteWorldbookEntries,
};
