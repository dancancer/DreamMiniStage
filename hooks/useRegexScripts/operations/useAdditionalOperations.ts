/**
 * @input  lib/data/roleplay/regex-preset-operation, lib/data/roleplay/regex-allow-list-operation
 * @output useAdditionalOperations
 * @pos    正则脚本附加操作 Hook - 预设管理与授权控制
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Additional Operations Hook                             ║
 * ║                                                                           ║
 * ║  附加操作 - 预设管理和授权控制                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback } from "react";
import { RegexPresetOperations } from "@/lib/data/roleplay/regex-preset-operation";
import { AllowListOperations } from "@/lib/data/roleplay/regex-allow-list-operation";
import type { RegexScript } from "@/lib/models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 实现
   ═══════════════════════════════════════════════════════════════════════════ */

export function useAdditionalOperations(
  characterId: string,
  scripts: Record<string, RegexScript>,
  reloadScoped: () => Promise<void>
) {
  /* ─────────────────────────────────────────────────────────────────────────
     预设操作
     ───────────────────────────────────────────────────────────────────────── */

  const savePreset = useCallback(
    async (name: string, description?: string) => {
      try {
        const scriptStates: Record<string, boolean> = {};
        Object.entries(scripts).forEach(([key, script]) => {
          scriptStates[key] = !script.disabled;
        });

        await RegexPresetOperations.savePreset(name, {
          description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          scriptStates,
        });
        return true;
      } catch (error) {
        console.error("Error saving preset:", error);
        return false;
      }
    },
    [scripts]
  );

  const loadPreset = useCallback(async (name: string) => {
    try {
      const preset = await RegexPresetOperations.loadPreset(name);
      return preset || null;
    } catch (error) {
      console.error("Error loading preset:", error);
      return null;
    }
  }, []);

  const applyPreset = useCallback(
    async (name: string) => {
      try {
        await RegexPresetOperations.applyPreset(name, characterId);
        await reloadScoped();
        return true;
      } catch (error) {
        console.error("Error applying preset:", error);
        return false;
      }
    },
    [characterId, reloadScoped]
  );

  const deletePreset = useCallback(async (name: string) => {
    try {
      await RegexPresetOperations.deletePreset(name);
      return true;
    } catch (error) {
      console.error("Error deleting preset:", error);
      return false;
    }
  }, []);

  const listPresets = useCallback(async () => {
    try {
      const presets = await RegexPresetOperations.listPresets();
      return presets;
    } catch (error) {
      console.error("Error listing presets:", error);
      return [];
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     授权控制
     ───────────────────────────────────────────────────────────────────────── */

  const allowCharacter = useCallback(async (charId: string) => {
    try {
      await AllowListOperations.allowCharacter(charId);
      return true;
    } catch (error) {
      console.error("Error allowing character:", error);
      return false;
    }
  }, []);

  const disallowCharacter = useCallback(async (charId: string) => {
    try {
      await AllowListOperations.disallowCharacter(charId);
      return true;
    } catch (error) {
      console.error("Error disallowing character:", error);
      return false;
    }
  }, []);

  const isCharacterAllowed = useCallback(async (charId: string) => {
    try {
      return await AllowListOperations.isCharacterAllowed(charId);
    } catch (error) {
      console.error("Error checking character allowance:", error);
      return false;
    }
  }, []);

  const allowPreset = useCallback(async (apiId: string, presetName: string) => {
    try {
      await AllowListOperations.allowPreset(apiId, presetName);
      return true;
    } catch (error) {
      console.error("Error allowing preset:", error);
      return false;
    }
  }, []);

  const disallowPreset = useCallback(async (apiId: string, presetName: string) => {
    try {
      await AllowListOperations.disallowPreset(apiId, presetName);
      return true;
    } catch (error) {
      console.error("Error disallowing preset:", error);
      return false;
    }
  }, []);

  const isPresetAllowed = useCallback(async (apiId: string, presetName: string) => {
    try {
      return await AllowListOperations.isPresetAllowed(apiId, presetName);
    } catch (error) {
      console.error("Error checking preset allowance:", error);
      return false;
    }
  }, []);

  const getAllowList = useCallback(async () => {
    try {
      return await AllowListOperations.getAllowList();
    } catch (error) {
      console.error("Error getting allow list:", error);
      return { characters: [], presets: {} };
    }
  }, []);

  return {
    // 预设操作
    savePreset,
    loadPreset,
    applyPreset,
    deletePreset,
    listPresets,
    // 授权控制
    allowCharacter,
    disallowCharacter,
    isCharacterAllowed,
    allowPreset,
    disallowPreset,
    isPresetAllowed,
    getAllowList,
  };
}
