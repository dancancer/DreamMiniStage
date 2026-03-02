/**
 * @input  lib/models/regex-script-model, function/regex/global
 * @output SortField, SortOrder, FilterType, ScriptWithKey, SourceScripts, UseRegexScriptsOptions, ExportOptions, ExportResult, DEFAULT_SETTINGS
 * @pos    正则脚本类型定义 - useRegexScripts Hook 类型
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  useRegexScripts Types                                    ║
 * ║                                                                           ║
 * ║  类型定义 - 好品味：类型独立，便于复用                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { RegexScript, RegexScriptSettings, ScriptSource } from "@/lib/models/regex-script-model";
import type { GlobalRegexScript } from "@/function/regex/global";

/* ═══════════════════════════════════════════════════════════════════════════
   排序和筛选类型
   ═══════════════════════════════════════════════════════════════════════════ */

export type SortField = "priority" | "name";
export type SortOrder = "asc" | "desc";
export type FilterType = "all" | "enabled" | "disabled" | "imported";

/* ═══════════════════════════════════════════════════════════════════════════
   脚本相关类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ScriptWithKey extends Partial<RegexScript> {
  scriptKey?: string;
}

export interface SourceScripts {
  ownerId: string;
  name?: string;
  scripts: Record<string, RegexScript>;
  metadata?: GlobalRegexScript;
  source: ScriptSource;
  readOnly?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook 参数和返回值
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UseRegexScriptsOptions {
  characterId: string;
}

export interface ExportOptions {
  name?: string;
  description?: string;
  sourceCharacterName?: string;
}

export interface ExportResult {
  success: boolean;
  message?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   默认设置
   ═══════════════════════════════════════════════════════════════════════════ */

export const DEFAULT_SETTINGS: RegexScriptSettings = {
  enabled: true,
  applyToPrompt: false,
  applyToResponse: true,
};
