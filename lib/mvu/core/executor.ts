/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 命令执行器                                     ║
 * ║                                                                            ║
 * ║  执行变量更新命令，维护状态一致性                                             ║
 * ║  设计原则：纯函数执行，副作用隔离                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { MvuData, MvuCommand, CommandResult, StatData } from "../types";
import { isValueWithDescription } from "../types";
import { extractCommands, parseCommandValue, fixPath, trimQuotes } from "./parser";
import { getSchemaForPath, validateInsert, validateDelete, reconcileSchema } from "./schema";
import { applyTemplate } from "../data/template";

// ============================================================================
//                              工具函数
// ============================================================================

function deepClone<T>(obj: T): T {
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
  if (current) delete current[segments[segments.length - 1]];
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

  // 处理 ValueWithDescription
  if (isValueWithDescription(oldValue) && !Array.isArray(newValue)) {
    const oldActual = (oldValue as [unknown, string])[0];
    if (typeof oldActual === "number" && newValue !== null) {
      newValue = Number(newValue);
    }
    (oldValue as [unknown, string])[0] = newValue;
    return {
      success: true,
      path,
      oldValue: oldActual,
      newValue,
    };
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
    oldValue: isValueWithDescription(oldValue) ? (oldValue as [unknown, string])[0] : oldValue,
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

  // ValueWithDescription
  if (isValueWithDescription(currentValue)) {
    const arr = currentValue as [unknown, string];
    const oldActual = arr[0];
    if (typeof oldActual === "number" && typeof delta === "number") {
      arr[0] = parseFloat((oldActual + delta).toPrecision(12));
      return { success: true, path, oldValue: oldActual, newValue: arr[0] };
    }
    // 日期处理
    if (typeof oldActual === "string" && typeof delta === "number") {
      const date = new Date(oldActual);
      if (!isNaN(date.getTime())) {
        arr[0] = new Date(date.getTime() + delta).toISOString();
        return { success: true, path, oldValue: oldActual, newValue: arr[0] };
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

  // 两参数：合并对象或追加数组
  if (args.length === 2) {
    let valueToInsert = parseCommandValue(args[1]);

    // 应用模板
    if (targetSchema && "template" in targetSchema) {
      valueToInsert = applyTemplate(valueToInsert, targetSchema.template);
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
      valueToInsert = applyTemplate(valueToInsert, targetSchema.template);
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
}

/** 从消息内容更新变量 */
export function updateVariablesFromMessage(
  messageContent: string,
  variables: MvuData,
): UpdateResult {
  const newVariables = deepClone(variables);
  const displayData: Record<string, unknown> = deepClone(newVariables.stat_data);
  const deltaData: Record<string, unknown> = {};

  const commands = extractCommands(messageContent);
  const results: CommandResult[] = [];
  let modified = false;

  for (const command of commands) {
    const result = executeCommand(newVariables.stat_data, command, newVariables.schema);
    results.push(result);

    if (result.success) {
      modified = true;
      const path = result.path;
      const reasonStr = command.reason ? `(${command.reason})` : "";
      const displayStr = `${JSON.stringify(result.oldValue)}->${JSON.stringify(result.newValue)} ${reasonStr}`;

      if (path) {
        setByPath(displayData, path, displayStr);
        setByPath(deltaData, path, displayStr);
      }
    }
  }

  newVariables.display_data = displayData;
  newVariables.delta_data = deltaData;

  // 调和 Schema
  if (modified) {
    reconcileSchema(newVariables);
  }

  return { modified, results, variables: newVariables };
}

/** 直接更新单个变量 */
export function updateSingleVariable(
  variables: MvuData,
  path: string,
  newValue: unknown,
  reason = "",
): CommandResult {
  const fixedPath = fixPath(path);

  if (!hasPath(variables.stat_data, fixedPath)) {
    return { success: false, path: fixedPath, error: `路径 '${fixedPath}' 不存在` };
  }

  const oldValue = getByPath(variables.stat_data, fixedPath);
  const reasonStr = reason ? `(${reason})` : "";

  // ValueWithDescription
  if (isValueWithDescription(oldValue)) {
    const arr = oldValue as [unknown, string];
    const oldActual = arr[0];
    arr[0] = newValue;

    const displayStr = `${JSON.stringify(oldActual)}->${JSON.stringify(newValue)} ${reasonStr}`;
    if (variables.display_data) setByPath(variables.display_data, fixedPath, displayStr);
    if (variables.delta_data) setByPath(variables.delta_data, fixedPath, displayStr);

    return { success: true, path: fixedPath, oldValue: oldActual, newValue };
  }

  // 普通值
  setByPath(variables.stat_data, fixedPath, newValue);

  const displayStr = `${JSON.stringify(oldValue)}->${JSON.stringify(newValue)} ${reasonStr}`;
  if (variables.display_data) setByPath(variables.display_data, fixedPath, displayStr);
  if (variables.delta_data) setByPath(variables.delta_data, fixedPath, displayStr);

  return { success: true, path: fixedPath, oldValue, newValue };
}
