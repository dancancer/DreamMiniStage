/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Bulk Operations Hook                                   ║
 * ║                                                                           ║
 * ║  批量操作 - 启用/禁用/删除/导出                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback } from "react";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { exportToGlobalRegexScripts } from "@/function/regex/global";
import type { RegexScript } from "@/lib/models/regex-script-model";
import type { ExportOptions, ExportResult } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export function useBulkOperations(
  characterId: string,
  reloadScoped: () => Promise<void>,
  reloadGlobal: () => Promise<void>
) {
  // ─── 批量启用 ───
  const bulkEnable = useCallback(
    async (scriptIds: string[]) => {
      if (scriptIds.length === 0) return false;
      try {
        const success = await RegexScriptOperations.bulkEnable(characterId, scriptIds);
        if (success) await reloadScoped();
        return success;
      } catch (error) {
        console.error("Error bulk enabling scripts:", error);
        return false;
      }
    },
    [characterId, reloadScoped]
  );

  // ─── 批量禁用 ───
  const bulkDisable = useCallback(
    async (scriptIds: string[]) => {
      if (scriptIds.length === 0) return false;
      try {
        const success = await RegexScriptOperations.bulkDisable(characterId, scriptIds);
        if (success) await reloadScoped();
        return success;
      } catch (error) {
        console.error("Error bulk disabling scripts:", error);
        return false;
      }
    },
    [characterId, reloadScoped]
  );

  // ─── 批量删除 ───
  const bulkDelete = useCallback(
    async (scriptIds: string[]) => {
      if (scriptIds.length === 0) return false;
      try {
        const success = await RegexScriptOperations.bulkDelete(characterId, scriptIds);
        if (success) await reloadScoped();
        return success;
      } catch (error) {
        console.error("Error bulk deleting scripts:", error);
        return false;
      }
    },
    [characterId, reloadScoped]
  );

  // ─── 批量启用（指定 owner） ───
  const bulkEnableForOwner = useCallback(
    async (ownerId: string, scriptIds: string[], _currentScripts: Record<string, RegexScript>) => {
      if (scriptIds.length === 0) return false;
      if (ownerId === characterId) return bulkEnable(scriptIds);
      try {
        const success = await RegexScriptOperations.bulkEnable(ownerId, scriptIds);
        if (success) await reloadGlobal();
        return success;
      } catch (error) {
        console.error("Error bulk enabling scripts for owner:", error);
        return false;
      }
    },
    [bulkEnable, characterId, reloadGlobal]
  );

  // ─── 批量禁用（指定 owner） ───
  const bulkDisableForOwner = useCallback(
    async (ownerId: string, scriptIds: string[], _currentScripts: Record<string, RegexScript>) => {
      if (scriptIds.length === 0) return false;
      if (ownerId === characterId) return bulkDisable(scriptIds);
      try {
        const success = await RegexScriptOperations.bulkDisable(ownerId, scriptIds);
        if (success) await reloadGlobal();
        return success;
      } catch (error) {
        console.error("Error bulk disabling scripts for owner:", error);
        return false;
      }
    },
    [bulkDisable, characterId, reloadGlobal]
  );

  // ─── 批量删除（指定 owner） ───
  const bulkDeleteForOwner = useCallback(
    async (ownerId: string, scriptIds: string[], _currentScripts: Record<string, RegexScript>) => {
      if (scriptIds.length === 0) return false;
      if (ownerId === characterId) return bulkDelete(scriptIds);
      try {
        const success = await RegexScriptOperations.bulkDelete(ownerId, scriptIds);
        if (success) await reloadGlobal();
        return success;
      } catch (error) {
        console.error("Error bulk deleting scripts for owner:", error);
        return false;
      }
    },
    [bulkDelete, characterId, reloadGlobal]
  );

  // ─── 导出到全局 ───
  const exportSelectedToGlobal = useCallback(
    async (ownerId: string, scriptIds: string[], options?: ExportOptions): Promise<ExportResult> => {
      if (scriptIds.length === 0) return { success: false, message: "No scripts selected" };
      try {
        const result = await exportToGlobalRegexScripts(ownerId, scriptIds, options);
        await reloadGlobal();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Export failed";
        console.error("Error exporting to global:", error);
        return { success: false, message: errorMessage };
      }
    },
    [reloadGlobal]
  );

  return {
    bulkEnable,
    bulkDisable,
    bulkDelete,
    bulkEnableForOwner,
    bulkDisableForOwner,
    bulkDeleteForOwner,
    exportSelectedToGlobal,
  };
}
