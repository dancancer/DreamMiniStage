/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║            WorldBook & Generation Command Handlers                        ║
 * ║                                                                           ║
 * ║  WorldBook命令 + 生成命令 (preset/regex/audio/gen等)                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
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
