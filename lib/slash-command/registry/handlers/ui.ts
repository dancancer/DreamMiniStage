/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    UI Command Handlers                                   ║
 * ║                                                                           ║
 * ║  UI 命令最小子集 - panels/bg/theme/movingui/vn/caption/beep              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { parseBoolean } from "../utils/helpers";

function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function resolveCommandText(args: string[], pipe: string): string {
  return (args.join(" ") || pipe || "").trim();
}

function parseNonNegativeInteger(
  raw: string | undefined,
  commandName: string,
  fieldName: string,
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/${commandName} invalid ${fieldName}: ${raw}`);
  }
  return parsed;
}

function parseButtonLabels(raw: string | undefined): string[] {
  if (!raw) {
    throw new Error("/buttons requires labels argument");
  }

  const normalized = raw.trim();
  if (!normalized) {
    throw new Error("/buttons requires labels argument");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (_error) {
    const fallback = normalized
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (fallback.length > 0) {
      return fallback;
    }
    throw new Error(`/buttons invalid labels value: ${raw}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("/buttons labels must be a JSON array");
  }

  const labels = parsed
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0);
  if (labels.length === 0) {
    throw new Error("/buttons labels must contain at least one non-empty string");
  }
  return labels;
}

/** /panels - 切换 UI 面板显示 */
export const handlePanels: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.togglePanels, "panels");
  await callback();
  return "";
};

/** /resetpanels - 重置 UI 面板布局 */
export const handleResetPanels: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.resetPanels, "resetpanels");
  await callback();
  return "";
};

/** /vn - 切换视觉小说模式 */
export const handleVn: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.toggleVisualNovelMode, "vn");
  await callback();
  return "";
};

/** /bg [background] - 读取或设置背景 */
export const handleBg: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setBackground, "bg");
  const background = resolveCommandText(args, pipe);
  const result = await callback(background || undefined);
  if (typeof result !== "string") {
    throw new Error("/bg host callback must return a string");
  }
  return result;
};

/** /lockbg - 锁定当前聊天背景（别名 /bglock） */
export const handleLockBg: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.lockBackground, "lockbg");
  await callback();
  return "";
};

/** /unlockbg - 解除当前聊天背景锁定（别名 /bgunlock） */
export const handleUnlockBg: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.unlockBackground, "unlockbg");
  await callback();
  return "";
};

/** /autobg - 根据上下文自动切换背景（别名 /bgauto） */
export const handleAutoBg: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.autoBackground, "autobg");
  await callback();
  return "";
};

/** /theme [name] - 读取或设置主题 */
export const handleTheme: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setTheme, "theme");
  const theme = resolveCommandText(args, pipe);
  const result = await callback(theme || undefined);
  if (typeof result !== "string") {
    throw new Error("/theme host callback must return a string");
  }
  return result;
};

/** /movingui <preset> - 切换 MovingUI 预设 */
export const handleMovingUi: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setMovingUiPreset, "movingui");
  const presetName = resolveCommandText(args, pipe);
  if (!presetName) {
    throw new Error("/movingui requires a preset name");
  }

  const result = await callback(presetName);
  if (typeof result !== "string") {
    throw new Error("/movingui host callback must return a string");
  }
  return result;
};

/** /css-var varname=--foo [to=chat] <value> - 设置 CSS 变量 */
export const handleCssVar: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setCssVariable, "css-var");
  const varName = (namedArgs.varname || "").trim();
  if (!varName) {
    throw new Error("/css-var requires varname");
  }
  if (!varName.startsWith("--")) {
    throw new Error("/css-var varname must start with \"--\"");
  }

  const value = resolveCommandText(args, pipe);
  if (!value) {
    throw new Error("/css-var requires a value");
  }

  await callback({
    varName,
    value,
    target: namedArgs.to?.trim() || undefined,
  });
  return "";
};

/** /bgcol [color] - 根据当前背景或显式颜色设置对话主色调 */
export const handleBgCol: CommandHandler = async (args, _namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.setAverageBackgroundColor, "bgcol");
  const color = resolveCommandText(args, pipe);
  const result = await Promise.resolve(callback(color || undefined));
  if (typeof result !== "string") {
    throw new Error("/bgcol host callback must return a string");
  }
  return result;
};

/** /bubble - 切换到气泡聊天样式（别名 /bubbles） */
export const handleBubble: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.setChatDisplayMode, "bubble");
  await Promise.resolve(callback("bubble"));
  return "";
};

/** /flat - 切换到默认平铺样式（别名 /default） */
export const handleFlat: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.setChatDisplayMode, "flat");
  await Promise.resolve(callback("default"));
  return "";
};

/** /single - 切换到文档样式（别名 /story） */
export const handleStory: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.setChatDisplayMode, "single");
  await Promise.resolve(callback("document"));
  return "";
};

/** /buttons labels=[...] [multiple=true|false] <text> - 显示按钮弹窗并返回结果 */
export const handleButtons: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.showButtonsPopup, "buttons");
  const labels = parseButtonLabels(namedArgs.labels);
  const parsedMultiple = parseBoolean(namedArgs.multiple, undefined);
  if (namedArgs.multiple !== undefined && parsedMultiple === undefined) {
    throw new Error(`/buttons invalid multiple value: ${namedArgs.multiple}`);
  }
  const multiple = parsedMultiple ?? false;

  const text = resolveCommandText(args, pipe);
  if (!text) {
    throw new Error("/buttons requires popup text");
  }

  const result = await Promise.resolve(callback(text, labels, { multiple }));
  if (result === undefined || result === null) {
    return "";
  }
  if (typeof result === "string") {
    return result;
  }
  if (Array.isArray(result)) {
    if (!result.every((item) => typeof item === "string")) {
      throw new Error("/buttons host callback must return string array when multiple=true");
    }
    return JSON.stringify(result);
  }
  throw new Error("/buttons host callback must return string or string[]");
};

/** /caption [prompt] - 生成图片描述 */
export const handleCaption: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const callback = ensureHostCallback(ctx.generateCaption, "caption");
  const parsedQuiet = parseBoolean(namedArgs.quiet, undefined);
  if (namedArgs.quiet !== undefined && parsedQuiet === undefined) {
    throw new Error(`/caption invalid quiet value: ${namedArgs.quiet}`);
  }
  const quiet = parsedQuiet ?? false;

  const mesId = parseNonNegativeInteger(namedArgs.mesId || namedArgs.id, "caption", "mesId");
  const index = parseNonNegativeInteger(namedArgs.index, "caption", "index") ?? 0;
  const prompt = resolveCommandText(args, pipe);

  const result = await Promise.resolve(callback({
    prompt: prompt || undefined,
    quiet,
    mesId,
    index,
  }));
  if (typeof result !== "string") {
    throw new Error("/caption host callback must return a string");
  }
  return result;
};

/** /beep - 播放消息提示音（别名 /ding） */
export const handleBeep: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const callback = ensureHostCallback(ctx.playNotificationSound, "beep");
  await Promise.resolve(callback());
  return "";
};
