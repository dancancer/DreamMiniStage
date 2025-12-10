/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        useRegexScripts Hook                              ║
 * ║                                                                          ║
 * ║  正则脚本管理核心逻辑：CRUD 操作、设置管理、数据加载                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { RegexScript, RegexScriptSettings } from "@/lib/models/regex-script-model";
import { getRegexScripts } from "@/function/regex/get";
import { getRegexScriptSettings } from "@/function/regex/get-setting";
import { addRegexScript } from "@/function/regex/add";
import { updateRegexScript } from "@/function/regex/update";
import { deleteRegexScript } from "@/function/regex/delete";
import { updateRegexScriptSettings } from "@/function/regex/update-setting";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

export type SortField = "priority" | "name";
export type SortOrder = "asc" | "desc";
export type FilterType = "all" | "enabled" | "disabled" | "imported";

export interface ScriptWithKey extends Partial<RegexScript> {
  scriptKey?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数 - 纯函数，无副作用
   ═══════════════════════════════════════════════════════════════════════════ */

export function filterScripts(
  scripts: Record<string, RegexScript>,
  filterBy: FilterType
): [string, RegexScript][] {
  const entries = Object.entries(scripts);
  if (filterBy === "all") return entries;

  const filterMap: Record<FilterType, (s: RegexScript) => boolean> = {
    all: () => true,
    enabled: s => !s.disabled,
    disabled: s => !!s.disabled,
    imported: s => s.extensions?.imported === true,
  };

  return entries.filter(([, script]) => filterMap[filterBy](script));
}

export function sortScripts(
  entries: [string, RegexScript][],
  sortBy: SortField,
  sortOrder: SortOrder
): [string, RegexScript][] {
  const sorted = [...entries].sort(([, a], [, b]) => {
    const comparison = sortBy === "name"
      ? (a.scriptName || "").localeCompare(b.scriptName || "")
      : (a.placement?.[0] || 999) - (b.placement?.[0] || 999);
    return sortOrder === "desc" ? -comparison : comparison;
  });
  return sorted;
}

export function truncateText(text: string, maxLength = 50): string {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主 Hook
   ═══════════════════════════════════════════════════════════════════════════ */

interface UseRegexScriptsOptions {
  characterId: string;
}

const DEFAULT_SETTINGS: RegexScriptSettings = {
  enabled: true,
  applyToPrompt: false,
  applyToResponse: true,
};

export function useRegexScripts({ characterId }: UseRegexScriptsOptions) {
  // 数据状态
  const [scripts, setScripts] = useState<Record<string, RegexScript>>({});
  const [settings, setSettings] = useState<RegexScriptSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [scriptsData, settingsData] = await Promise.all([
        getRegexScripts(characterId),
        getRegexScriptSettings(characterId),
      ]);
      setScripts(scriptsData || {});
      setSettings(settingsData);
    } catch (error) {
      console.error("Error loading regex scripts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  // 保存脚本
  const saveScript = useCallback(async (script: ScriptWithKey) => {
    setIsSaving(true);
    try {
      const { scriptKey } = script;
      if (scriptKey) {
        await updateRegexScript(characterId, scriptKey, script);
        setScripts(prev => ({
          ...prev,
          [scriptKey]: { ...prev[scriptKey], ...script },
        }));
      } else {
        const newKey = await addRegexScript(characterId, script as RegexScript);
        if (newKey) {
          setScripts(prev => ({
            ...prev,
            [newKey]: { ...script as RegexScript, scriptKey: newKey },
          }));
        } else {
          await loadData();
        }
      }
    } catch (error) {
      console.error("Error saving script:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [characterId, loadData]);

  // 删除脚本
  const deleteScript = useCallback(async (scriptId: string) => {
    try {
      await deleteRegexScript(characterId, scriptId);
      setScripts(prev => {
        const next = { ...prev };
        delete next[scriptId];
        return next;
      });
      return true;
    } catch (error) {
      console.error("Error deleting script:", error);
      return false;
    }
  }, [characterId]);

  // 切换脚本启用状态
  const toggleScript = useCallback(async (scriptId: string) => {
    const script = scripts[scriptId];
    if (!script) return;

    const newDisabled = !script.disabled;

    // 乐观更新
    setScripts(prev => ({
      ...prev,
      [scriptId]: { ...prev[scriptId], disabled: newDisabled },
    }));

    try {
      await updateRegexScript(characterId, scriptId, { disabled: newDisabled });
    } catch (error) {
      // 回滚
      setScripts(prev => ({
        ...prev,
        [scriptId]: { ...prev[scriptId], disabled: !newDisabled },
      }));
      console.error("Error toggling script:", error);
    }
  }, [characterId, scripts]);

  // 更新设置
  const updateSettings = useCallback(async (updates: Partial<RegexScriptSettings>) => {
    try {
      const newSettings = await updateRegexScriptSettings(characterId, updates);
      setSettings(newSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  }, [characterId]);

  // 初始化加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 统计信息
  const stats = {
    total: Object.keys(scripts).length,
    enabled: Object.values(scripts).filter(s => !s.disabled).length,
    disabled: Object.values(scripts).filter(s => s.disabled).length,
  };

  return {
    // 数据
    scripts,
    settings,
    stats,

    // 状态
    isLoading,
    isSaving,

    // 操作
    saveScript,
    deleteScript,
    toggleScript,
    updateSettings,
    reload: loadData,
  };
}
