/**
 * @input  function/regex/add, function/regex/update, function/regex/delete, lib/models/regex-script-model
 * @output useScriptCRUD
 * @pos    正则脚本 CRUD Hook - 脚本的增删改查与切换操作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Script CRUD Operations Hook                          ║
 * ║                                                                           ║
 * ║  CRUD 操作 - 增删改查和设置更新                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useCallback } from "react";
import { addRegexScript } from "@/function/regex/add";
import { updateRegexScript } from "@/function/regex/update";
import { deleteRegexScript } from "@/function/regex/delete";
import { updateRegexScriptSettings } from "@/function/regex/update-setting";
import type { RegexScript, RegexScriptSettings } from "@/lib/models/regex-script-model";
import type { ScriptWithKey } from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export function useScriptCRUD(
  characterId: string,
  scripts: Record<string, RegexScript>,
  setScripts: (scripts: Record<string, RegexScript> | ((prev: Record<string, RegexScript>) => Record<string, RegexScript>)) => void,
  setSettings: (settings: RegexScriptSettings) => void,
  reloadScoped: () => Promise<void>,
  reloadGlobal: () => Promise<void>
) {
  const [isSaving, setIsSaving] = useState(false);

  // ─── 保存脚本 ───
  const saveScript = useCallback(
    async (script: ScriptWithKey) => {
      setIsSaving(true);
      try {
        const { scriptKey } = script;
        if (scriptKey) {
          await updateRegexScript(characterId, scriptKey, script);
          setScripts((prev) => ({
            ...prev,
            [scriptKey]: { ...prev[scriptKey], ...script },
          }));
        } else {
          const newKey = await addRegexScript(characterId, script as RegexScript);
          if (newKey) {
            setScripts((prev) => ({
              ...prev,
              [newKey]: { ...(script as RegexScript), scriptKey: newKey },
            }));
          } else {
            await reloadScoped();
          }
        }
      } catch (error) {
        console.error("Error saving script:", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [characterId, reloadScoped, setScripts]
  );

  // ─── 保存到指定 owner ───
  const saveScriptForOwner = useCallback(
    async (ownerId: string, script: ScriptWithKey) => {
      setIsSaving(true);
      try {
        const scriptKey = script.scriptKey;
        if (scriptKey) {
          await updateRegexScript(ownerId, scriptKey, script);
        } else {
          await addRegexScript(ownerId, script as RegexScript);
        }
        if (ownerId === characterId) {
          await reloadScoped();
        } else {
          await reloadGlobal();
        }
      } catch (error) {
        console.error("Error saving script for owner:", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [characterId, reloadGlobal, reloadScoped]
  );

  // ─── 删除脚本 ───
  const deleteScript = useCallback(
    async (scriptId: string) => {
      try {
        await deleteRegexScript(characterId, scriptId);
        setScripts((prev) => {
          const next = { ...prev };
          delete next[scriptId];
          return next;
        });
        return true;
      } catch (error) {
        console.error("Error deleting script:", error);
        return false;
      }
    },
    [characterId, setScripts]
  );

  // ─── 删除指定 owner 的脚本 ───
  const deleteScriptForOwner = useCallback(
    async (ownerId: string, scriptId: string) => {
      try {
        await deleteRegexScript(ownerId, scriptId);
        if (ownerId === characterId) {
          setScripts((prev) => {
            const next = { ...prev };
            delete next[scriptId];
            return next;
          });
        } else {
          await reloadGlobal();
        }
        return true;
      } catch (error) {
        console.error("Error deleting script for owner:", error);
        return false;
      }
    },
    [characterId, reloadGlobal, setScripts]
  );

  // ─── 切换脚本启用状态 ───
  const toggleScript = useCallback(
    async (scriptId: string) => {
      const script = scripts[scriptId];
      if (!script) return;

      const newDisabled = !script.disabled;

      // 乐观更新
      setScripts((prev) => ({
        ...prev,
        [scriptId]: { ...prev[scriptId], disabled: newDisabled },
      }));

      try {
        await updateRegexScript(characterId, scriptId, { disabled: newDisabled });
      } catch (error) {
        // 回滚
        setScripts((prev) => ({
          ...prev,
          [scriptId]: { ...prev[scriptId], disabled: !newDisabled },
        }));
        console.error("Error toggling script:", error);
      }
    },
    [characterId, scripts, setScripts]
  );

  // ─── 切换指定 owner 的脚本 ───
  const toggleScriptForOwner = useCallback(
    async (ownerId: string, scriptId: string, currentScripts: Record<string, RegexScript>) => {
      const script = currentScripts[scriptId];
      if (!script) return;

      const newDisabled = !script.disabled;

      try {
        await updateRegexScript(ownerId, scriptId, { disabled: newDisabled });
        if (ownerId === characterId) {
          setScripts((prev) => ({
            ...prev,
            [scriptId]: { ...prev[scriptId], disabled: newDisabled },
          }));
        } else {
          await reloadGlobal();
        }
      } catch (error) {
        console.error("Error toggling script for owner:", error);
      }
    },
    [characterId, reloadGlobal, setScripts]
  );

  // ─── 更新设置 ───
  const updateSettings = useCallback(
    async (updates: Partial<RegexScriptSettings>) => {
      try {
        const newSettings = await updateRegexScriptSettings(characterId, updates);
        setSettings(newSettings);
      } catch (error) {
        console.error("Error updating settings:", error);
      }
    },
    [characterId, setSettings]
  );

  return {
    isSaving,
    saveScript,
    saveScriptForOwner,
    deleteScript,
    deleteScriptForOwner,
    toggleScript,
    toggleScriptForOwner,
    updateSettings,
  };
}
