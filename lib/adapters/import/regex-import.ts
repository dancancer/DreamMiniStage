/* ═══════════════════════════════════════════════════════════════════════════
   正则脚本导入适配器

   支持 5 种输入格式：
   - 数组格式: RegexScript[]
   - scripts 包装格式: { scripts: RegexScript[] }
   - regexScripts 包装格式: { regexScripts: RegexScript[] }
   - 单对象格式: RegexScript
   - 对象映射格式: Record<string, RegexScript>

   设计理念：
   - 边界转换：在导入时一次性规范化所有格式
   - 消除特殊情况：核心逻辑只处理规范化后的数组格式
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ImportAdapter } from "./types";
import { createImportPipeline, isNonNullObject, hasArrayProperty } from "./types";
import {
  normalizeRegexScript,
  type RegexScript,
} from "@/lib/models/regex-script-model";

/* ─────────────────────────────────────────────────────────────────────────────
   类型定义
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 原始脚本输入（可能是旧格式）
 */
type RawRegexScript = Record<string, unknown> & { findRegex: string };

/**
 * scripts 包装格式
 */
interface ScriptsWrapper {
  scripts: RawRegexScript[];
}

/**
 * regexScripts 包装格式
 */
interface RegexScriptsWrapper {
  regexScripts: RawRegexScript[];
}

/**
 * 对象映射格式
 */
type ScriptsMap = Record<string, RawRegexScript>;

/* ─────────────────────────────────────────────────────────────────────────────
   类型守卫函数
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 检查是否为有效的原始脚本对象
 */
function isRawRegexScript(value: unknown): value is RawRegexScript {
  return (
    isNonNullObject(value) &&
    "findRegex" in value &&
    typeof (value as Record<string, unknown>).findRegex === "string"
  );
}

/**
 * 检查是否为原始脚本数组
 */
function isRawRegexScriptArray(value: unknown): value is RawRegexScript[] {
  return Array.isArray(value) && value.length > 0 && value.some(isRawRegexScript);
}

/**
 * 检查是否为脚本对象映射
 */
function isScriptsMap(value: unknown): value is ScriptsMap {
  if (!isNonNullObject(value)) return false;
  if (Array.isArray(value)) return false;
  // 排除已知的包装格式
  if ("scripts" in value || "regexScripts" in value) return false;
  // 排除单个脚本对象（有 findRegex 直接在顶层）
  if ("findRegex" in value) return false;
  // 检查是否有值是脚本对象
  const values = Object.values(value);
  return values.length > 0 && values.some(isRawRegexScript);
}

/* ─────────────────────────────────────────────────────────────────────────────
   适配器实现
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 数组格式适配器
 *
 * 格式示例:
 * [
 *   { findRegex: "\\d+", replaceString: "NUM" },
 *   { findRegex: "[a-z]+", replaceString: "WORD" }
 * ]
 */
export const arrayAdapter: ImportAdapter<RawRegexScript[], RegexScript[]> = {
  name: "array",
  canHandle: isRawRegexScriptArray,
  normalize: (input) => input.filter(isRawRegexScript).map(normalizeRegexScript),
};

/**
 * scripts 包装格式适配器
 *
 * 格式示例:
 * {
 *   scripts: [
 *     { findRegex: "\\d+", replaceString: "NUM" }
 *   ]
 * }
 */
export const scriptsWrapperAdapter: ImportAdapter<ScriptsWrapper, RegexScript[]> = {
  name: "scripts-wrapper",
  canHandle: (input): input is ScriptsWrapper =>
    hasArrayProperty(input, "scripts") &&
    (input as ScriptsWrapper).scripts.some(isRawRegexScript),
  normalize: (input) =>
    input.scripts.filter(isRawRegexScript).map(normalizeRegexScript),
};

/**
 * regexScripts 包装格式适配器
 *
 * 格式示例:
 * {
 *   regexScripts: [
 *     { findRegex: "\\d+", replaceString: "NUM" }
 *   ]
 * }
 */
export const regexScriptsWrapperAdapter: ImportAdapter<
  RegexScriptsWrapper,
  RegexScript[]
> = {
  name: "regexScripts-wrapper",
  canHandle: (input): input is RegexScriptsWrapper =>
    hasArrayProperty(input, "regexScripts") &&
    (input as RegexScriptsWrapper).regexScripts.some(isRawRegexScript),
  normalize: (input) =>
    input.regexScripts.filter(isRawRegexScript).map(normalizeRegexScript),
};

/**
 * 单对象格式适配器
 *
 * 格式示例:
 * { findRegex: "\\d+", replaceString: "NUM" }
 */
export const singleScriptAdapter: ImportAdapter<RawRegexScript, RegexScript[]> = {
  name: "single-script",
  canHandle: (input): input is RawRegexScript =>
    isRawRegexScript(input) && !("scripts" in input) && !("regexScripts" in input),
  normalize: (input) => [normalizeRegexScript(input)],
};

/**
 * 对象映射格式适配器
 *
 * 格式示例:
 * {
 *   "script_1": { findRegex: "\\d+", replaceString: "NUM" },
 *   "script_2": { findRegex: "[a-z]+", replaceString: "WORD" }
 * }
 */
export const scriptsMapAdapter: ImportAdapter<ScriptsMap, RegexScript[]> = {
  name: "scripts-map",
  canHandle: isScriptsMap,
  normalize: (input) =>
    Object.values(input)
      .filter(isRawRegexScript)
      .map(normalizeRegexScript),
};

/* ─────────────────────────────────────────────────────────────────────────────
   导出的管道
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * 正则脚本导入管道
 *
 * 按优先级排序的适配器：
 * 1. 数组格式（最常见）
 * 2. scripts 包装格式
 * 3. regexScripts 包装格式
 * 4. 单对象格式
 * 5. 对象映射格式
 *
 * @example
 * import { regexImportPipeline } from "@/lib/adapters/import/regex-import";
 * const scripts = regexImportPipeline.process(jsonData);
 */
export const regexImportPipeline = createImportPipeline<RegexScript[]>(
  [arrayAdapter, scriptsWrapperAdapter, regexScriptsWrapperAdapter, singleScriptAdapter, scriptsMapAdapter],
  "regex-scripts",
);

/**
 * 从任意格式的 JSON 数据导入正则脚本
 *
 * 便捷函数，使用默认管道
 *
 * @param jsonData - JSON 数据
 * @returns 规范化的 RegexScript[]
 * @throws NoAdapterMatchError 如果格式不被支持
 */
export function importRegexScripts(jsonData: unknown): RegexScript[] {
  return regexImportPipeline.process(jsonData);
}

/**
 * 检查 JSON 数据是否可以被导入
 *
 * @param jsonData - JSON 数据
 * @returns 是否可以导入
 */
export function canImportRegexScripts(jsonData: unknown): boolean {
  try {
    const adapters = [
      arrayAdapter,
      scriptsWrapperAdapter,
      regexScriptsWrapperAdapter,
      singleScriptAdapter,
      scriptsMapAdapter,
    ];
    return adapters.some((adapter) => adapter.canHandle(jsonData));
  } catch {
    return false;
  }
}
