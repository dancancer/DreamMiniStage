/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     JSON Patch 操作实现                                    ║
 * ║                                                                            ║
 * ║  add/remove/replace/move/copy/test 六种操作的执行逻辑                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { StatData } from "./types";
import type {
  AddOperation,
  RemoveOperation,
  ReplaceOperation,
  MoveOperation,
  CopyOperation,
  TestOperation,
  PatchResult,
} from "./json-patch";
import {
  parseJsonPointer,
  toJsonPointer,
  getValueByPointer,
} from "./json-patch";

// ============================================================================
//                              内部值操作
// ============================================================================

/**
 * 通过 JSON Pointer 设置值
 */
function setValueByPointer(doc: unknown, pointer: string, value: unknown): void {
  if (!pointer) {
    throw new Error("Cannot set root document");
  }

  const segments = parseJsonPointer(pointer);
  const lastSegment = segments.pop()!;
  let current: unknown = doc;

  for (const segment of segments) {
    if (current == null) {
      throw new Error(`Path not found: ${pointer}`);
    }

    if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  if (current == null) {
    throw new Error(`Path not found: ${pointer}`);
  }

  if (Array.isArray(current)) {
    const index = lastSegment === "-" ? current.length : parseInt(lastSegment, 10);
    current[index] = value;
  } else if (typeof current === "object") {
    (current as Record<string, unknown>)[lastSegment] = value;
  }
}

/**
 * 通过 JSON Pointer 删除值
 */
function removeValueByPointer(doc: unknown, pointer: string): unknown {
  if (!pointer) {
    throw new Error("Cannot remove root document");
  }

  const segments = parseJsonPointer(pointer);
  const lastSegment = segments.pop()!;
  let current: unknown = doc;

  for (const segment of segments) {
    if (current == null) {
      throw new Error(`Path not found: ${pointer}`);
    }

    if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  if (current == null) {
    throw new Error(`Path not found: ${pointer}`);
  }

  let removed: unknown;

  if (Array.isArray(current)) {
    const index = parseInt(lastSegment, 10);
    removed = current[index];
    current.splice(index, 1);
  } else if (typeof current === "object") {
    removed = (current as Record<string, unknown>)[lastSegment];
    delete (current as Record<string, unknown>)[lastSegment];
  }

  return removed;
}

// ============================================================================
//                              操作执行
// ============================================================================

export function executeAdd(doc: StatData, op: AddOperation): PatchResult {
  try {
    const segments = parseJsonPointer(op.path);

    if (segments.length === 0) {
      if (typeof op.value === "object" && !Array.isArray(op.value)) {
        Object.assign(doc, op.value);
        return { success: true, path: op.path };
      }
      return { success: false, path: op.path, error: "Cannot replace root with non-object" };
    }

    const lastSegment = segments.pop()!;
    const parentPointer = toJsonPointer(segments);
    const parent = segments.length === 0 ? doc : getValueByPointer(doc, parentPointer);

    if (parent == null) {
      return { success: false, path: op.path, error: "Parent path not found" };
    }

    if (Array.isArray(parent)) {
      const index = lastSegment === "-" ? parent.length : parseInt(lastSegment, 10);
      if (isNaN(index) || index < 0 || index > parent.length) {
        return { success: false, path: op.path, error: "Invalid array index" };
      }
      parent.splice(index, 0, op.value);
    } else if (typeof parent === "object") {
      (parent as Record<string, unknown>)[lastSegment] = op.value;
    } else {
      return { success: false, path: op.path, error: "Parent is not an object or array" };
    }

    return { success: true, path: op.path };
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}

export function executeRemove(doc: StatData, op: RemoveOperation): PatchResult {
  try {
    const existing = getValueByPointer(doc, op.path);
    if (existing === undefined) {
      return { success: false, path: op.path, error: "Path not found" };
    }
    removeValueByPointer(doc, op.path);
    return { success: true, path: op.path };
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}

export function executeReplace(doc: StatData, op: ReplaceOperation): PatchResult {
  try {
    const existing = getValueByPointer(doc, op.path);
    if (existing === undefined) {
      return { success: false, path: op.path, error: "Path not found" };
    }
    setValueByPointer(doc, op.path, op.value);
    return { success: true, path: op.path };
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}

export function executeMove(doc: StatData, op: MoveOperation): PatchResult {
  try {
    const value = getValueByPointer(doc, op.from);
    if (value === undefined) {
      return { success: false, path: op.path, error: `Source path not found: ${op.from}` };
    }

    removeValueByPointer(doc, op.from);

    const addResult = executeAdd(doc, { op: "add", path: op.path, value });
    if (!addResult.success) {
      return addResult;
    }

    return { success: true, path: op.path };
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}

export function executeCopy(doc: StatData, op: CopyOperation): PatchResult {
  try {
    const value = getValueByPointer(doc, op.from);
    if (value === undefined) {
      return { success: false, path: op.path, error: `Source path not found: ${op.from}` };
    }

    const clonedValue = JSON.parse(JSON.stringify(value));
    return executeAdd(doc, { op: "add", path: op.path, value: clonedValue });
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}

export function executeTest(doc: StatData, op: TestOperation): PatchResult {
  try {
    const value = getValueByPointer(doc, op.path);
    const isEqual = JSON.stringify(value) === JSON.stringify(op.value);

    if (!isEqual) {
      return { success: false, path: op.path, error: "Test failed: values not equal" };
    }

    return { success: true, path: op.path };
  } catch (e) {
    return { success: false, path: op.path, error: (e as Error).message };
  }
}
