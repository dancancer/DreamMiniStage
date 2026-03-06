/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║            WorldBook & Generation Command Handlers                        ║
 * ║                                                                           ║
 * ║  WorldBook命令 + 生成命令 (preset/regex/audio/gen等)                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationProcessingMode,
  InstructModePatch,
  InstructModeState,
} from "../../types";
import { parseBoolean } from "../utils/helpers";

type RegexToggleState = "on" | "off" | "toggle";
type PromptEntryReturnType = "simple" | "list" | "dict";
type PromptEntrySwitchState = "on" | "off" | "toggle";

interface PromptEntrySnapshot {
  identifier: string;
  name: string;
  enabled: boolean;
}

function normalizeRegexToggleState(raw?: string): RegexToggleState {
  const normalized = (raw || "toggle").trim().toLowerCase();
  if (normalized === "on" || normalized === "off" || normalized === "toggle") {
    return normalized;
  }
  throw new Error(`/regex-toggle invalid state: ${raw || ""}`);
}

function normalizeRegexScriptName(raw: string, commandName: string): string {
  const normalized = (raw || "").trim();
  if (!normalized) {
    throw new Error(`/${commandName} requires a script name`);
  }
  return normalized;
}

function parsePromptEntryTargets(raw: string | undefined): string[] {
  const normalized = (raw || "").trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
    }
    if (typeof parsed === "string") {
      return parsed.trim().length > 0 ? [parsed.trim()] : [];
    }
  } catch {
    // keep raw as plain string
  }

  return [normalized];
}

function collectPromptTargets(
  key: "identifier" | "name",
  namedArgs: Record<string, string>,
  invocationMeta: Parameters<CommandHandler>[4],
): string[] {
  const rawValues: string[] = [];
  const metaValues = invocationMeta?.namedArgumentList
    ?.filter((item) => item.name === key)
    .map((item) => item.value) || [];
  rawValues.push(...metaValues);

  if (rawValues.length === 0 && namedArgs[key] !== undefined) {
    rawValues.push(namedArgs[key]);
  }

  const values = rawValues.flatMap((item) => parsePromptEntryTargets(item));
  return Array.from(new Set(values));
}

function normalizePromptEntryReturnType(raw: string | undefined): PromptEntryReturnType {
  const normalized = (raw || "simple").trim().toLowerCase();
  if (normalized === "simple" || normalized === "list" || normalized === "dict") {
    return normalized;
  }
  throw new Error(`/getpromptentry invalid return type: ${raw || ""}`);
}

function normalizePromptEntryState(raw: string | undefined): PromptEntrySwitchState {
  const normalized = (raw || "toggle").trim().toLowerCase();
  if (normalized === "toggle" || normalized === "on" || normalized === "off") {
    return normalized;
  }
  if (normalized === "true" || normalized === "1") return "on";
  if (normalized === "false" || normalized === "0") return "off";
  throw new Error(`/setpromptentry invalid state: ${raw || ""}`);
}

function resolvePromptEntries(
  entries: PromptEntrySnapshot[],
  identifiers: string[],
  names: string[],
): PromptEntrySnapshot[] {
  const selected = new Map<string, PromptEntrySnapshot>();
  const byIdentifier = new Map(entries.map((entry) => [entry.identifier, entry]));

  for (const identifier of identifiers) {
    const matched = byIdentifier.get(identifier);
    if (matched) {
      selected.set(matched.identifier, matched);
    }
  }

  if (names.length > 0) {
    const nameSet = new Set(names);
    for (const entry of entries) {
      if (nameSet.has(entry.name)) {
        selected.set(entry.identifier, entry);
      }
    }
  }

  return Array.from(selected.values());
}

function parseStrictBoolean(
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

function parseGenerateRole(raw: string | undefined): "system" | "char" {
  const normalized = (raw || "system").trim().toLowerCase();
  if (normalized === "system" || normalized === "char") {
    return normalized;
  }
  throw new Error(`/genraw invalid as value: ${raw || ""}`);
}

function parseGenerateLength(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/genraw invalid length value: ${raw}`);
  }
  return parsed;
}

function parseStopSequences(raw: string | undefined): string[] {
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

function parseContextQuiet(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/context invalid quiet value: ${raw}`);
  }
  return parsed;
}

const REASONING_TEMPLATE_STORAGE_KEY = "dreamministage.reasoning-template";

function readStringFromStorage(storageKey: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function writeStringToStorage(storageKey: string, value: string): string {
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

function normalizeStopStringsSnapshot(
  value: unknown,
  commandName: string,
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`/${commandName} host returned non-array stop strings`);
  }
  return value.map((item) => String(item));
}

function parseStopStringsPayload(raw: string, commandName: string): string[] {
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

function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function parseStrictOptionalBoolean(
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

function parseStrictOptionalNumber(
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

function parseStrictOptionalInteger(
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

function parseImageProcessingMode(
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

function resolveCommandText(
  args: string[],
  pipe: string,
): string {
  return (args.join(" ") || pipe || "").trim();
}

function normalizeImageConfig(
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

async function readImageConfig(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<ImageGenerationConfig> {
  const getter = ensureHostCallback(ctx.getImageGenerationConfig, commandName);
  const snapshot = await Promise.resolve(getter());
  return normalizeImageConfig(snapshot, commandName);
}

async function updateImageConfig(
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

function normalizeInstructModeState(
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

async function readInstructModeState(
  ctx: Parameters<CommandHandler>[2],
  commandName: string,
): Promise<InstructModeState> {
  const getter = ensureHostCallback(ctx.getInstructMode, commandName);
  const result = await Promise.resolve(getter());
  return normalizeInstructModeState(result, commandName);
}

async function updateInstructModeState(
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
   WorldBook 命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /getentry <id> - 获取 World Book 条目 */
export const handleGetEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.getWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  const entry = ctx.getWorldBookEntry(args[0]);
  return entry ? JSON.stringify(entry) : "";
};

/** /searchentry <query> - 搜索 World Book 条目 */
export const handleSearchEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.searchWorldBook) return pipe;
  const query = args.join(" ") || pipe;
  if (!query) return "[]";
  const entries = ctx.searchWorldBook(query);
  return JSON.stringify(entries);
};

/** /setentry <id> key=value ... - 设置 World Book 条目属性 */
export const handleSetEntry: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.setWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  const id = args[0];
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(namedArgs)) {
    if (key === "enabled") {
      data[key] = value.toLowerCase() === "true" || value === "1";
    } else if (key === "priority" || key === "depth") {
      data[key] = parseInt(value, 10);
    } else if (key === "keys") {
      data[key] = value.split(",").map((k) => k.trim());
    } else {
      data[key] = value;
    }
  }
  await ctx.setWorldBookEntry(id, data);
  return pipe;
};

/** /createentry key=value ... - 创建新的 World Book 条目 */
export const handleCreateEntry: CommandHandler = async (_args, namedArgs, ctx, pipe) => {
  if (!ctx.createWorldBookEntry) return pipe;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(namedArgs)) {
    if (key === "enabled") {
      data[key] = value.toLowerCase() === "true" || value === "1";
    } else if (key === "priority" || key === "depth") {
      data[key] = parseInt(value, 10);
    } else if (key === "keys") {
      data[key] = value.split(",").map((k) => k.trim());
    } else {
      data[key] = value;
    }
  }
  const newEntry = await ctx.createWorldBookEntry(data);
  return newEntry ? JSON.stringify(newEntry) : pipe;
};

/** /deleteentry <id> - 删除 World Book 条目 */
export const handleDeleteEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.deleteWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  await ctx.deleteWorldBookEntry(args[0]);
  return pipe;
};

/** /activateentry <id> - 手动激活 World Book 条目 */
export const handleActivateEntry: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.activateWorldBookEntry) return pipe;
  if (args.length === 0) return pipe;
  await ctx.activateWorldBookEntry(args[0]);
  return pipe;
};

/** /listentries [book] - 列出 World Book 所有条目 */
export const handleListEntries: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (!ctx.listWorldBookEntries) return pipe;
  const bookName = args[0];
  const entries = ctx.listWorldBookEntries(bookName);
  return JSON.stringify(entries);
};

/** /worldbook <action> [args] - 世界书管理命令 */
export const handleWorldBook: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const action = args[0].toLowerCase();
  const rest = args.slice(1);

  if (action === "list") {
    if (!ctx.listWorldBookEntries) return pipe;
    return JSON.stringify(ctx.listWorldBookEntries(rest[0]));
  }
  if (action === "get") {
    if (!ctx.getWorldBookEntry || rest.length === 0) return pipe;
    const entry = ctx.getWorldBookEntry(rest[0]);
    return entry ? JSON.stringify(entry) : "";
  }
  if (action === "search") {
    if (!ctx.searchWorldBook) return pipe;
    return JSON.stringify(ctx.searchWorldBook(rest.join(" ") || pipe));
  }
  if (action === "enable") {
    if (!ctx.setWorldBookEntry || rest.length === 0) return pipe;
    await ctx.setWorldBookEntry(rest[0], { enabled: true });
    return pipe;
  }
  if (action === "disable") {
    if (!ctx.setWorldBookEntry || rest.length === 0) return pipe;
    await ctx.setWorldBookEntry(rest[0], { enabled: false });
    return pipe;
  }
  if (action === "delete") {
    if (!ctx.deleteWorldBookEntry || rest.length === 0) return pipe;
    await ctx.deleteWorldBookEntry(rest[0]);
    return pipe;
  }
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   Preset / Regex / Audio 命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /imagine|/image|/img <prompt> - 调用宿主图像生成能力 */
export const handleImagine: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.generateImage, "imagine");
  const prompt = resolveCommandText(args, pipe);
  if (!prompt) {
    throw new Error("/imagine requires prompt");
  }

  const options: ImageGenerationOptions = {
    quiet: parseStrictOptionalBoolean(namedArgs.quiet, "imagine", "quiet"),
    negative: namedArgs.negative,
    extend: parseStrictOptionalBoolean(namedArgs.extend, "imagine", "extend"),
    edit: parseStrictOptionalBoolean(namedArgs.edit, "imagine", "edit"),
    multimodal: parseStrictOptionalBoolean(namedArgs.multimodal, "imagine", "multimodal"),
    snap: parseStrictOptionalBoolean(namedArgs.snap, "imagine", "snap"),
    processing: parseImageProcessingMode(namedArgs.processing),
    seed: parseStrictOptionalInteger(namedArgs.seed, "imagine", "seed"),
    width: parseStrictOptionalInteger(namedArgs.width, "imagine", "width"),
    height: parseStrictOptionalInteger(namedArgs.height, "imagine", "height"),
    steps: parseStrictOptionalInteger(namedArgs.steps, "imagine", "steps"),
    cfg: parseStrictOptionalNumber(namedArgs.cfg, "imagine", "cfg"),
    skip: parseStrictOptionalInteger(namedArgs.skip, "imagine", "skip"),
    model: namedArgs.model,
    sampler: namedArgs.sampler,
    scheduler: namedArgs.scheduler,
    vae: namedArgs.vae,
    upscaler: namedArgs.upscaler,
    hires: parseStrictOptionalBoolean(namedArgs.hires, "imagine", "hires"),
    scale: parseStrictOptionalNumber(namedArgs.scale, "imagine", "scale"),
    denoise: parseStrictOptionalNumber(namedArgs.denoise, "imagine", "denoise"),
    secondPassSteps: parseStrictOptionalInteger(namedArgs["2ndpass"], "imagine", "2ndpass"),
    faces: parseStrictOptionalBoolean(namedArgs.faces, "imagine", "faces"),
  };
  const result = await Promise.resolve(callback(prompt, options));
  if (typeof result !== "string") {
    throw new Error("/imagine host callback must return a string");
  }
  return result;
};

/** /imagine-source|/img-source [source] - 获取或切换图像源 */
export const handleImagineSource: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const nextSource = resolveCommandText(args, pipe);
  if (!nextSource) {
    const current = await readImageConfig(ctx, "imagine-source");
    return current.source;
  }

  const updated = await updateImageConfig(ctx, "imagine-source", { source: nextSource });
  return updated.source;
};

/** /imagine-style|/img-style [style] - 获取或切换图像风格 */
export const handleImagineStyle: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const nextStyle = resolveCommandText(args, pipe);
  if (!nextStyle) {
    const current = await readImageConfig(ctx, "imagine-style");
    return current.style;
  }

  const updated = await updateImageConfig(ctx, "imagine-style", { style: nextStyle });
  return updated.style;
};

/** /imagine-comfy-workflow|/icw <name> - 设置 Comfy workflow */
export const handleImagineComfyWorkflow: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const workflow = resolveCommandText(args, pipe);
  if (!workflow) {
    throw new Error("/imagine-comfy-workflow requires workflow name");
  }
  const updated = await updateImageConfig(ctx, "imagine-comfy-workflow", {
    comfyWorkflow: workflow,
  });
  return updated.comfyWorkflow;
};

/** /preset [name] - 切换或获取当前预设 */
export const handlePreset: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getPreset && !ctx.setPreset) return pipe;

  if (args.length === 0 && Object.keys(namedArgs).length === 0) {
    if (!ctx.getPreset) return pipe;
    const current = ctx.getPreset();
    return current ? JSON.stringify(current) : "";
  }

  if (!ctx.setPreset) return pipe;
  const presetName = args[0] || namedArgs.name;
  if (presetName) {
    await ctx.setPreset(presetName);
  }
  return pipe;
};

/**
 * /stop-strings - 读取/设置自定义停止词
 * 别名：/stopping-strings /custom-stopping-strings /custom-stop-strings
 */
export const handleStopStrings: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const force = parseStrictOptionalBoolean(namedArgs.force, "custom-stop-strings", "force") ?? false;
  const rawInput = resolveCommandText(args, pipe);

  if (!rawInput && !force) {
    const getStopStrings = ensureHostCallback(ctx.getStopStrings, "custom-stop-strings");
    const current = await Promise.resolve(getStopStrings());
    return JSON.stringify(normalizeStopStringsSnapshot(current, "custom-stop-strings"));
  }

  const setStopStrings = ensureHostCallback(ctx.setStopStrings, "custom-stop-strings");
  const nextStopStrings = rawInput
    ? parseStopStringsPayload(rawInput, "custom-stop-strings")
    : [];
  const updated = await Promise.resolve(setStopStrings(nextStopStrings));
  return JSON.stringify(normalizeStopStringsSnapshot(updated, "custom-stop-strings"));
};

/** /model [name] - 读取或设置当前模型 */
export const handleModel: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const targetModel = resolveCommandText(args, pipe);
  const quiet = parseStrictOptionalBoolean(namedArgs.quiet, "model", "quiet") ?? false;

  if (!targetModel) {
    const getModel = ensureHostCallback(ctx.getModel, "model");
    const current = await Promise.resolve(getModel());
    if (typeof current !== "string") {
      throw new Error("/model host returned non-string model");
    }
    return current;
  }

  const setModel = ensureHostCallback(ctx.setModel, "model");
  const updated = await Promise.resolve(setModel(targetModel, { quiet }));
  if (typeof updated !== "string") {
    throw new Error("/model host returned non-string model");
  }
  return updated;
};

/** /reasoning-template [name] - 读取或设置当前推理模板 */
export const handleReasoningTemplate: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const nextTemplate = (args.join(" ") || namedArgs.name || pipe || "").trim();
  if (!nextTemplate) {
    return readStringFromStorage(REASONING_TEMPLATE_STORAGE_KEY);
  }

  return writeStringToStorage(REASONING_TEMPLATE_STORAGE_KEY, nextTemplate);
};

/** /instruct [name] - 获取或设置 instruct 模板 */
export const handleInstruct: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const presetName = resolveCommandText(args, pipe);
  const quiet = parseStrictOptionalBoolean(namedArgs.quiet, "instruct", "quiet") ?? false;
  const forceGet = parseStrictOptionalBoolean(namedArgs.forceGet, "instruct", "forceGet") ?? false;

  if (!presetName) {
    const snapshot = await readInstructModeState(ctx, "instruct");
    if (!snapshot.enabled && !forceGet) {
      return "";
    }
    return snapshot.preset || "";
  }

  const updated = await updateInstructModeState(ctx, "instruct", {
    preset: presetName,
    enabled: true,
    quiet,
  });
  return updated.preset || presetName;
};

/** /instruct-on - 开启 instruct 模式 */
export const handleInstructOn: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const updated = await updateInstructModeState(ctx, "instruct-on", { enabled: true });
  return String(updated.enabled);
};

/** /instruct-off - 关闭 instruct 模式 */
export const handleInstructOff: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const updated = await updateInstructModeState(ctx, "instruct-off", { enabled: false });
  return String(updated.enabled);
};

/** /instruct-state|/instruct-toggle [state] - 读取或设置 instruct 状态 */
export const handleInstructState: CommandHandler = async (args, _namedArgs, ctx, _pipe) => {
  if (args.length === 0) {
    const snapshot = await readInstructModeState(ctx, "instruct-state");
    return String(snapshot.enabled);
  }

  const nextState = parseStrictOptionalBoolean(args[0], "instruct-state", "state");
  if (nextState === undefined) {
    throw new Error("/instruct-state invalid state value");
  }
  const updated = await updateInstructModeState(ctx, "instruct-state", { enabled: nextState });
  return String(updated.enabled);
};

/** /context [name] - 切换或获取当前 context 模板 */
export const handleContext: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.selectContextPreset) {
    throw new Error("/context is not available in current context");
  }

  const contextName = (args.join(" ") || pipe || "").trim();
  const quiet = parseContextQuiet(namedArgs.quiet);
  const result = await Promise.resolve(
    ctx.selectContextPreset(contextName || undefined, { quiet }),
  );

  if (typeof result !== "string") {
    throw new Error("/context host callback must return a string");
  }
  return result;
};

/** /listpresets - 列出所有可用预设 */
export const handleListPresets: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.listPresets) return pipe;
  const presets = ctx.listPresets();
  return JSON.stringify(presets);
};

/** /getpromptentry - 获取指定 prompt 条目的启用状态 */
export const handleGetPromptEntry: CommandHandler = async (
  _args,
  namedArgs,
  ctx,
  _pipe,
  invocationMeta,
) => {
  if (!ctx.listPromptEntries) {
    throw new Error("/getpromptentry is not available in current context");
  }

  const identifiers = collectPromptTargets("identifier", namedArgs, invocationMeta);
  const names = collectPromptTargets("name", namedArgs, invocationMeta);
  if (identifiers.length === 0 && names.length === 0) {
    throw new Error("/getpromptentry requires identifier or name");
  }

  let returnType = normalizePromptEntryReturnType(namedArgs.return);
  const entries = await Promise.resolve(ctx.listPromptEntries());
  const matched = resolvePromptEntries(entries, identifiers, names);
  const states = new Map(matched.map((entry) => [entry.identifier, entry.enabled === true]));
  if (states.size === 0) {
    return "";
  }

  if (returnType === "simple" && states.size > 1) {
    returnType = identifiers.length > 0 ? "dict" : "list";
  }

  if (returnType === "list") {
    return JSON.stringify(Array.from(states.values()));
  }
  if (returnType === "dict") {
    return JSON.stringify(Object.fromEntries(states));
  }
  return states.values().next().value ? "true" : "false";
};

/** /setpromptentry - 设置指定 prompt 条目的启用状态 */
export const handleSetPromptEntry: CommandHandler = async (
  args,
  namedArgs,
  ctx,
  pipe,
  invocationMeta,
) => {
  if (!ctx.listPromptEntries || !ctx.setPromptEntriesEnabled) {
    throw new Error("/setpromptentry is not available in current context");
  }

  const identifiers = collectPromptTargets("identifier", namedArgs, invocationMeta);
  const names = collectPromptTargets("name", namedArgs, invocationMeta);
  if (identifiers.length === 0 && names.length === 0) {
    throw new Error("/setpromptentry requires identifier or name");
  }

  const state = normalizePromptEntryState(args[0] || namedArgs.state || pipe);
  const entries = await Promise.resolve(ctx.listPromptEntries());
  const matched = resolvePromptEntries(entries, identifiers, names);
  if (matched.length === 0) {
    return "";
  }

  const updates = matched.map((entry) => ({
    identifier: entry.identifier,
    enabled: state === "toggle"
      ? !entry.enabled
      : state === "on",
  }));
  await Promise.resolve(ctx.setPromptEntriesEnabled(updates));
  return "";
};

/** /regex-preset [name] - 获取或切换当前 regex 预设 */
export const handleRegexPreset: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const target = (args.join(" ") || pipe || "").trim();
  if (!target) {
    if (!ctx.getRegexPreset) {
      throw new Error("/regex-preset is not available in current context");
    }
    const current = await Promise.resolve(ctx.getRegexPreset());
    return current || "";
  }

  if (!ctx.setRegexPreset) {
    throw new Error("/regex-preset set is not available in current context");
  }
  const selected = await Promise.resolve(ctx.setRegexPreset(target));
  if (!selected) {
    throw new Error(`/regex-preset not found: ${target}`);
  }
  return selected;
};

/** /regex <action> [args] - 正则脚本管理 */
export const handleRegex: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const action = args[0].toLowerCase();
  const rest = args.slice(1);

  if (action === "list") {
    if (!ctx.listRegexScripts) return pipe;
    const scripts = await Promise.resolve(ctx.listRegexScripts());
    return JSON.stringify(scripts);
  }
  if (action === "get") {
    if (!ctx.getRegexScript || rest.length === 0) return pipe;
    const script = await Promise.resolve(ctx.getRegexScript(rest[0]));
    return script ? JSON.stringify(script) : "";
  }
  if (action === "enable") {
    if (!ctx.setRegexScriptEnabled || rest.length === 0) return pipe;
    await ctx.setRegexScriptEnabled(rest[0], true);
    return pipe;
  }
  if (action === "disable") {
    if (!ctx.setRegexScriptEnabled || rest.length === 0) return pipe;
    await ctx.setRegexScriptEnabled(rest[0], false);
    return pipe;
  }
  if (action === "run") {
    if (!ctx.runRegexScript) return pipe;
    const scriptName = rest[0];
    const input = rest.slice(1).join(" ") || pipe;
    return await ctx.runRegexScript(scriptName, input);
  }
  return pipe;
};

/** /regex-toggle [state=on|off|toggle] <scriptName> - 切换 regex 脚本启用状态 */
export const handleRegexToggle: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.getRegexScript || !ctx.setRegexScriptEnabled) {
    throw new Error("/regex-toggle is not available in current context");
  }

  const state = normalizeRegexToggleState(namedArgs.state);
  const rawName = args.join(" ") || pipe;
  const scriptName = normalizeRegexScriptName(rawName, "regex-toggle");
  const script = await Promise.resolve(ctx.getRegexScript(scriptName));
  if (!script) {
    throw new Error(`/regex-toggle script not found: ${scriptName}`);
  }

  const currentEnabled = script.enabled !== false;
  const nextEnabled = state === "toggle"
    ? !currentEnabled
    : state === "on";
  await Promise.resolve(ctx.setRegexScriptEnabled(script.name, nextEnabled));
  return script.name;
};

/** /audio <action> [args] - 音频播放控制 */
export const handleAudio: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (args.length === 0) return pipe;
  const action = args[0].toLowerCase();
  const rest = args.slice(1);

  if (action === "play") {
    if (!ctx.playAudio) return pipe;
    const url = rest[0] || namedArgs.url || pipe;
    const volume = namedArgs.volume ? parseFloat(namedArgs.volume) : undefined;
    const loop = namedArgs.loop === "true" || namedArgs.loop === "1";
    await ctx.playAudio(url, { volume, loop });
    return pipe;
  }
  if (action === "stop") {
    if (!ctx.stopAudio) return pipe;
    await ctx.stopAudio();
    return pipe;
  }
  if (action === "pause") {
    if (!ctx.pauseAudio) return pipe;
    await ctx.pauseAudio();
    return pipe;
  }
  if (action === "resume") {
    if (!ctx.resumeAudio) return pipe;
    await ctx.resumeAudio();
    return pipe;
  }
  if (action === "volume") {
    if (!ctx.setAudioVolume || rest.length === 0) return pipe;
    const volume = parseFloat(rest[0]);
    await ctx.setAudioVolume(volume);
    return pipe;
  }
  return pipe;
};

/** /play <url> - 播放音频的快捷命令 */
export const handlePlay: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.playAudio) return pipe;
  const url = args[0] || pipe;
  if (!url) return pipe;
  const volume = namedArgs.volume ? parseFloat(namedArgs.volume) : undefined;
  const loop = namedArgs.loop === "true" || namedArgs.loop === "1";
  await ctx.playAudio(url, { volume, loop });
  return pipe;
};

/** /stop - 停止音频播放 */
export const handleStop: CommandHandler = async (_args, _namedArgs, ctx, pipe) => {
  if (!ctx.stopAudio) return pipe;
  await ctx.stopAudio();
  return pipe;
};

/* ═══════════════════════════════════════════════════════════════════════════
   生成命令
   ═══════════════════════════════════════════════════════════════════════════ */

/** /gen <prompt> - 生成文本（显示结果） */
export const handleGen: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.generate) return pipe;
  const prompt = args.join(" ") || pipe;
  if (!prompt) return pipe;
  const options = {
    maxTokens: namedArgs.max ? parseInt(namedArgs.max, 10) : undefined,
    temperature: namedArgs.temp ? parseFloat(namedArgs.temp) : undefined,
  };
  return await ctx.generate(prompt, options);
};

/** /genq <prompt> - 静默生成文本（不显示） */
export const handleGenQuiet: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.generateQuiet && !ctx.generate) return pipe;
  const prompt = args.join(" ") || pipe;
  if (!prompt) return pipe;
  const options = {
    maxTokens: namedArgs.max ? parseInt(namedArgs.max, 10) : undefined,
    temperature: namedArgs.temp ? parseFloat(namedArgs.temp) : undefined,
  };
  const generator = ctx.generateQuiet || ctx.generate;
  return await generator!(prompt, options);
};

/** /genraw <prompt> - 原始生成（不拼接聊天历史） */
export const handleGenRaw: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.generateRaw) {
    throw new Error("/genraw is not available in current context");
  }

  const prompt = (args.join(" ") || pipe || "").trim();
  if (!prompt) {
    throw new Error("/genraw requires prompt");
  }

  const result = await ctx.generateRaw(prompt, {
    lock: parseStrictBoolean(namedArgs.lock, "genraw", "lock", false),
    instruct: parseStrictBoolean(namedArgs.instruct, "genraw", "instruct", true),
    as: parseGenerateRole(namedArgs.as),
    systemPrompt: namedArgs.system || "",
    prefillPrompt: namedArgs.prefill || "",
    responseLength: parseGenerateLength(namedArgs.length),
    trimNames: parseStrictBoolean(namedArgs.trim, "genraw", "trim", true),
    stopSequences: parseStopSequences(namedArgs.stop),
  });
  if (typeof result !== "string") {
    throw new Error("/genraw host returned non-string result");
  }
  return result;
};

/** /generate-stop - 中止当前生成 */
export const handleGenerateStop: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  if (!ctx.stopGeneration) {
    throw new Error("/generate-stop is not available in current context");
  }

  const stopped = await Promise.resolve(ctx.stopGeneration());
  if (typeof stopped !== "boolean") {
    throw new Error("/generate-stop host returned non-boolean result");
  }
  return String(stopped);
};

/** /inject <prompt> - 临时注入提示词到下一次生成 */
export const handleInject: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.injectPrompt) return pipe;
  const prompt = args.join(" ") || pipe;
  if (!prompt) return pipe;
  const options = {
    position: namedArgs.position as "before" | "after" | "chat" | "in_chat" | "none" | undefined,
    depth: namedArgs.depth ? parseInt(namedArgs.depth, 10) : undefined,
    role: namedArgs.role as "system" | "user" | "assistant" | undefined,
    ephemeral: parseBoolean(namedArgs.ephemeral, true),
  };
  await ctx.injectPrompt(prompt, options);
  return pipe;
};

/** /activatelore <name> - 手动激活 World Info 条目 */
export const handleActivateLore: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  if (!ctx.activateWorldInfoEntry) return pipe;
  const name = args[0] || namedArgs.name || pipe;
  if (!name) return pipe;
  const duration = namedArgs.duration ? parseInt(namedArgs.duration, 10) : undefined;
  await ctx.activateWorldInfoEntry(name, { duration });
  return pipe;
};
