/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Index Path Traversal Engine                              ║
 * ║                                                                           ║
 * ║  索引路径引擎 - JSON 容器的深层遍历、读写、类型转换                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { VariableScope } from "@/lib/slash-command/types";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

type JsonRecord = Record<string, unknown>;
type JsonContainer = JsonRecord | unknown[] | null;
type IndexPathSegment = string | number;

/* ═══════════════════════════════════════════════════════════════════════════
   容器解析
   ═══════════════════════════════════════════════════════════════════════════ */

export function parseIndexedContainer(current: unknown, key: string, scope: VariableScope): JsonContainer {
  if (current === undefined || current === null || current === "") {
    return null;
  }

  if (Array.isArray(current)) {
    return cloneJsonValue(current) as unknown[];
  }

  if (isJsonRecord(current)) {
    return cloneJsonValue(current) as JsonRecord;
  }

  if (typeof current !== "string") {
    throw indexedTypeError(scope, key, "must be JSON object or array when using index");
  }

  try {
    const parsed = JSON.parse(current);
    if (parsed === null) {
      return null;
    }
    if (Array.isArray(parsed)) {
      return cloneJsonValue(parsed) as unknown[];
    }
    if (isJsonRecord(parsed)) {
      return cloneJsonValue(parsed) as JsonRecord;
    }
  } catch {
    throw indexedTypeError(scope, key, "is not valid JSON for index access");
  }

  throw indexedTypeError(scope, key, "must be JSON object or array when using index");
}

/* ═══════════════════════════════════════════════════════════════════════════
   索引读写
   ═══════════════════════════════════════════════════════════════════════════ */

export function setByIndex(
  container: JsonContainer,
  index: string,
  value: unknown,
  key: string,
  scope: VariableScope,
): JsonRecord | unknown[] {
  return updateByIndex(container, index, key, scope, () => value);
}

export function getByIndex(container: JsonContainer, index: string, key: string, scope: VariableScope): unknown {
  const segments = parseIndexPath(index, key, scope);
  let cursor: unknown = container;

  for (const segment of segments) {
    if (cursor === undefined || cursor === null) {
      return undefined;
    }

    if (typeof segment === "number") {
      if (!Array.isArray(cursor)) {
        throw indexedTypeError(scope, key, `must be JSON array for numeric index '${index}'`);
      }
      cursor = cursor[segment];
      continue;
    }

    if (!isJsonRecord(cursor)) {
      throw indexedTypeError(scope, key, `must be JSON object for key index '${index}'`);
    }
    cursor = cursor[segment];
  }

  return cursor;
}

export function updateByIndex(
  container: JsonContainer,
  index: string,
  key: string,
  scope: VariableScope,
  updater: (current: unknown) => unknown,
): JsonRecord | unknown[] {
  const segments = parseIndexPath(index, key, scope);
  const root = ensureRootContainer(container, segments[0], key, scope, index);
  let cursor: JsonRecord | unknown[] = root;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const current = readSegment(cursor, segment, key, scope, index);
    const ensured = ensureBranchContainer(current, nextSegment, key, scope, index);
    writeSegment(cursor, segment, ensured, key, scope, index);
    cursor = ensured;
  }

  const leafSegment = segments[segments.length - 1];
  const leafValue = readSegment(cursor, leafSegment, key, scope, index);
  const nextValue = updater(leafValue);
  writeSegment(cursor, leafSegment, nextValue, key, scope, index);
  return root;
}

/* ═══════════════════════════════════════════════════════════════════════════
   索引值操作
   ═══════════════════════════════════════════════════════════════════════════ */

export function addIndexedValue(
  current: unknown,
  typedValue: unknown,
  rawValue: string,
  key: string,
  scope: VariableScope,
): unknown {
  if (isJsonRecord(current)) {
    throw indexedTypeError(scope, key, "target value must be number, string, or array when using add index");
  }

  if (isJsonRecord(typedValue)) {
    throw indexedTypeError(scope, key, "add index does not support object type");
  }

  if (Array.isArray(current)) {
    const next = [...current];
    next.push(typedValue);
    return next;
  }

  const increment = Number(typedValue);
  const currentNumber = Number(current ?? 0);
  if (Number.isFinite(increment) && Number.isFinite(currentNumber)) {
    return currentNumber + increment;
  }

  const append = typedValue === undefined ? rawValue : String(typedValue);
  return `${String(current ?? "")}${append}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   内部工具
   ═══════════════════════════════════════════════════════════════════════════ */

function ensureRootContainer(
  container: JsonContainer,
  firstSegment: IndexPathSegment,
  key: string,
  scope: VariableScope,
  index: string,
): JsonRecord | unknown[] {
  if (container === null) {
    return createContainerForSegment(firstSegment);
  }
  if (typeof firstSegment === "number") {
    if (!Array.isArray(container)) {
      throw indexedTypeError(scope, key, `must be JSON array for numeric index '${index}'`);
    }
    return container;
  }
  if (!isJsonRecord(container)) {
    throw indexedTypeError(scope, key, `must be JSON object for key index '${index}'`);
  }
  return container;
}

function ensureBranchContainer(
  value: unknown,
  nextSegment: IndexPathSegment,
  key: string,
  scope: VariableScope,
  index: string,
): JsonRecord | unknown[] {
  if (value === undefined || value === null || value === "") {
    return createContainerForSegment(nextSegment);
  }
  if (typeof nextSegment === "number") {
    if (!Array.isArray(value)) {
      throw indexedTypeError(scope, key, `must be JSON array for numeric index '${index}'`);
    }
    return value;
  }
  if (!isJsonRecord(value)) {
    throw indexedTypeError(scope, key, `must be JSON object for key index '${index}'`);
  }
  return value;
}

function readSegment(
  container: JsonRecord | unknown[],
  segment: IndexPathSegment,
  key: string,
  scope: VariableScope,
  index: string,
): unknown {
  if (typeof segment === "number") {
    if (!Array.isArray(container)) {
      throw indexedTypeError(scope, key, `must be JSON array for numeric index '${index}'`);
    }
    return container[segment];
  }
  if (!isJsonRecord(container)) {
    throw indexedTypeError(scope, key, `must be JSON object for key index '${index}'`);
  }
  return container[segment];
}

function writeSegment(
  container: JsonRecord | unknown[],
  segment: IndexPathSegment,
  value: unknown,
  key: string,
  scope: VariableScope,
  index: string,
): void {
  if (typeof segment === "number") {
    if (!Array.isArray(container)) {
      throw indexedTypeError(scope, key, `must be JSON array for numeric index '${index}'`);
    }
    container[segment] = value;
    return;
  }
  if (!isJsonRecord(container)) {
    throw indexedTypeError(scope, key, `must be JSON object for key index '${index}'`);
  }
  container[segment] = value;
}

function parseIndexPath(index: string, key: string, scope: VariableScope): IndexPathSegment[] {
  const source = index.trim();
  if (source === "") {
    throw indexedTypeError(scope, key, "index cannot be empty");
  }

  const segments: IndexPathSegment[] = [];
  let token = "";
  let cursor = 0;

  const pushToken = (): void => {
    const value = token.trim();
    token = "";
    if (value === "") {
      return;
    }
    segments.push(parseIndexSegment(value));
  };

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === ".") {
      pushToken();
      cursor += 1;
      continue;
    }

    if (char === "[") {
      pushToken();
      const closeIndex = source.indexOf("]", cursor);
      if (closeIndex === -1) {
        throw indexedTypeError(scope, key, `has invalid index path '${index}'`);
      }

      const inner = source.slice(cursor + 1, closeIndex).trim();
      if (inner === "") {
        throw indexedTypeError(scope, key, `has invalid index path '${index}'`);
      }

      if ((inner.startsWith("\"") && inner.endsWith("\"")) || (inner.startsWith("'") && inner.endsWith("'"))) {
        segments.push(inner.slice(1, -1));
      } else {
        segments.push(parseIndexSegment(inner));
      }

      cursor = closeIndex + 1;
      continue;
    }

    token += char;
    cursor += 1;
  }

  pushToken();
  if (segments.length === 0) {
    throw indexedTypeError(scope, key, `has invalid index path '${index}'`);
  }
  return segments;
}

function parseIndexSegment(segment: string): IndexPathSegment {
  if (/^-?\d+$/.test(segment)) {
    return Number(segment);
  }
  return segment;
}

function createContainerForSegment(segment: IndexPathSegment): JsonRecord | unknown[] {
  return typeof segment === "number" ? [] : {};
}

function indexedTypeError(scope: VariableScope, key: string, detail: string): Error {
  const scopeName = scope === "global" ? "Global" : "Local";
  return new Error(`${scopeName} variable '${key}' ${detail}`);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isJsonRecord(value)) {
    const cloned: JsonRecord = {};
    for (const [key, nested] of Object.entries(value)) {
      cloned[key] = cloneJsonValue(nested);
    }
    return cloned;
  }

  return value;
}

