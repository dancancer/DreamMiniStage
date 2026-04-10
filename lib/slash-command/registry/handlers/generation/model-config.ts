/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║              Model / Config / Image / Regex Handlers                      ║
 * ║                                                                           ║
 * ║  Preset、Model、Instruct、Image生成、Regex 等配置类命令                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../../types";
import type { ImageGenerationOptions } from "../../../types";
import {
  ensureHostCallback,
  parseStrictBoolean,
  parseStrictOptionalBoolean,
  parseStrictOptionalNumber,
  parseStrictOptionalInteger,
  parseImageProcessingMode,
  resolveCommandText,
  readImageConfig,
  updateImageConfig,
  readInstructModeState,
  updateInstructModeState,
  readStringFromStorage,
  writeStringToStorage,
  readNumberFromStorage,
  writeNumberToStorage,
  normalizeStopStringsSnapshot,
  parseStopStringsPayload,
  parseContextQuiet,
} from "./_helpers";

/* ─── 内部类型 & 常量 ─── */
type RegexToggleState = "on" | "off" | "toggle";
const REASONING_TEMPLATE_STORAGE_KEY = "dreamministage.reasoning-template";
const START_REPLY_WITH_STORAGE_KEY = "dreamministage.start-reply-with";
const PICK_REROLL_STORAGE_KEY_PREFIX = "dreamministage.pick-reroll-seed";

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

function normalizeStorageScope(raw: string | undefined): string {
  const normalized = (raw || "global").trim();
  if (!normalized) {
    return "global";
  }
  return normalized.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function resolveRerollPickStorageKey(ctx: Parameters<CommandHandler>[2]): string {
  const scope = normalizeStorageScope(ctx.dialogueId || ctx.characterId);
  return `${PICK_REROLL_STORAGE_KEY_PREFIX}:${scope}`;
}

function normalizeRerollPickValue(raw: string | undefined, currentSeed: number): number {
  const normalized = (raw || "").trim();
  if (!normalized) {
    return currentSeed + 1;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? parsed : currentSeed + 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Image 生成命令
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

/* ═══════════════════════════════════════════════════════════════════════════
   Preset / Model / Instruct 命令
   ═══════════════════════════════════════════════════════════════════════════ */

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

/** /start-reply-with [text] - 读取或设置起始回复前缀 */
export const handleStartReplyWith: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const force = parseStrictBoolean(namedArgs.force, "start-reply-with", "force", false);
  const nextValue = (args.join(" ") || pipe || "").trim();
  if (!nextValue && !force) {
    return readStringFromStorage(START_REPLY_WITH_STORAGE_KEY);
  }

  return writeStringToStorage(START_REPLY_WITH_STORAGE_KEY, nextValue);
};

/** /reroll-pick [seed] - 递增或显式设置 pick reroll seed */
export const handleRerollPick: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const storageKey = resolveRerollPickStorageKey(ctx);
  const currentSeed = readNumberFromStorage(storageKey) ?? 0;
  const nextSeed = normalizeRerollPickValue(args[0] || pipe, currentSeed);
  return String(writeNumberToStorage(storageKey, nextSeed));
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

/* ═══════════════════════════════════════════════════════════════════════════
   Regex 命令
   ═══════════════════════════════════════════════════════════════════════════ */

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
