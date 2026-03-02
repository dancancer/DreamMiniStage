/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 变量初始化系统                                  ║
 * ║                                                                            ║
 * ║  从世界书 [InitVar] 条目和开场白 <initvar> 块加载初始变量                      ║
 * ║  设计原则：显式声明，增量合并，Schema 自推断                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, StatData, ObjectSchemaNode, SchemaNode } from "./types";
import { generateSchema, cleanupMeta } from "./core/schema";
import { isObjectSchema } from "./types";

// ============================================================================
//                              类型定义
// ============================================================================

/** 世界书条目 */
export interface WorldBookEntry {
  uid: string | number;
  comment?: string;
  content: string;
  keys?: string[];
  enabled?: boolean;
}

/** 初始化结果 */
export interface InitResult {
  success: boolean;
  updated: boolean;
  variables: MvuData;
  errors: string[];
  loadedSources: string[];
}

/** 初始化配置 */
export interface InitConfig {
  /** 是否忽略已初始化的世界书 */
  skipInitialized?: boolean;
  /** 是否强制重新初始化 */
  forceReinit?: boolean;
  /** 自定义世界书列表（不使用时从上下文获取） */
  worldBooks?: WorldBookEntry[][];
  /** 世界书名称列表（与 worldBooks 对应） */
  worldBookNames?: string[];
}

// ============================================================================
//                              内部工具
// ============================================================================

/** 深度合并对象 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      (result as Record<string, unknown>)[key] = sourceVal;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 解析多格式字符串（JSON 优先，支持简单 YAML 对象） */
function parseMultiFormat(content: string): unknown {
  const trimmed = content.trim();

  // 尝试 JSON
  try {
    return JSON.parse(trimmed);
  } catch {
    // 继续
  }

  // 尝试 JavaScript 对象字面量（处理简单的非标准 JSON）
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      // 使用 Function 构造器安全评估
      const result = new Function(`return ${trimmed};`)();
      if (typeof result === "object" && result !== null) return result;
    } catch {
      // 继续
    }
  }

  // 简单的 YAML 键值对解析（仅支持顶层简单值）
  if (!trimmed.startsWith("{") && trimmed.includes(":")) {
    try {
      const result: Record<string, unknown> = {};
      const lines = trimmed.split("\n");
      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value: unknown = line.slice(colonIndex + 1).trim();
          // 尝试解析值
          if (value === "true") value = true;
          else if (value === "false") value = false;
          else if (value === "null") value = null;
          else if (!isNaN(Number(value)) && value !== "") value = Number(value);
          else if (typeof value === "string" && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.slice(1, -1);
          }
          if (key) result[key] = value;
        }
      }
      if (Object.keys(result).length > 0) return result;
    } catch {
      // 继续
    }
  }

  throw new Error("无法解析内容：不是有效的 JSON 格式");
}

/** 提取代码块内容 */
function extractCodeBlock(content: string): string {
  const match = content.trim().match(/```(?:yaml|json|json5)?\s*\n?([\s\S]*?)\n?```/im);
  return match ? match[1].trim() : content.trim();
}

// ============================================================================
//                              InitVar 提取
// ============================================================================

/** 检查是否为 [InitVar] 条目 */
export function isInitVarEntry(entry: WorldBookEntry): boolean {
  const comment = entry.comment?.toLowerCase() ?? "";
  return comment.includes("[initvar]");
}

/** 从世界书条目提取初始变量，同时收集错误 */
export function extractInitVarFromEntry(
  entry: WorldBookEntry,
): { data: StatData | null; error?: string } {
  if (!isInitVarEntry(entry)) return { data: null };

  try {
    const content = extractCodeBlock(entry.content);
    const parsed = parseMultiFormat(content);

    if (!isPlainObject(parsed)) {
      const error = `InitVar 条目 '${entry.comment}' 解析结果不是对象`;
      console.warn(`[MVU] ${error}`);
      return { data: null, error };
    }

    return { data: parsed as StatData };
  } catch (error) {
    const errorMsg = `解析 InitVar 条目 '${entry.comment}' 失败: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[MVU] ${errorMsg}`);
    return { data: null, error: errorMsg };
  }
}

/** 从世界书列表提取所有初始变量，收集错误 */
export function extractInitVarFromWorldBook(
  entries: WorldBookEntry[],
): { data: StatData; errors: string[] } {
  let result: StatData = {};
  const errors: string[] = [];

  for (const entry of entries) {
    if (!entry.enabled && entry.enabled !== undefined) continue;

    const { data: initVar, error } = extractInitVarFromEntry(entry);
    if (error) {
      errors.push(error);
    }
    if (initVar) {
      result = deepMerge(result, initVar);
    }
  }

  return { data: result, errors };
}

// ============================================================================
//                              开场白 <initvar> 提取
// ============================================================================

/** 从开场白提取 <initvar> 块 */
export function extractInitVarFromGreeting(greeting: string): StatData | null {
  const matches = greeting.matchAll(/<initvar>(?:```.*?\n?)?([\s\S]*?)(?:```)?<\/initvar>/gim);
  let result: StatData = {};
  let found = false;

  for (const match of matches) {
    try {
      const content = extractCodeBlock(match[1]);
      const parsed = parseMultiFormat(content);

      if (isPlainObject(parsed)) {
        result = deepMerge(result, parsed as StatData);
        found = true;
      }
    } catch (error) {
      console.warn("[MVU] 解析 <initvar> 块失败:", error);
    }
  }

  return found ? result : null;
}

/** 检查开场白是否包含 <initvar> 块 */
export function hasInitVarBlock(greeting: string): boolean {
  return /<initvar>/i.test(greeting);
}

// ============================================================================
//                              初始化流程
// ============================================================================

/** 创建空的 MvuData */
export function createEmptyMvuData(): MvuData {
  return {
    stat_data: {},
    display_data: {},
    delta_data: {},
    initialized_lorebooks: {},
    schema: {
      type: "object",
      properties: {},
      extensible: false,
    },
  };
}

/**
 * 从世界书加载初始变量
 * 这是 MagVarUpdate 的 loadInitVarData 函数的移植
 */
export function loadInitVarFromWorldBooks(
  mvuData: MvuData,
  worldBooks: WorldBookEntry[][],
  worldBookNames: string[],
  config: InitConfig = {},
): { updated: boolean; errors: string[]; loadedSources: string[] } {
  const { skipInitialized = true } = config;
  const errors: string[] = [];
  const loadedSources: string[] = [];
  let updated = false;

  // 确保 initialized_lorebooks 存在
  if (!mvuData.initialized_lorebooks) {
    mvuData.initialized_lorebooks = {};
  }

  for (let i = 0; i < worldBooks.length; i++) {
    const entries = worldBooks[i];
    const name = worldBookNames[i] || `worldbook_${i}`;

    // 跳过已初始化的世界书
    if (skipInitialized && name in mvuData.initialized_lorebooks) {
      continue;
    }

    // 提取初始变量（收集解析错误）
    const { data: initVar, errors: extractErrors } = extractInitVarFromWorldBook(entries);
    errors.push(...extractErrors);

    if (Object.keys(initVar).length > 0) {
      // 增量合并到 stat_data
      mvuData.stat_data = deepMerge(mvuData.stat_data, initVar);
      mvuData.initialized_lorebooks[name] = [];
      loadedSources.push(name);
      updated = true;
    } else {
      // 即使没有 InitVar，也标记为已处理
      mvuData.initialized_lorebooks[name] = [];
    }
  }

  return { updated, errors, loadedSources };
}

/**
 * 应用开场白级别的变量覆盖
 * 当开场白包含 <initvar> 块时，该块内容会覆盖世界书的初始变量
 */
export function applyGreetingOverride(
  mvuData: MvuData,
  greeting: string,
  preserveWorldBooks?: string[],
): boolean {
  const greetingInitVar = extractInitVarFromGreeting(greeting);

  if (!greetingInitVar) return false;

  // 开场白 <initvar> 覆盖所有世界书变量
  mvuData.stat_data = greetingInitVar;

  // 重置 initialized_lorebooks，但保留指定的世界书标记
  const newInitializedBooks: Record<string, unknown[]> = {};
  if (preserveWorldBooks) {
    for (const name of preserveWorldBooks) {
      if (mvuData.initialized_lorebooks?.[name]) {
        newInitializedBooks[name] = [];
      }
    }
  }
  mvuData.initialized_lorebooks = newInitializedBooks;

  return true;
}

// ============================================================================
//                              简化 API（SillyTavern 兼容）
// ============================================================================

/** 简化的初始化配置（SillyTavern 风格） */
export interface SimpleInitConfig {
  worldBooks: WorldBookEntry[][];
  worldBookNames: string[];
  greeting?: string;
  existingData?: MvuData | null;
  skipInitialized?: boolean;
  forceReinit?: boolean;
}

/**
 * 完整的变量初始化流程
 *
 * 支持两种调用方式：
 * 1. 简化 API（SillyTavern 兼容）：initializeVariables({ worldBooks, worldBookNames })
 * 2. 完整 API：initializeVariables(existingData, worldBooks, worldBookNames, greeting, config)
 */
export function initializeVariables(config: SimpleInitConfig): InitResult;
export function initializeVariables(
  existingData: MvuData | null,
  worldBooks: WorldBookEntry[][],
  worldBookNames: string[],
  greeting?: string,
  config?: InitConfig,
): InitResult;
export function initializeVariables(
  existingDataOrConfig: MvuData | null | SimpleInitConfig,
  worldBooks?: WorldBookEntry[][],
  worldBookNames?: string[],
  greeting?: string,
  config: InitConfig = {},
): InitResult {
  // ═══════════════════════════════════════════════════════════════════════════
  // 参数规范化：支持简化 API
  // ═══════════════════════════════════════════════════════════════════════════
  let existingData: MvuData | null;
  let actualWorldBooks: WorldBookEntry[][];
  let actualWorldBookNames: string[];
  let actualGreeting: string | undefined;
  let actualConfig: InitConfig;

  if (
    existingDataOrConfig !== null &&
    typeof existingDataOrConfig === "object" &&
    "worldBooks" in existingDataOrConfig &&
    "worldBookNames" in existingDataOrConfig
  ) {
    // 简化 API：initializeVariables({ worldBooks, worldBookNames, ... })
    const simpleConfig = existingDataOrConfig as SimpleInitConfig;
    existingData = simpleConfig.existingData ?? null;
    actualWorldBooks = simpleConfig.worldBooks;
    actualWorldBookNames = simpleConfig.worldBookNames;
    actualGreeting = simpleConfig.greeting;
    actualConfig = {
      skipInitialized: simpleConfig.skipInitialized,
      forceReinit: simpleConfig.forceReinit,
    };
  } else {
    // 完整 API：initializeVariables(existingData, worldBooks, worldBookNames, ...)
    existingData = existingDataOrConfig as MvuData | null;
    actualWorldBooks = worldBooks!;
    actualWorldBookNames = worldBookNames!;
    actualGreeting = greeting;
    actualConfig = config;
  }

  const errors: string[] = [];
  const loadedSources: string[] = [];

  // 创建或复制现有数据
  const mvuData: MvuData = existingData
    ? JSON.parse(JSON.stringify(existingData))
    : createEmptyMvuData();

  // 强制重新初始化时清空
  if (actualConfig.forceReinit) {
    mvuData.stat_data = {};
    mvuData.initialized_lorebooks = {};
  }

  // 检查开场白是否有 <initvar> 覆盖
  const hasGreetingOverride = actualGreeting && hasInitVarBlock(actualGreeting);

  // 加载世界书变量（如果没有开场白覆盖）
  if (!hasGreetingOverride) {
    const result = loadInitVarFromWorldBooks(mvuData, actualWorldBooks, actualWorldBookNames, actualConfig);
    errors.push(...result.errors);
    loadedSources.push(...result.loadedSources);
  }

  // 应用开场白覆盖
  if (hasGreetingOverride && actualGreeting) {
    const primaryWorldBook = actualWorldBookNames[0];
    applyGreetingOverride(mvuData, actualGreeting, primaryWorldBook ? [primaryWorldBook] : undefined);
    loadedSources.push("greeting:<initvar>");

    // 覆盖后需要重新加载其他世界书（非主角色卡世界书）
    if (actualWorldBooks.length > 1) {
      const otherBooks = actualWorldBooks.slice(1);
      const otherNames = actualWorldBookNames.slice(1);
      const result = loadInitVarFromWorldBooks(mvuData, otherBooks, otherNames, {
        ...actualConfig,
        skipInitialized: false,
      });
      errors.push(...result.errors);
      loadedSources.push(...result.loadedSources);
    }
  }

  // 生成 Schema
  const dataClone = JSON.parse(JSON.stringify(mvuData.stat_data));
  const generatedSchema = generateSchema(dataClone, mvuData.schema);

  if (isObjectSchema(generatedSchema)) {
    // 提取根级 $meta 配置
    const meta = mvuData.stat_data.$meta;
    if (meta) {
      if ("strictTemplate" in meta) {
        (generatedSchema as ObjectSchemaNode & { strictTemplate?: boolean }).strictTemplate =
          Boolean(meta.strictTemplate);
      }
      if ("concatTemplateArray" in meta) {
        (generatedSchema as ObjectSchemaNode & { concatTemplateArray?: boolean }).concatTemplateArray =
          Boolean(meta.concatTemplateArray);
      }
      if ("strictSet" in meta) {
        (generatedSchema as ObjectSchemaNode & { strictSet?: boolean }).strictSet =
          Boolean(meta.strictSet);
      }
    }
    mvuData.schema = generatedSchema as ObjectSchemaNode;
  }

  // 清理 $meta 元数据
  cleanupMeta(mvuData.stat_data);

  return {
    success: true,  // 即使有解析错误也返回 true（错误已被收集到 errors 数组）
    updated: loadedSources.length > 0,
    variables: mvuData,
    errors,
    loadedSources,
  };
}

// ============================================================================
//                              描述更新
// ============================================================================

/**
 * 从初始变量同步描述到当前变量
 * 保留数值变化，仅更新描述文本
 */
export function updateDescriptions(
  currentData: StatData,
  initData: StatData,
  path: string[] = [],
): void {
  for (const key of Object.keys(initData)) {
    if (key === "$meta") continue;

    const initValue = initData[key];
    const currentValue = currentData[key];
    const currentPath = [...path, key];

    if (currentValue === undefined) continue;

    // ValueWithDescription 数组格式 [value, description]
    if (
      Array.isArray(initValue) &&
      initValue.length === 2 &&
      typeof initValue[1] === "string" &&
      Array.isArray(currentValue) &&
      currentValue.length === 2
    ) {
      // 更新描述，保留当前值
      currentValue[1] = initValue[1];
      continue;
    }

    // 对象含 description 字段
    if (
      isPlainObject(initValue) &&
      "description" in initValue &&
      isPlainObject(currentValue) &&
      "description" in currentValue
    ) {
      (currentValue as { description: string }).description =
        (initValue as { description: string }).description;
    }

    // 递归处理嵌套对象
    if (isPlainObject(initValue) && isPlainObject(currentValue)) {
      updateDescriptions(currentValue as StatData, initValue as StatData, currentPath);
    }

    // 递归处理数组（非 VWD）
    if (
      Array.isArray(initValue) &&
      Array.isArray(currentValue) &&
      !(initValue.length === 2 && typeof initValue[1] === "string")
    ) {
      for (let i = 0; i < Math.min(initValue.length, currentValue.length); i++) {
        if (isPlainObject(initValue[i]) && isPlainObject(currentValue[i])) {
          updateDescriptions(
            currentValue[i] as StatData,
            initValue[i] as StatData,
            [...currentPath, String(i)],
          );
        }
      }
    }
  }
}

// ============================================================================
//                              辅助函数
// ============================================================================

/** 检查变量是否已初始化 */
export function isVariablesInitialized(mvuData: MvuData | null | undefined): boolean {
  if (!mvuData) return false;
  return (
    Object.keys(mvuData.stat_data || {}).length > 0 ||
    Object.keys(mvuData.initialized_lorebooks || {}).length > 0
  );
}

/** 获取已初始化的世界书列表 */
export function getInitializedWorldBooks(mvuData: MvuData): string[] {
  return Object.keys(mvuData.initialized_lorebooks || {});
}

/** 检查指定世界书是否已初始化 */
export function isWorldBookInitialized(mvuData: MvuData, worldBookName: string): boolean {
  return worldBookName in (mvuData.initialized_lorebooks || {});
}
