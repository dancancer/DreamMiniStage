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
