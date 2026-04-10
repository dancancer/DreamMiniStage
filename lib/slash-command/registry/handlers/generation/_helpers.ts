/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║              Generation Module - Shared Helpers                           ║
 * ║                                                                           ║
 * ║  generation子模块内部共享的解析/校验/存储工具函数                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import type {
  ImageGenerationConfig,
  ImageGenerationProcessingMode,
  InstructModePatch,
  InstructModeState,
} from "../../../types";
import { parseBoolean } from "../../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   通用校验工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

export function parseStrictBoolean(
  raw: string | undefined,
  commandName: string,
  key: string,
  defaultValue: boolean,
): boolean {
  if (raw === undefined) {
    return defaultValue;
  }

  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${key} value: ${raw}`);
  }
  return parsed;
}

export function parseStrictOptionalBoolean(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw}`);
  }
  return parsed;
}

export function parseStrictOptionalNumber(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw}`);
  }
  return parsed;
}

export function parseStrictOptionalInteger(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): number | undefined {
  const parsed = parseStrictOptionalNumber(raw, commandName, fieldName);
  if (parsed === undefined) {
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    throw new Error(`/${commandName} invalid ${fieldName} value: ${raw}`);
  }
  return parsed;
}

export function resolveCommandText(
  args: string[],
  pipe: string,
): string {
  return (args.join(" ") || pipe || "").trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   localStorage 存储工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function readStringFromStorage(storageKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

export function writeStringToStorage(storageKey: string, value: string): string {
  const normalized = value.trim();
  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    window.localStorage.setItem(storageKey, normalized);
  } catch {
    // 忽略存储失败，调用方仍返回规范化结果
  }

  return normalized;
}

export function readNumberFromStorage(storageKey: string): number | null {
  const raw = readStringFromStorage(storageKey).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function writeNumberToStorage(storageKey: string, value: number): number {
  writeStringToStorage(storageKey, String(value));
  return value;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Image Config 工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function parseImageProcessingMode(
  raw: string | undefined,
): ImageGenerationProcessingMode | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "standard" || normalized === "minimal") {
    return normalized;
  }
  throw new Error(`/imagine invalid processing value: ${raw}`);
}

export function normalizeImageConfig(
  value: unknown,
  commandName: string,
): ImageGenerationConfig {
  if (!value || typeof value !== "object") {
    throw new Error(`/${commandName} host callback must return image config object`);
  }

  const record = value as Partial<ImageGenerationConfig>;
  if (typeof record.source !== "string") {
    throw new Error(`/${commandName} host callback must return image config source`);
  }
  if (typeof record.style !== "string") {
    throw new Error(`/${commandName} host callback must return image config style`);
  }
  if (typeof record.comfyWorkflow !== "string") {
    throw new Error(`/${commandName} host callback must return image config comfyWorkflow`);
  }
  return {
    source: record.source,
    style: record.style,
    comfyWorkflow: record.comfyWorkflow,
  };
}

export async function readImageConfig(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<ImageGenerationConfig> {
  const getter = ensureHostCallback(ctx.getImageGenerationConfig, commandName);
  const snapshot = await Promise.resolve(getter());
  return normalizeImageConfig(snapshot, commandName);
}

export async function updateImageConfig(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
  patch: Partial<ImageGenerationConfig>,
): Promise<ImageGenerationConfig> {
  const setter = ensureHostCallback(ctx.setImageGenerationConfig, commandName);
  const result = await Promise.resolve(setter(patch));
  if (result !== undefined) {
    return normalizeImageConfig(result, commandName);
  }
  return await readImageConfig(ctx, commandName);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Instruct Mode 工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeInstructModeState(
  value: unknown,
  commandName: string,
): InstructModeState {
  if (!value || typeof value !== "object") {
    throw new Error(`/${commandName} host callback must return instruct state object`);
  }

  const record = value as Partial<InstructModeState>;
  if (typeof record.enabled !== "boolean") {
    throw new Error(`/${commandName} host callback must return boolean enabled`);
  }

  if (
    record.preset !== null &&
    record.preset !== undefined &&
    typeof record.preset !== "string"
  ) {
    throw new Error(`/${commandName} host callback must return string preset or null`);
  }

  return {
    enabled: record.enabled,
    preset: record.preset ?? null,
  };
}

export async function readInstructModeState(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<InstructModeState> {
  const getter = ensureHostCallback(ctx.getInstructMode, commandName);
  const result = await Promise.resolve(getter());
  return normalizeInstructModeState(result, commandName);
}

export async function updateInstructModeState(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
  patch: InstructModePatch,
): Promise<InstructModeState> {
  const setter = ensureHostCallback(ctx.setInstructMode, commandName);
  const result = await Promise.resolve(setter(patch));
  if (result !== undefined) {
    return normalizeInstructModeState(result, commandName);
  }
  return await readInstructModeState(ctx, commandName);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Stop Strings 工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function normalizeStopStringsSnapshot(
  value: unknown,
  commandName: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`/${commandName} host returned non-array stop strings`);
  }
  return value.map((item) => String(item));
}

export function parseStopStringsPayload(raw: string, commandName: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`/${commandName} value must be a JSON array`);
    }
    return parsed.map((item) => String(item));
  } catch (error) {
    if (error instanceof Error && error.message.includes("JSON array")) {
      throw error;
    }
    throw new Error(`/${commandName} invalid value: ${raw}`);
  }
}

export function parseContextQuiet(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/context invalid quiet value: ${raw}`);
  }
  return parsed;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Generation / Summarize 工具
   ═══════════════════════════════════════════════════════════════════════════ */

export function parseGenerateRole(raw: string | undefined): "system" | "char" {
  const normalized = (raw || "system").trim().toLowerCase();
  if (normalized === "system" || normalized === "char") {
    return normalized;
  }
  throw new Error(`/genraw invalid as value: ${raw || ""}`);
}

export function parseGenerateLength(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/genraw invalid length value: ${raw}`);
  }
  return parsed;
}

export function parseStopSequences(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }

  const normalized = raw.trim();
  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      throw new Error("/genraw stop must be a JSON array");
    }
    return parsed.map((item) => String(item));
  } catch (error) {
    if (error instanceof Error && error.message.includes("JSON array")) {
      throw error;
    }
    throw new Error(`/genraw invalid stop value: ${raw}`);
  }
}

export type SummarizeSource = "main" | "extras" | "webllm";

export function normalizeSummarizeSource(raw: string | undefined): SummarizeSource {
  const normalized = (raw || "main").trim().toLowerCase();
  if (normalized === "main" || normalized === "extras" || normalized === "webllm") {
    return normalized as SummarizeSource;
  }
  throw new Error(`/summarize invalid source value: ${raw || ""}`);
}

export function buildSummarizeChatText(messages: Parameters<CommandHandler>[2]["messages"]): string {
  return messages
    .map((message) => {
      const content = (message.content || "").trim();
      if (!content) {
        return "";
      }

      const speaker = (message.name || message.role || "message").trim();
      return `${speaker}: ${content}`;
    })
    .filter((item) => item.length > 0)
    .join("\n");
}

export function normalizeSummarizeText(
  args: string[],
  pipe: string,
  messages: Parameters<CommandHandler>[2]["messages"],
): string {
  const explicit = (args.join(" ") || pipe || "").trim();
  if (explicit) {
    return explicit;
  }
  return buildSummarizeChatText(messages);
}
