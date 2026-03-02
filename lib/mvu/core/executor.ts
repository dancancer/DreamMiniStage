/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 命令执行器                                     ║
 * ║                                                                            ║
 * ║  执行变量更新命令，维护状态一致性                                             ║
 * ║  设计原则：纯函数执行，副作用隔离                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, MvuCommand, CommandResult, StatData } from "../types";
import { isValueWithDescription, getVWDValue, setVWDValue } from "../types";
import { extractCommands, parseCommandValue, fixPath, trimQuotes } from "./parser";
import { getSchemaForPath, validateInsert, validateDelete, reconcileSchema } from "./schema";
import { applyTemplate, type ApplyTemplateOptions } from "../data/template";

// ============================================================================
//                              SillyTavern 兼容类型
// ============================================================================

/** SillyTavern 风格的命令对象 */
export interface STStyleCommand {
  name: "set" | "insert" | "delete";
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// ============================================================================
//                              工具函数
// ============================================================================

function deepClone<T>(obj: T): T {
  // 处理 undefined（JSON.stringify 会忽略 undefined）
  if (obj === undefined) return undefined as T;
  return JSON.parse(JSON.stringify(obj));
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function setByPath(obj: unknown, path: string, value: unknown): void {
  if (!path) return;
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] == null) {
      current[seg] = /^\d+$/.test(segments[i + 1]) ? [] : {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function unsetByPath(obj: unknown, path: string): void {
  if (!path) return;
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    if (current == null) return;
    current = current[segments[i]] as Record<string, unknown>;
  }
  if (current) {
    const lastSeg = segments[segments.length - 1];
    // ═══════════════════════════════════════════════════════════════════════════
    // 数组元素删除：使用 splice 而不是 delete
    // ═══════════════════════════════════════════════════════════════════════════
    if (Array.isArray(current) && /^\d+$/.test(lastSeg)) {
      const index = parseInt(lastSeg, 10);
      if (index >= 0 && index < current.length) {
        current.splice(index, 1);
      }
    } else {
      delete current[lastSeg];
    }
  }
}

function hasPath(obj: unknown, path: string): boolean {
  return getByPath(obj, path) !== undefined;
}

// ============================================================================
//                              命令执行器
// ============================================================================

/** 执行 set 命令 */
function executeSet(
  data: StatData,
  path: string,
  args: string[],
): CommandResult {
  if (path !== "" && !hasPath(data, path)) {
    return { success: false, path, error: `路径 '${path}' 不存在` };
  }

  const oldValue = path === "" ? deepClone(data) : getByPath(data, path);
  let newValue = parseCommandValue(args[args.length - 1]);

  // 处理 ValueWithDescription（兼容数组和对象格式）
  if (isValueWithDescription(oldValue)) {
    const oldActual = getVWDValue(oldValue);
    if (typeof oldActual === "number" && newValue !== null) {
      newValue = Number(newValue);
    }
    setVWDValue(oldValue, newValue);
    return { success: true, path, oldValue: oldActual, newValue };
  }

  // 数字类型转换
  if (typeof oldValue === "number" && typeof newValue === "string") {
    newValue = Number(newValue);
  }

  if (path) {
    setByPath(data, path, newValue);
  } else {
    Object.assign(data, newValue);
  }

  return {
    success: true,
    path,
    oldValue,
    newValue,
  };
}

/** 执行 add 命令 */
function executeAdd(
  data: StatData,
  path: string,
  args: string[],
): CommandResult {
  if (!hasPath(data, path)) {
    return { success: false, path, error: `路径 '${path}' 不存在` };
  }

  const currentValue = getByPath(data, path);
  const delta = args.length >= 2 ? parseCommandValue(args[1]) : 1;

  // ValueWithDescription（兼容数组和对象格式）
  if (isValueWithDescription(currentValue)) {
    const oldActual = getVWDValue(currentValue);
    if (typeof oldActual === "number" && typeof delta === "number") {
      const newValue = parseFloat((oldActual + delta).toPrecision(12));
      setVWDValue(currentValue, newValue);
      return { success: true, path, oldValue: oldActual, newValue };
    }
    // 日期处理
    if (typeof oldActual === "string" && typeof delta === "number") {
      const date = new Date(oldActual);
      if (!isNaN(date.getTime())) {
        const newValue = new Date(date.getTime() + delta).toISOString();
        setVWDValue(currentValue, newValue);
        return { success: true, path, oldValue: oldActual, newValue };
      }
    }
  }

  // 普通数字
  if (typeof currentValue === "number" && typeof delta === "number") {
    const newValue = parseFloat((currentValue + delta).toPrecision(12));
    setByPath(data, path, newValue);
    return { success: true, path, oldValue: currentValue, newValue };
  }

  // 日期字符串
  if (typeof currentValue === "string" && typeof delta === "number") {
    const date = new Date(currentValue);
    if (!isNaN(date.getTime())) {
      const newValue = new Date(date.getTime() + delta).toISOString();
      setByPath(data, path, newValue);
      return { success: true, path, oldValue: currentValue, newValue };
    }
  }

  return { success: false, path, error: "无法对非数字/日期类型执行 add" };
}

/** 执行 delete 命令 */
function executeDelete(
  data: StatData,
  path: string,
  args: string[],
  schema: MvuData["schema"],
): CommandResult {
  // 解析要删除的目标
  const segments = path.split(/[.[\]]+/).filter(Boolean);
  let containerPath = path;
  let keyOrIndex: string | number | undefined;

  if (args.length > 1) {
    keyOrIndex = parseCommandValue(args[1]) as string | number;
  } else {
    keyOrIndex = segments.pop();
    containerPath = segments.join(".");
  }

  // Schema 验证
  const containerSchema = getSchemaForPath(schema, containerPath);
  const validation = validateDelete(containerSchema, containerPath, keyOrIndex);
  if (!validation.valid) {
    return { success: false, path, error: validation.error };
  }

  // 单参数：删除整个路径
  if (args.length === 1) {
    if (!hasPath(data, path)) {
      return { success: false, path, error: `路径 '${path}' 不存在` };
    }
    const oldValue = getByPath(data, path);
    unsetByPath(data, path);
    return { success: true, path, oldValue, newValue: undefined };
  }

  // 双参数：从集合中删除
  const container = getByPath(data, containerPath);
  if (Array.isArray(container)) {
    const index = typeof keyOrIndex === "number"
      ? keyOrIndex
      : container.findIndex((item) => JSON.stringify(item) === JSON.stringify(keyOrIndex));
    if (index >= 0 && index < container.length) {
      const oldValue = deepClone(container);
      container.splice(index, 1);
      return { success: true, path: containerPath, oldValue, newValue: container };
    }
  } else if (typeof container === "object" && container !== null) {
    const key = String(keyOrIndex);
    if (key in container) {
      const oldValue = (container as Record<string, unknown>)[key];
      delete (container as Record<string, unknown>)[key];
      return { success: true, path: `${containerPath}.${key}`, oldValue, newValue: undefined };
    }
  }

  return { success: false, path, error: "删除目标不存在" };
}

/** 执行 insert 命令 */
function executeInsert(
  data: StatData,
  path: string,
  args: string[],
  schema: MvuData["schema"],
): CommandResult {
  const target = path === "" ? data : getByPath(data, path);
  const targetSchema = getSchemaForPath(schema, path);

  // 从根 Schema 读取模板配置
  const templateOptions: ApplyTemplateOptions = {
    strictArrayCast: (schema as SchemaWithTemplateConfig)?.strictTemplate ?? false,
    concatArray: (schema as SchemaWithTemplateConfig)?.concatTemplateArray ?? true,
  };

  // 两参数：合并对象或追加数组
  if (args.length === 2) {
    let valueToInsert = parseCommandValue(args[1]);

    // 应用模板
    if (targetSchema && "template" in targetSchema) {
      valueToInsert = applyTemplate(valueToInsert, targetSchema.template, templateOptions);
    }

    if (Array.isArray(target)) {
      // Schema 验证
      const validation = validateInsert(targetSchema, path, target.length);
      if (!validation.valid) {
        return { success: false, path, error: validation.error };
      }
      target.push(valueToInsert);
      return { success: true, path, newValue: target };
    }

    if (typeof target === "object" && target !== null) {
      if (typeof valueToInsert === "object" && !Array.isArray(valueToInsert)) {
        Object.assign(target, valueToInsert);
        return { success: true, path, newValue: target };
      }
    }

    return { success: false, path, error: "insert 目标必须是对象或数组" };
  }

  // 三参数：指定位置插入
  if (args.length >= 3) {
    const keyOrIndex = parseCommandValue(args[1]);
    let valueToInsert = parseCommandValue(args[2]);

    // Schema 验证
    const validation = validateInsert(targetSchema, path, keyOrIndex as string | number);
    if (!validation.valid) {
      return { success: false, path, error: validation.error };
    }

    // 应用模板
    if (targetSchema && "template" in targetSchema) {
      valueToInsert = applyTemplate(valueToInsert, targetSchema.template, templateOptions);
    }

    if (Array.isArray(target) && typeof keyOrIndex === "number") {
      target.splice(keyOrIndex, 0, valueToInsert);
      return { success: true, path, newValue: target };
    }

    if (typeof target === "object" && target !== null) {
      (target as Record<string, unknown>)[String(keyOrIndex)] = valueToInsert;
      return { success: true, path, newValue: target };
    }
  }

  return { success: false, path, error: "insert 参数不足" };
}

// Schema 扩展类型，包含模板配置
type SchemaWithTemplateConfig = {
  strictTemplate?: boolean;
  concatTemplateArray?: boolean;
  strictSet?: boolean;
};

// ============================================================================
//                              命令分发
// ============================================================================

function executeCommand(
  data: StatData,
  command: MvuCommand,
  schema: MvuData["schema"],
): CommandResult {
  const path = fixPath(trimQuotes(command.args[0]));

  switch (command.type) {
  case "set":
    return executeSet(data, path, command.args);
  case "add":
    return executeAdd(data, path, command.args);
  case "delete":
    return executeDelete(data, path, command.args, schema);
  case "insert":
    return executeInsert(data, path, command.args, schema);
  default:
    return { success: false, path, error: `未知命令: ${command.type}` };
  }
}

// ============================================================================
//                              主执行函数
// ============================================================================

export interface UpdateResult {
  modified: boolean;
  results: CommandResult[];
  variables: MvuData;
  /** SillyTavern 兼容：成功更新的命令数量 */
  updatedCount: number;
}

/**
 * 从消息内容更新变量
 *
 * 支持两种调用方式：
 * 1. SillyTavern 风格：updateVariablesFromMessage(variables, message)
 * 2. 原有风格：updateVariablesFromMessage(message, variables)
 *
 * 注意：此函数直接修改传入的 variables 对象（SillyTavern 行为）
 */
export function updateVariablesFromMessage(
  variablesOrMessage: MvuData | string,
  messageOrVariables: string | MvuData,
): UpdateResult {
  // ═══════════════════════════════════════════════════════════════════════════
  // 参数规范化：支持两种调用顺序
  // ═══════════════════════════════════════════════════════════════════════════
  let messageContent: string;
  let variables: MvuData;

  if (typeof variablesOrMessage === "string") {
    // 原有风格：(message, variables)
    messageContent = variablesOrMessage;
    variables = messageOrVariables as MvuData;
  } else {
    // SillyTavern 风格：(variables, message)
    variables = variablesOrMessage;
    messageContent = messageOrVariables as string;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 直接在原对象上操作（SillyTavern 行为）
  // ═══════════════════════════════════════════════════════════════════════════
  const displayData: Record<string, unknown> = variables.display_data ?? {};
  const deltaData: Record<string, unknown> = {};

  const commands = extractCommands(messageContent);
  const results: CommandResult[] = [];
  let modified = false;
  let updatedCount = 0;

  for (const command of commands) {
    const result = executeCommand(variables.stat_data, command, variables.schema);
    results.push(result);

    if (result.success) {
      modified = true;
      updatedCount++;
      const path = result.path;
      const reasonStr = command.reason ? `(${command.reason})` : "";
      const displayStr = `${JSON.stringify(result.oldValue)}->${JSON.stringify(result.newValue)} ${reasonStr}`;

      if (path) {
        setByPath(displayData, path, displayStr);
        setByPath(deltaData, path, displayStr);
      }
    }
  }

  variables.display_data = displayData;
  variables.delta_data = deltaData;

  // 调和 Schema
  if (modified) {
    reconcileSchema(variables);
  }

  return { modified, results, variables, updatedCount };
}

/**
 * 直接更新单个变量
 *
 * 支持两种调用方式：
 * 1. SillyTavern 风格：updateSingleVariable(variables, command)
 *    其中 command 为 { name, path, oldValue?, newValue }
 * 2. 原有风格：updateSingleVariable(variables, path, newValue, reason?)
 *
 * 注意：此函数只更新 stat_data，不更新 display_data 和 delta_data
 * display_data 由更高层的函数（如 updateVariablesFromMessage）管理
 */
export function updateSingleVariable(
  variables: MvuData,
  pathOrCommand: string | STStyleCommand,
  newValue?: unknown,
  reason = "",
): CommandResult {
  // ═══════════════════════════════════════════════════════════════════════════
  // 参数规范化：支持 STStyleCommand 对象
  // ═══════════════════════════════════════════════════════════════════════════
  let path: string;
  let actualNewValue: unknown;
  let expectedOldValue: unknown;
  let commandName: string;

  if (typeof pathOrCommand === "object" && pathOrCommand !== null) {
    // SillyTavern 风格：command 对象
    const cmd = pathOrCommand as STStyleCommand;
    path = cmd.path;
    actualNewValue = cmd.newValue;
    expectedOldValue = cmd.oldValue;
    commandName = cmd.name;
  } else {
    // 原有风格：分离参数
    path = pathOrCommand as string;
    actualNewValue = newValue;
    expectedOldValue = undefined;
    commandName = "set";
  }

  const fixedPath = fixPath(path);

  // ═══════════════════════════════════════════════════════════════════════════
  // 处理 delete 命令
  // ═══════════════════════════════════════════════════════════════════════════
  if (commandName === "delete") {
    if (!hasPath(variables.stat_data, fixedPath)) {
      return { success: false, path: fixedPath, error: `路径 '${fixedPath}' 不存在` };
    }
    const oldValue = getByPath(variables.stat_data, fixedPath);
    unsetByPath(variables.stat_data, fixedPath);
    return { success: true, path: fixedPath, oldValue, newValue: undefined };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 处理 insert 命令
  // ═══════════════════════════════════════════════════════════════════════════
  if (commandName === "insert") {
    const target = getByPath(variables.stat_data, fixedPath);
    if (Array.isArray(target)) {
      target.push(actualNewValue);
      return { success: true, path: fixedPath, newValue: target };
    }
    // 如果路径不存在，创建数组
    if (!hasPath(variables.stat_data, fixedPath)) {
      setByPath(variables.stat_data, fixedPath, [actualNewValue]);
      return { success: true, path: fixedPath, newValue: [actualNewValue] };
    }
    return { success: false, path: fixedPath, error: "insert 目标必须是数组" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 处理 set 命令
  // ═══════════════════════════════════════════════════════════════════════════

  // 如果路径不存在且 expectedOldValue 是 undefined，创建路径
  if (!hasPath(variables.stat_data, fixedPath)) {
    if (expectedOldValue === undefined) {
      // 创建新路径
      setByPath(variables.stat_data, fixedPath, actualNewValue);
      return { success: true, path: fixedPath, oldValue: undefined, newValue: actualNewValue };
    }
    return { success: false, path: fixedPath, error: `路径 '${fixedPath}' 不存在` };
  }

  const currentValue = getByPath(variables.stat_data, fixedPath);

  // ═══════════════════════════════════════════════════════════════════════════
  // oldValue 验证（SillyTavern 行为：严格相等）
  // ═══════════════════════════════════════════════════════════════════════════
  if (expectedOldValue !== undefined) {
    // ValueWithDescription 检查
    if (isValueWithDescription(currentValue)) {
      const actualOld = getVWDValue(currentValue);
      if (JSON.stringify(actualOld) !== JSON.stringify(expectedOldValue)) {
        return { success: false, path: fixedPath, error: "oldValue 不匹配" };
      }
      setVWDValue(currentValue, actualNewValue);
      return { success: true, path: fixedPath, oldValue: actualOld, newValue: actualNewValue };
    }

    // 普通值严格相等检查
    if (JSON.stringify(currentValue) !== JSON.stringify(expectedOldValue)) {
      return { success: false, path: fixedPath, error: "oldValue 不匹配" };
    }
  }

  // ValueWithDescription（兼容数组和对象格式）
  if (isValueWithDescription(currentValue)) {
    const oldActual = getVWDValue(currentValue);
    setVWDValue(currentValue, actualNewValue);
    return { success: true, path: fixedPath, oldValue: oldActual, newValue: actualNewValue };
  }

  // 普通值
  setByPath(variables.stat_data, fixedPath, actualNewValue);
  return { success: true, path: fixedPath, oldValue: currentValue, newValue: actualNewValue };
}
