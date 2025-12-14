/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      useRegexScripts Hook                                 ║
 * ║                                                                           ║
 * ║  正则脚本管理 Hook - 好品味：组合优于继承，模块化设计                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useMemo } from "react";
import type { UseRegexScriptsOptions } from "./types";

// 导入子 hooks
import { useScriptData } from "./data/useScriptData";
import { useScriptCRUD } from "./data/useScriptCRUD";
import { useBulkOperations } from "./operations/useBulkOperations";
import { useAdditionalOperations } from "./operations/useAdditionalOperations";

/* ═══════════════════════════════════════════════════════════════════════════
   主 Hook 实现 - 好品味：薄层组合，职责清晰
   ═══════════════════════════════════════════════════════════════════════════ */

export function useRegexScripts({ characterId }: UseRegexScriptsOptions) {
  // ─── 数据层 ───
  const {
    scripts,
    settings,
    globalSources,
    presetSource,
    isLoading,
    loadScoped,
    loadGlobal,
    loadPreset,
    setScripts,
    setSettings,
  } = useScriptData(characterId);

  // ─── CRUD 操作 ───
  const {
    isSaving,
    saveScript,
    saveScriptForOwner,
    deleteScript,
    deleteScriptForOwner,
    toggleScript,
    toggleScriptForOwner,
    updateSettings,
  } = useScriptCRUD(characterId, scripts, setScripts, setSettings, loadScoped, loadGlobal);

  // ─── 批量操作 ───
  const {
    bulkEnable,
    bulkDisable,
    bulkDelete,
    bulkEnableForOwner,
    bulkDisableForOwner,
    bulkDeleteForOwner,
    exportSelectedToGlobal,
  } = useBulkOperations(characterId, loadScoped, loadGlobal);

  // ─── 附加操作（预设和授权） ───
  const {
    savePreset,
    loadPreset: loadPresetConfig,
    applyPreset,
    deletePreset,
    listPresets,
    allowCharacter,
    disallowCharacter,
    isCharacterAllowed,
    allowPreset: allowPresetAccess,
    disallowPreset: disallowPresetAccess,
    isPresetAllowed,
    getAllowList,
  } = useAdditionalOperations(characterId, scripts, loadScoped);

  // ─── 统计信息 ───
  const stats = useMemo(() => {
    const total = Object.keys(scripts).length;
    const enabled = Object.values(scripts).filter((s) => !s.disabled).length;
    const disabled = Object.values(scripts).filter((s) => s.disabled).length;
    return { total, enabled, disabled };
  }, [scripts]);

  // ─── 初始化加载 ───
  useEffect(() => {
    loadScoped();
    loadGlobal();
    loadPreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 返回接口 ───
  return {
    // 数据
    scopedScripts: scripts,
    settings,
    stats,
    globalSources,
    presetSource,

    // 状态
    isLoading,
    isSaving,

    // CRUD 操作
    saveScript,
    saveScriptForOwner,
    deleteScript,
    deleteScriptForOwner,
    toggleScript,
    toggleScriptForOwner,
    updateSettings,
    reload: loadScoped,
    reloadGlobals: loadGlobal,
    reloadPreset: loadPreset,

    // 批量操作
    bulkEnable,
    bulkDisable,
    bulkDelete,
    bulkEnableForOwner,
    bulkDisableForOwner,
    bulkDeleteForOwner,
    exportSelectedToGlobal,

    // 预设操作
    savePreset,
    loadPreset: loadPresetConfig,
    applyPreset,
    deletePreset,
    listPresets,

    // 授权控制
    allowCharacter,
    disallowCharacter,
    isCharacterAllowed,
    allowPreset: allowPresetAccess,
    disallowPreset: disallowPresetAccess,
    isPresetAllowed,
    getAllowList,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出工具函数（保持向后兼容）
   ═══════════════════════════════════════════════════════════════════════════ */

export { filterScripts, sortScripts, truncateText } from "./utils/helpers";
export type { SortField, SortOrder, FilterType, ScriptWithKey, SourceScripts } from "./types";
