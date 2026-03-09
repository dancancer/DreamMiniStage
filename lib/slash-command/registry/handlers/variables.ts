/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Variable Command Handlers                                ║
 * ║                                                                           ║
 * ║  变量命令 - setvar / getvar / delvar / listvar 等                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { ExecutionContext, VariableScope } from "@/lib/slash-command/types";

/* ═══════════════════════════════════════════════════════════════════════════
   基础变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /setvar key=value 或 /setvar key value - 设置变量 */
export const handleSetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const resolvedNamedArgs = normalizeAssignmentNamedArgs(namedArgs, args, pipe);
  assertSupportedNamedArgs(resolvedNamedArgs, ["key", "value", "index", "as"], "setvar");

  const key = resolveVariableKey(args, resolvedNamedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, resolvedNamedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(resolvedNamedArgs);
  if (index !== undefined) {
    setIndexedScopedVariable(ctx, "local", key, index, value, resolvedNamedArgs.as);
    return String(value);
  }

  scopedSet(ctx, "local", key, value);
  return String(value);
};

/** /getvar key - 获取变量 */
export const handleGetVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  assertSupportedNamedArgs(namedArgs, ["key", "index"], "getvar");

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const index = resolveVariableIndex(namedArgs);
  const value = index === undefined
    ? scopedGet(ctx, "local", key)
    : getIndexedScopedVariable(ctx, "local", key, index);
  return normalizeReadValue(value);
};

/** /delvar key - 删除变量 */
export const handleDelVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  ctx.deleteVariable(args[0]);
  return pipe;
};

/** /listvar - 列出所有变量 */
export const handleListVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.listVariables) return pipe;
  const vars = ctx.listVariables();
  return JSON.stringify(vars);
};

/** /flushvar - 清空所有变量 */
export const handleFlushVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.flushVariables) return pipe;
  ctx.flushVariables();
  return pipe;
};

/** /dumpvar - 导出所有变量为 JSON */
export const handleDumpVar: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.dumpVariables) return pipe;
  const dump = ctx.dumpVariables();
  return JSON.stringify(dump, null, 2);
};

/** /setglobalvar key value - 设置全局变量 */
export const handleSetGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const resolvedNamedArgs = normalizeAssignmentNamedArgs(namedArgs, args, pipe);
  assertSupportedNamedArgs(resolvedNamedArgs, ["key", "value", "index", "as"], "setglobalvar");

  const key = resolveVariableKey(args, resolvedNamedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, resolvedNamedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(resolvedNamedArgs);
  if (index !== undefined) {
    setIndexedScopedVariable(ctx, "global", key, index, value, resolvedNamedArgs.as);
    return String(value);
  }

  scopedSet(ctx, "global", key, value);
  return String(value);
};

/** /getglobalvar key - 获取全局变量 */
export const handleGetGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  assertSupportedNamedArgs(namedArgs, ["key", "index"], "getglobalvar");

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const index = resolveVariableIndex(namedArgs);
  const value = index === undefined
    ? scopedGet(ctx, "global", key)
    : getIndexedScopedVariable(ctx, "global", key, index);
  return normalizeReadValue(value);
};

/** /flushglobalvar key - 删除全局变量 */
export const handleFlushGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  scopedDelete(ctx, "global", key);
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   数值变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /addvar key value - 追加或累加本地变量 */
export const handleAddVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  assertSupportedNamedArgs(namedArgs, ["key", "value", "index", "as"], "addvar");

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(namedArgs);
  if (index !== undefined) {
    const next = addToIndexedScopedVariable(ctx, "local", key, index, value, namedArgs.as);
    return normalizeReadValue(next);
  }

  const next = addToScopedVariable(ctx, "local", key, value);
  return stringifyVariable(next);
};

/** /addglobalvar key value - 追加或累加全局变量 */
export const handleAddGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  assertSupportedNamedArgs(namedArgs, ["key", "value", "index", "as"], "addglobalvar");

  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const value = resolveVariableValue(args, namedArgs, pipe);
  if (value === undefined) return pipe;

  const index = resolveVariableIndex(namedArgs);
  if (index !== undefined) {
    const next = addToIndexedScopedVariable(ctx, "global", key, index, value, namedArgs.as);
    return normalizeReadValue(next);
  }

  const next = addToScopedVariable(ctx, "global", key, value);
  return stringifyVariable(next);
};

/** /incvar key [amount] - 增加数值变量 */
export const handleIncVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const key = args[0];
  const rawAmount = args.length > 1 ? parseFloat(args[1]) : 1;
  const amount = Number.isFinite(rawAmount) ? rawAmount : 1;
  const current = ctx.getVariable(key);
  const parsed = typeof current === "number" ? current : parseFloat(String(current));
  const base = Number.isFinite(parsed) ? parsed : 0;
  const newValue = base + amount;
  ctx.setVariable(key, newValue);
  return String(newValue);
};

/** /decvar key [amount] - 减少数值变量 */
export const handleDecVar: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const key = args[0];
  const rawAmount = args.length > 1 ? parseFloat(args[1]) : 1;
  const amount = Number.isFinite(rawAmount) ? rawAmount : 1;
  const current = ctx.getVariable(key);
  const parsed = typeof current === "number" ? current : parseFloat(String(current));
  const base = Number.isFinite(parsed) ? parsed : 0;
  const newValue = base - amount;
  ctx.setVariable(key, newValue);
  return String(newValue);
};

/** /incglobalvar key - 增加全局变量 */
export const handleIncGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const next = addToScopedVariable(ctx, "global", key, "1");
  return stringifyVariable(next);
};

/** /decglobalvar key - 减少全局变量 */
export const handleDecGlobalVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const key = resolveVariableKey(args, namedArgs);
  if (!key) return pipe;

  const next = addToScopedVariable(ctx, "global", key, "-1");
  return stringifyVariable(next);
};

/* ═══════════════════════════════════════════════════════════════════════════
   数组变量操作
   ═══════════════════════════════════════════════════════════════════════════ */

/** /push key value? - 将值压入变量数组，默认用 pipe 作为值 */
export const handlePush: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const [key, ...rest] = args;
  const values = rest.length > 0 ? rest : pipe ? [pipe] : [];
  if (values.length === 0) return pipe;

  const current = ctx.getVariable(key);
  const base = Array.isArray(current) ? [...current] : [];
  base.push(...values);
  ctx.setVariable(key, base);
  return JSON.stringify(base);
};

/* ═══════════════════════════════════════════════════════════════════════════
   内部工具
   ═══════════════════════════════════════════════════════════════════════════ */

function resolveVariableKey(args: string[], namedArgs: Record<string, string>): string | undefined {
  return namedArgs.key ?? args[0];
}

function resolveVariableValue(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string | undefined {
  if (namedArgs.value !== undefined) {
    return namedArgs.value;
  }

  if (namedArgs.key !== undefined) {
    if (args.length > 0) {
      return args.join(" ");
    }
    return pipe || undefined;
  }

  if (args.length >= 2) {
    return args.slice(1).join(" ");
  }

  return pipe || undefined;
}

function resolveVariableIndex(namedArgs: Record<string, string>): string | undefined {
  return namedArgs.index;
}

function normalizeAssignmentNamedArgs(
  namedArgs: Record<string, string>,
  args: string[],
  pipe: string,
): Record<string, string> {
  if (args.length > 0) {
    return namedArgs;
  }

  const entries = Object.entries(namedArgs);
  if (entries.length !== 1) {
    return namedArgs;
  }

  const [[key, value]] = entries;
  if (key === "key" && pipe) {
    return namedArgs;
  }

  if (["value", "index", "as"].includes(key)) {
    return namedArgs;
  }

  return { key, value };
}

function assertSupportedNamedArgs(
  namedArgs: Record<string, string>,
  allowedKeys: string[],
  commandName: string,
): void {
  const allowed = new Set(allowedKeys);
  const unsupported = Object.keys(namedArgs).find((key) => !allowed.has(key));
  if (unsupported) {
    throw new Error(`/${commandName} does not support named argument '${unsupported}'`);
  }
}

function setIndexedScopedVariable(
  ctx: ExecutionContext,
  scope: VariableScope,
  key: string,
  index: string,
  rawValue: string,
  typeHint: string | undefined,
): void {
  const base = parseIndexedContainer(scopedGet(ctx, scope, key), key, scope);
  const typedValue = convertIndexedValue(rawValue, typeHint);
  const next = setByIndex(base, index, typedValue, key, scope);
  scopedSet(ctx, scope, key, JSON.stringify(next));
}

function getIndexedScopedVariable(
  ctx: ExecutionContext,
  scope: VariableScope,
  key: string,
  index: string,
): unknown {
  const current = scopedGet(ctx, scope, key);
  if (current === undefined) {
    return undefined;
  }

  const base = parseIndexedContainer(current, key, scope);
  if (base === null) {
    return undefined;
  }
  return getByIndex(base, index, key, scope);
}

type JsonRecord = Record<string, unknown>;
type JsonContainer = JsonRecord | unknown[] | null;
type IndexPathSegment = string | number;

function addToIndexedScopedVariable(
  ctx: ExecutionContext,
  scope: VariableScope,
  key: string,
  index: string,
  rawValue: string,
  typeHint: string | undefined,
): unknown {
  const base = parseIndexedContainer(scopedGet(ctx, scope, key), key, scope);
  const typedValue = convertIndexedValue(rawValue, typeHint);
  const next = updateByIndex(base, index, key, scope, (current) => addIndexedValue(current, typedValue, rawValue, key, scope));
  scopedSet(ctx, scope, key, JSON.stringify(next));
  return getByIndex(next, index, key, scope);
}

function parseIndexedContainer(current: unknown, key: string, scope: VariableScope): JsonContainer {
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

function setByIndex(
  container: JsonContainer,
  index: string,
  value: unknown,
  key: string,
  scope: VariableScope,
): JsonRecord | unknown[] {
  return updateByIndex(container, index, key, scope, () => value);
}

function getByIndex(container: JsonContainer, index: string, key: string, scope: VariableScope): unknown {
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

function updateByIndex(
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

function addIndexedValue(
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

function convertIndexedValue(value: string, typeHint: string | undefined): unknown {
  if (typeof typeHint !== "string") {
    return value;
  }

  switch (typeHint.trim().toLowerCase()) {
  case "string":
  case "str":
    return String(value);
  case "null":
    return null;
  case "undefined":
  case "none":
    return undefined;
  case "number":
    return Number(value);
  case "int":
    return Number.parseInt(value, 10);
  case "float":
    return Number.parseFloat(value);
  case "boolean":
  case "bool":
    return parseTrueBoolean(value);
  case "list":
  case "array":
    return parseAsArray(value);
  case "object":
  case "dict":
  case "dictionary":
    return parseAsObject(value);
  default:
    return value;
  }
}

function parseTrueBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1";
}

function parseAsArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAsObject(value: string): unknown {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeReadValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  if (typeof value !== "string") {
    return String(value);
  }

  if (value.trim() === "") {
    return "";
  }

  return value;
}

function scopedGet(ctx: ExecutionContext, scope: VariableScope, key: string): unknown {
  if (scope === "local") {
    return ctx.getVariable(key);
  }
  if (ctx.getScopedVariable) {
    return ctx.getScopedVariable(scope, key);
  }
  return ctx.getVariable(key);
}

function scopedSet(ctx: ExecutionContext, scope: VariableScope, key: string, value: unknown): void {
  if (scope === "local") {
    ctx.setVariable(key, value);
    return;
  }
  if (ctx.setScopedVariable) {
    ctx.setScopedVariable(scope, key, value);
    return;
  }
  ctx.setVariable(key, value);
}

function scopedDelete(ctx: ExecutionContext, scope: VariableScope, key: string): void {
  if (scope === "local") {
    ctx.deleteVariable(key);
    return;
  }
  if (ctx.deleteScopedVariable) {
    ctx.deleteScopedVariable(scope, key);
    return;
  }
  ctx.deleteVariable(key);
}

function addToScopedVariable(
  ctx: ExecutionContext,
  scope: VariableScope,
  key: string,
  value: string,
): unknown {
  const current = scopedGet(ctx, scope, key) ?? 0;

  const list = parseListValue(current);
  if (list) {
    list.push(value);
    scopedSet(ctx, scope, key, list);
    return list;
  }

  const increment = Number(value);
  const currentNumber = Number(current);
  if (Number.isFinite(increment) && Number.isFinite(currentNumber)) {
    const nextNumber = currentNumber + increment;
    scopedSet(ctx, scope, key, nextNumber);
    return nextNumber;
  }

  const nextText = `${String(current ?? "")}${value}`;
  scopedSet(ctx, scope, key, nextText);
  return nextText;
}

function parseListValue(current: unknown): string[] | undefined {
  if (Array.isArray(current)) {
    return current.map((item) => String(item));
  }

  if (typeof current !== "string") {
    return undefined;
  }

  try {
    const parsed = JSON.parse(current);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // 非 JSON 文本不按数组处理
  }

  return undefined;
}

function stringifyVariable(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(",");
  }
  return String(value);
}
