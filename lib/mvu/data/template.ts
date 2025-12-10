/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU Template 系统                                  ║
 * ║                                                                            ║
 * ║  新增元素时自动应用模板                                                      ║
 * ║  设计原则：模板即默认值，让数据结构自完备                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { StatData } from "../types";

// ============================================================================
//                              类型定义
// ============================================================================

export type TemplateType = StatData | StatData[] | unknown[];

export interface ApplyTemplateOptions {
  /** 严格模式：不允许 primitive -> [primitive] 的隐式转换 */
  strictArrayCast?: boolean;
  /** 数组合并行为：true=拼接，false=覆盖 */
  concatArray?: boolean;
}

// ============================================================================
//                              模板应用
// ============================================================================

/**
 * 将模板应用到值上
 * 值的属性优先级高于模板
 */
export function applyTemplate(
  value: unknown,
  template: TemplateType | undefined,
  options: ApplyTemplateOptions = {},
): unknown {
  const { strictArrayCast = false, concatArray = true } = options;

  // 无模板直接返回
  if (!template) return value;

  const valueIsObject = isPlainObject(value);
  const valueIsArray = Array.isArray(value);
  const templateIsArray = Array.isArray(template);

  // 对象 + 对象模板：深度合并
  if (valueIsObject && !templateIsArray) {
    return deepMerge(template as StatData, value as StatData);
  }

  // 数组 + 数组模板：合并或拼接
  if (valueIsArray && templateIsArray) {
    return concatArray
      ? [...value, ...template]
      : mergeArrays(template, value);
  }

  // 类型不匹配：值是复杂类型但模板类型不同
  if ((valueIsObject || valueIsArray) && templateIsArray !== valueIsArray) {
    console.warn(
      `模板类型不匹配: 模板是 ${templateIsArray ? "数组" : "对象"}, ` +
      `但值是 ${valueIsArray ? "数组" : "对象"}`,
    );
    return value;
  }

  // 原始类型 + 数组模板：转换为数组
  if (!valueIsObject && !valueIsArray && templateIsArray) {
    if (strictArrayCast) return value;
    return concatArray
      ? [value, ...template]
      : [value];
  }

  // 其他情况：不应用模板
  return value;
}

// ============================================================================
//                              深度合并
// ============================================================================

/** 深度合并两个对象，source 优先 */
function deepMerge(target: StatData, source: StatData): StatData {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(targetVal as StatData, sourceVal as StatData);
    } else if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
      result[key] = [...sourceVal];
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

/** 合并两个数组 */
function mergeArrays(target: unknown[], source: unknown[]): unknown[] {
  const result = [...target];
  for (let i = 0; i < source.length; i++) {
    result[i] = source[i];
  }
  return result;
}

// ============================================================================
//                              工具函数
// ============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
