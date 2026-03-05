/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Profile & Prompt Command Handlers                      ║
 * ║                                                                          ║
 * ║  profile* + prompt/ppp 命令，统一单路径状态读写与 fail-fast 校验              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { ConnectionProfileState } from "../../types";
import { parseBoolean } from "../utils/helpers";
import { handleGetPromptEntry, handleSetPromptEntry } from "./generation";

const PROFILE_NONE_VALUE = "<None>";

function ensureHostCallback<T>(
  callback: T | undefined,
  commandName: string,
): T {
  if (!callback) {
    throw new Error(`/${commandName} is not available in current context`);
  }
  return callback;
}

function normalizeProfileName(raw: string, commandName: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    throw new Error(`/${commandName} requires profile name`);
  }
  return normalized;
}

function normalizeProfileSnapshot(
  commandName: string,
  value: unknown,
): ConnectionProfileState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`/${commandName} host returned invalid profile snapshot`);
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    throw new Error(`/${commandName} host returned invalid profile id`);
  }
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new Error(`/${commandName} host returned invalid profile name`);
  }

  return {
    ...raw,
    id: raw.id,
    name: raw.name,
  };
}

function normalizeProfileList(
  commandName: string,
  value: unknown,
): ConnectionProfileState[] {
  if (!Array.isArray(value)) {
    throw new Error(`/${commandName} host returned non-array profiles`);
  }

  return value.map((item) => normalizeProfileSnapshot(commandName, item));
}

function resolveProfileTarget(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string {
  return (args.join(" ") || namedArgs.name || pipe || "").trim();
}

function isProfileNoneToken(value: string): boolean {
  return value.trim().toLowerCase() === PROFILE_NONE_VALUE.toLowerCase();
}

function parseAwaitOption(raw: string | undefined): boolean {
  if (raw === undefined) {
    return true;
  }
  const parsed = parseBoolean(raw, undefined);
  if (parsed === undefined) {
    throw new Error(`/profile invalid await value: ${raw}`);
  }
  return parsed;
}

function parseTimeoutOption(raw: string | undefined): number {
  if (raw === undefined || raw.trim().length === 0) {
    return 2000;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`/profile invalid timeout value: ${raw}`);
  }
  return parsed;
}

function normalizePromptPostProcessingValue(
  args: string[],
  namedArgs: Record<string, string>,
  pipe: string,
): string {
  return (args[0] || namedArgs.value || pipe || "").trim().toLowerCase();
}

function normalizePromptPostProcessingResult(
  commandName: string,
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new Error(`/${commandName} host returned non-string value`);
  }
  return value;
}

/** /profile [name] - 读取或切换连接配置 */
export const handleProfile: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const target = resolveProfileTarget(args, namedArgs, pipe);

  if (!target) {
    const getCurrentProfileName = ensureHostCallback(ctx.getCurrentProfileName, "profile");
    const current = await Promise.resolve(getCurrentProfileName());
    if (current === null || current === undefined || current === "") {
      return PROFILE_NONE_VALUE;
    }
    if (typeof current !== "string") {
      throw new Error("/profile host returned non-string profile name");
    }
    return current;
  }

  const shouldAwait = parseAwaitOption(namedArgs.await);
  const timeout = parseTimeoutOption(namedArgs.timeout);
  const setCurrentProfileName = ensureHostCallback(ctx.setCurrentProfileName, "profile");
  const nextTarget = isProfileNoneToken(target) ? null : normalizeProfileName(target, "profile");
  const result = await Promise.resolve(setCurrentProfileName(nextTarget, {
    await: shouldAwait,
    timeout,
  }));

  if (result === null || result === undefined || result === "") {
    return nextTarget === null ? PROFILE_NONE_VALUE : "";
  }
  if (typeof result !== "string") {
    throw new Error("/profile host returned non-string profile name");
  }
  return result;
};

/** /profile-list - 返回连接配置名称列表 */
export const handleProfileList: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const listConnectionProfiles = ensureHostCallback(ctx.listConnectionProfiles, "profile-list");
  const profiles = normalizeProfileList(
    "profile-list",
    await Promise.resolve(listConnectionProfiles()),
  );
  return JSON.stringify(profiles.map((profile) => profile.name));
};

/** /profile-create <name> - 创建连接配置 */
export const handleProfileCreate: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const nextName = normalizeProfileName(
    resolveProfileTarget(args, namedArgs, pipe),
    "profile-create",
  );
  if (isProfileNoneToken(nextName)) {
    throw new Error("/profile-create invalid profile name: <None>");
  }

  const createConnectionProfile = ensureHostCallback(ctx.createConnectionProfile, "profile-create");
  const created = normalizeProfileSnapshot(
    "profile-create",
    await Promise.resolve(createConnectionProfile(nextName)),
  );
  return created.name;
};

/** /profile-update - 更新当前连接配置 */
export const handleProfileUpdate: CommandHandler = async (_args, _namedArgs, ctx, _pipe) => {
  const updateConnectionProfile = ensureHostCallback(ctx.updateConnectionProfile, "profile-update");
  const updated = normalizeProfileSnapshot(
    "profile-update",
    await Promise.resolve(updateConnectionProfile()),
  );
  return updated.name;
};

/** /profile-get [name] - 获取连接配置详情 */
export const handleProfileGet: CommandHandler = async (args, namedArgs, ctx, _pipe) => {
  const getConnectionProfile = ensureHostCallback(ctx.getConnectionProfile, "profile-get");
  const target = resolveProfileTarget(args, namedArgs, "");
  const profile = await Promise.resolve(
    getConnectionProfile(target ? normalizeProfileName(target, "profile-get") : undefined),
  );

  if (profile === null || profile === undefined) {
    return "";
  }

  return JSON.stringify(normalizeProfileSnapshot("profile-get", profile));
};

/** /prompt - 复用 prompt entry 命令通道（无 state 读取，有 state 写入） */
export const handlePrompt: CommandHandler = async (
  args,
  namedArgs,
  ctx,
  pipe,
  invocationMeta,
) => {
  const stateToken = (args[0] || namedArgs.state || pipe || "").trim();
  if (stateToken.length > 0) {
    return handleSetPromptEntry(args, namedArgs, ctx, pipe, invocationMeta);
  }
  return handleGetPromptEntry(args, namedArgs, ctx, pipe, invocationMeta);
};

/** /prompt-post-processing|/ppp [value] - 读取或设置 Prompt Post-Processing */
export const handlePromptPostProcessing: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const nextValue = normalizePromptPostProcessingValue(args, namedArgs, pipe);

  if (!nextValue) {
    const getPromptPostProcessing = ensureHostCallback(
      ctx.getPromptPostProcessing,
      "prompt-post-processing",
    );
    const current = normalizePromptPostProcessingResult(
      "prompt-post-processing",
      await Promise.resolve(getPromptPostProcessing()),
    );
    return current || "none";
  }

  const setPromptPostProcessing = ensureHostCallback(
    ctx.setPromptPostProcessing,
    "prompt-post-processing",
  );
  const normalizedValue = nextValue === "none" ? "" : nextValue;
  const updated = normalizePromptPostProcessingResult(
    "prompt-post-processing",
    await Promise.resolve(setPromptPostProcessing(normalizedValue)),
  );
  return updated;
};
