/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU JSON Patch 支持                               ║
 * ║                                                                            ║
 * ║  实现 RFC 6902 JSON Patch 操作                                             ║
 * ║  支持 add/remove/replace/move/copy/test 操作                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { StatData } from "./types";
import {
  executeAdd,
  executeRemove,
  executeReplace,
  executeMove,
  executeCopy,
  executeTest,
} from "./json-patch-ops";

// ============================================================================
//                              类型定义
// ============================================================================

/** JSON Patch 操作类型 */
export type PatchOperation =
  | AddOperation
  | RemoveOperation
  | ReplaceOperation
  | MoveOperation
  | CopyOperation
  | TestOperation;

interface BasePatchOperation {
  path: string;
}

export interface AddOperation extends BasePatchOperation {
  op: "add";
  value: unknown;
}

export interface RemoveOperation extends BasePatchOperation {
  op: "remove";
}

export interface ReplaceOperation extends BasePatchOperation {
  op: "replace";
  value: unknown;
}

export interface MoveOperation extends BasePatchOperation {
  op: "move";
  from: string;
}

export interface CopyOperation extends BasePatchOperation {
  op: "copy";
  from: string;
}

export interface TestOperation extends BasePatchOperation {
  op: "test";
  value: unknown;
}

/** Patch 执行结果 */
export interface PatchResult {
  success: boolean;
  error?: string;
  path?: string;
}

/** 批量 Patch 执行结果 */
export interface ApplyPatchResult {
  success: boolean;
  results: PatchResult[];
  document: StatData;
}

// ============================================================================
//                              路径解析
// ============================================================================

/**
 * 解析 JSON Pointer (RFC 6901)
 * 例如: "/foo/bar/0" -> ["foo", "bar", "0"]
 */
export function parseJsonPointer(pointer: string): string[] {
  if (!pointer) return [];
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer: ${pointer}`);
  }

  return pointer
    .slice(1)
    .split("/")
    .map((segment) =>
      segment.replace(/~1/g, "/").replace(/~0/g, "~"),
    );
}

/**
 * 将路径数组转换为 JSON Pointer
 */
export function toJsonPointer(segments: string[]): string {
  if (segments.length === 0) return "";
  return "/" + segments
    .map((seg) => seg.replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("/");
}

/**
 * 将点分隔路径转换为 JSON Pointer
 * 例如: "foo.bar[0]" -> "/foo/bar/0"
 */
export function dotPathToPointer(dotPath: string): string {
  if (!dotPath) return "";
  const segments = dotPath.split(/[.[\]]+/).filter(Boolean);
  return toJsonPointer(segments);
}

/**
 * 将 JSON Pointer 转换为点分隔路径
 */
export function pointerToDotPath(pointer: string): string {
  const segments = parseJsonPointer(pointer);
  return segments.join(".");
}

// ============================================================================
//                              值访问
// ============================================================================

/**
 * 通过 JSON Pointer 获取值
 */
export function getValueByPointer(doc: unknown, pointer: string): unknown {
  if (!pointer) return doc;

  const segments = parseJsonPointer(pointer);
  let current: unknown = doc;

  for (const segment of segments) {
    if (current == null) return undefined;

    if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

// ============================================================================
//                              主函数
// ============================================================================

/**
 * 应用单个 Patch 操作
 */
export function applyOperation(doc: StatData, op: PatchOperation): PatchResult {
  switch (op.op) {
  case "add":
    return executeAdd(doc, op);
  case "remove":
    return executeRemove(doc, op);
  case "replace":
    return executeReplace(doc, op);
  case "move":
    return executeMove(doc, op);
  case "copy":
    return executeCopy(doc, op);
  case "test":
    return executeTest(doc, op);
  default:
    return { success: false, error: `Unknown operation: ${(op as PatchOperation).op}` };
  }
}

/**
 * 应用 Patch 数组
 */
export function applyPatch(
  doc: StatData,
  patch: PatchOperation[],
  options: { stopOnError?: boolean } = {},
): ApplyPatchResult {
  const { stopOnError = true } = options;
  const clonedDoc = JSON.parse(JSON.stringify(doc)) as StatData;
  const results: PatchResult[] = [];

  for (const op of patch) {
    const result = applyOperation(clonedDoc, op);
    results.push(result);

    if (!result.success && stopOnError) {
      return { success: false, results, document: doc };
    }
  }

  const allSuccess = results.every((r) => r.success);
  return {
    success: allSuccess,
    results,
    document: allSuccess ? clonedDoc : doc,
  };
}

/**
 * 验证 Patch 操作
 */
export function validatePatch(patch: unknown): patch is PatchOperation[] {
  if (!Array.isArray(patch)) return false;

  const validOps = ["add", "remove", "replace", "move", "copy", "test"];

  for (const op of patch) {
    if (typeof op !== "object" || op === null) return false;
    if (!("op" in op) || !("path" in op)) return false;
    if (!validOps.includes((op as PatchOperation).op)) return false;
    if (typeof (op as PatchOperation).path !== "string") return false;

    const operation = op as PatchOperation;
    if (operation.op === "add" || operation.op === "replace" || operation.op === "test") {
      if (!("value" in operation)) return false;
    }
    if (operation.op === "move" || operation.op === "copy") {
      if (!("from" in operation) || typeof operation.from !== "string") return false;
    }
  }

  return true;
}

/**
 * 从消息内容中提取 JSON Patch（MagVarUpdate 兼容）
 * 支持格式：
 * 1. <jsonpatch>[...]</jsonpatch>
 * 2. <json_patch>[...]</json_patch>
 * 3. json_patch = [...]
 * 4. jsonpatch = [...]
 */
export function extractJsonPatch(content: string): PatchOperation[] | null {
  // 格式1-2：XML 标签包裹（MagVarUpdate 主要格式）
  const xmlPattern = /<(json_?patch)>(?:\s*```.*?)?([\s\S]*?)(?:```\s*)?<\/\1>/gim;
  const xmlMatch = content.match(xmlPattern);

  if (xmlMatch) {
    // 取最后一个匹配（MagVarUpdate 行为）
    const lastMatch = xmlMatch[xmlMatch.length - 1];
    const innerContent = lastMatch.replace(/<\/?json_?patch>/gi, "").replace(/```/g, "").trim();

    try {
      const patch = JSON.parse(innerContent);
      if (validatePatch(patch)) {
        return patch;
      }
    } catch {
      // 解析失败，尝试下一种格式
    }
  }

  // 格式3-4：赋值语法
  const assignPattern = /json_?patch\s*[=:]\s*(\[[\s\S]*?\])/i;
  const assignMatch = content.match(assignPattern);

  if (assignMatch) {
    try {
      const patch = JSON.parse(assignMatch[1]);
      if (validatePatch(patch)) {
        return patch;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * 创建 Patch 操作的便捷函数
 */
export const createPatch = {
  add: (path: string, value: unknown): AddOperation => ({ op: "add", path, value }),
  remove: (path: string): RemoveOperation => ({ op: "remove", path }),
  replace: (path: string, value: unknown): ReplaceOperation => ({ op: "replace", path, value }),
  move: (from: string, path: string): MoveOperation => ({ op: "move", from, path }),
  copy: (from: string, path: string): CopyOperation => ({ op: "copy", from, path }),
  test: (path: string, value: unknown): TestOperation => ({ op: "test", path, value }),
};

// ============================================================================
//                              MVU 命令转换（MagVarUpdate 兼容）
// ============================================================================

type MvuCommand = {
  type: "set" | "insert" | "delete";
  name: "set" | "insert" | "delete";
  fullMatch: string;
  args: string[];
  reason: string;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

/**
 * 将 JSON Patch 转换为 MVU 命令（MagVarUpdate 兼容格式）
 * 这样可以让 JSON Patch 通过统一的命令执行流程处理
 */
export function patchToMvuCommands(patch: PatchOperation[]): MvuCommand[] {
  const commands: MvuCommand[] = [];

  for (const op of patch) {
    // 将 JSON Pointer 转换为点分路径
    const path = pointerToDotPath(op.path);

    switch (op.op) {
    case "replace": {
      const replaceValue = (op as ReplaceOperation).value;
      commands.push({
        type: "set",
        name: "set",
        fullMatch: JSON.stringify(op),
        args: [path, JSON.stringify(replaceValue)],
        reason: "json_patch",
        path,
        newValue: replaceValue,
      });
      break;
    }

    case "add": {
      // JSON Patch add 对应 MVU insert
      const pathParts = parseJsonPointer(op.path);
      const lastPart = pathParts[pathParts.length - 1];
      const containerPath = pathParts.slice(0, -1);
      const containerDotPath = containerPath.length > 0
        ? containerPath.join(".")
        : "";
      const keyOrIndexArg = /^\d+$/.test(lastPart) ? lastPart : `'${lastPart}'`;
      const addValue = (op as AddOperation).value;

      commands.push({
        type: "insert",
        name: "insert",
        fullMatch: JSON.stringify(op),
        args: [containerDotPath, keyOrIndexArg, JSON.stringify(addValue)],
        reason: "json_patch",
        path: containerDotPath,
        newValue: addValue,
      });
      break;
    }

    case "remove": {
      commands.push({
        type: "delete",
        name: "delete",
        fullMatch: JSON.stringify(op),
        args: [path],
        reason: "json_patch",
        path,
      });
      break;
    }

    // move 和 copy 可以分解为 add + remove/get
    case "move": {
      const moveOp = op as MoveOperation;
      const fromPath = pointerToDotPath(moveOp.from);
      // 可以通过先 get 再 delete 旧位置，再 add 新位置实现
      // 这里简化处理：先提示不支持
      console.warn(`[MVU] JSON Patch move operation is not fully supported yet: ${JSON.stringify(op)}`);
      break;
    }

    case "copy": {
      console.warn(`[MVU] JSON Patch copy operation is not fully supported yet: ${JSON.stringify(op)}`);
      break;
    }

    case "test": {
      // test 操作通常用于验证，不需要转换为命令
      break;
    }
    }
  }

  return commands;
}
