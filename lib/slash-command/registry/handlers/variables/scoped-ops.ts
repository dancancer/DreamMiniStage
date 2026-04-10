/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Scoped Variable Operations                               ║
 * ║                                                                           ║
 * ║  作用域变量操作 - 作用域路由、高阶索引操作、值序列化                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { ExecutionContext, VariableScope } from "@/lib/slash-command/types";
import {
  parseIndexedContainer,
  setByIndex,
  getByIndex,
  updateByIndex,
  addIndexedValue,
} from "./indexed-ops";

/* ═══════════════════════════════════════════════════════════════════════════
   作用域读写路由
   ═══════════════════════════════════════════════════════════════════════════ */

export function scopedGet(ctx: ExecutionContext, scope: VariableScope, key: string): unknown {
  if (scope === "local") {
    return ctx.getVariable(key);
  }
  if (ctx.getScopedVariable) {
    return ctx.getScopedVariable(scope, key);
  }
  return ctx.getVariable(key);
}

export function scopedSet(ctx: ExecutionContext, scope: VariableScope, key: string, value: unknown): void {
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

export function scopedDelete(ctx: ExecutionContext, scope: VariableScope, key: string): void {
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

/* ═══════════════════════════════════════════════════════════════════════════
   索引变量高阶操作
   ═══════════════════════════════════════════════════════════════════════════ */

export function setIndexedScopedVariable(
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

export function getIndexedScopedVariable(
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

export function addToIndexedScopedVariable(
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

export function addToScopedVariable(
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

/* ═══════════════════════════════════════════════════════════════════════════
   值序列化工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeReadValue(value: unknown): string {
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

export function stringifyVariable(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(",");
  }
  return String(value);
}

/* ═══════════════════════════════════════════════════════════════════════════
   类型转换
   ═══════════════════════════════════════════════════════════════════════════ */

export function convertIndexedValue(value: string, typeHint: string | undefined): unknown {
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

export function parseListValue(current: unknown): string[] | undefined {
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
