/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                 Extension Command Handlers                              ║
 * ║                                                                          ║
 * ║  extension-* 命令：enable/disable/toggle/state/exists + translate/yt    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";

const TRUE_VALUES = new Set(["true", "1", "on"]);
const FALSE_VALUES = new Set(["false", "0", "off"]);

function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function parseStrictBoolean(
  raw: string | undefined,
  fallback: boolean,
  commandName: string,
  fieldName: string,
): boolean {
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  throw new Error(`/${commandName} invalid ${fieldName}: ${raw}`);
}

function resolveExtensionName(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
  commandName: string,
): string {
  const target = (namedArgs.name || args.join(" ") || pipe || "").trim();
  if (!target) {
    throw new Error(`/${commandName} requires extension name`);
  }
  return target;
}

function normalizeBooleanResult(
  value: unknown,
  commandName: string,
  fieldName: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`/${commandName} host returned non-boolean ${fieldName}`);
  }
  return value;
}

async function ensureInstalled(
  commandName: string,
  extensionName: string,
  callback: (extensionName: string) => boolean | Promise<boolean>,
): Promise<void> {
  const installed = normalizeBooleanResult(
    await Promise.resolve(callback(extensionName)),
    commandName,
    "installed state",
  );

  if (!installed) {
    throw new Error(`/${commandName} extension not installed: ${extensionName}`);
  }
}

async function resolveCurrentState(
  commandName: string,
  extensionName: string,
  callback: (extensionName: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  return normalizeBooleanResult(
    await Promise.resolve(callback(extensionName)),
    commandName,
    "enabled state",
  );
}

function normalizeSetResult(commandName: string, value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`/${commandName} host callback must return a string when provided`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveTranslateInput(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string {
  const input = (args.join(" ") || namedArgs.text || pipe || "").trim();
  if (!input) {
    throw new Error("/translate requires text");
  }
  return input;
}

function normalizeStringResult(commandName: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`/${commandName} host returned non-string result`);
  }
  return value;
}

function resolveYouTubeTarget(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string {
  const input = (args.join(" ") || namedArgs.url || pipe || "").trim();
  if (!input) {
    throw new Error("/yt-script requires YouTube URL or video ID");
  }
  return input;
}

async function applyExtensionState(
  commandName: string,
  extensionName: string,
  targetState: boolean,
  reload: boolean,
  ctx: Parameters<CommandHandler>[2],
): Promise<string> {
  const reloadPage = ctx.reloadPage;
  if (reload && !reloadPage) {
    throw new Error(`/${commandName} reload requested but /reload-page is not available in current context`);
  }

  const setState = ensureHostCallback(ctx.setExtensionEnabled, commandName);
  const normalizedName = normalizeSetResult(
    commandName,
    await Promise.resolve(setState(extensionName, targetState, { reload })),
  ) || extensionName;

  if (reload && reloadPage) {
    await Promise.resolve(reloadPage());
  }

  return normalizedName;
}

async function mutateExtension(
  commandName: "extension-enable" | "extension-disable" | "extension-toggle",
  args: string[],
  namedArgs: Record<string, string>,
  ctx: Parameters<CommandHandler>[2],
  pipe: string,
  desiredState?: boolean,
): Promise<string> {
  const existsCallback = ensureHostCallback(ctx.isExtensionInstalled, commandName);
  const stateCallback = ensureHostCallback(ctx.getExtensionEnabledState, commandName);

  const extensionName = resolveExtensionName(args, namedArgs, pipe, commandName);
  const reload = parseStrictBoolean(namedArgs.reload, false, commandName, "reload");

  await ensureInstalled(commandName, extensionName, existsCallback);
  const currentState = await resolveCurrentState(commandName, extensionName, stateCallback);
  const targetState = desiredState ?? !currentState;

  if (targetState === currentState) {
    return extensionName;
  }

  return applyExtensionState(commandName, extensionName, targetState, reload, ctx);
}

/** /extension-enable [name] - 启用扩展 */
export const handleExtensionEnable: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return mutateExtension("extension-enable", args, namedArgs, ctx, pipe, true);
};

/** /extension-disable [name] - 禁用扩展 */
export const handleExtensionDisable: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  return mutateExtension("extension-disable", args, namedArgs, ctx, pipe, false);
};

/** /extension-toggle [name] - 切换扩展启停（支持 state=true|false） */
export const handleExtensionToggle: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const explicitState = namedArgs.state === undefined
    ? undefined
    : parseStrictBoolean(namedArgs.state, false, "extension-toggle", "state");

  return mutateExtension("extension-toggle", args, namedArgs, ctx, pipe, explicitState);
};

/** /extension-state [name] - 查询扩展启用状态 */
export const handleExtensionState: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const existsCallback = ensureHostCallback(ctx.isExtensionInstalled, "extension-state");
  const stateCallback = ensureHostCallback(ctx.getExtensionEnabledState, "extension-state");

  const extensionName = resolveExtensionName(args, namedArgs, pipe, "extension-state");
  await ensureInstalled("extension-state", extensionName, existsCallback);
  const state = await resolveCurrentState("extension-state", extensionName, stateCallback);
  return String(state);
};

/** /extension-exists [name] - 查询扩展是否已安装（别名 /extension-installed） */
export const handleExtensionExists: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const existsCallback = ensureHostCallback(ctx.isExtensionInstalled, "extension-exists");
  const extensionName = resolveExtensionName(args, namedArgs, pipe, "extension-exists");
  const installed = normalizeBooleanResult(
    await Promise.resolve(existsCallback(extensionName)),
    "extension-exists",
    "installed state",
  );
  return String(installed);
};

/** /translate [target=<lang>] [provider=<name>] <text> - 调用宿主翻译文本 */
export const handleTranslate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const translateText = ensureHostCallback(ctx.translateText, "translate");
  const text = resolveTranslateInput(args, namedArgs, pipe);
  const translated = await Promise.resolve(translateText(text, {
    target: namedArgs.target?.trim() || undefined,
    provider: namedArgs.provider?.trim() || undefined,
  }));
  return normalizeStringResult("translate", translated);
};

/** /yt-script [lang=<iso6391>] <url|id> - 调用宿主抓取 YouTube transcript */
export const handleYouTubeScript: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const getYouTubeTranscript = ensureHostCallback(ctx.getYouTubeTranscript, "yt-script");
  const target = resolveYouTubeTarget(args, namedArgs, pipe);
  const transcript = await Promise.resolve(getYouTubeTranscript(target, {
    lang: namedArgs.lang?.trim() || undefined,
  }));
  return normalizeStringResult("yt-script", transcript);
};
