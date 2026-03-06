/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  System Message Shared Helpers                           ║
 * ║                                                                          ║
 * ║  sysprompt/sysname/sys/sysgen 共享存储与发送单路径                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { ExecutionContext, SendOptions } from "../../types";

const SYSPROMPT_NAME_STORAGE_KEY = "dreamministage.sysprompt.name";
const SYSPROMPT_ENABLED_STORAGE_KEY = "dreamministage.sysprompt.enabled";
const SYSTEM_NARRATOR_NAME_STORAGE_KEY = "dreamministage.system-narrator.name";

export const DEFAULT_SYSTEM_NARRATOR_NAME = "System";

export interface StoredSystemPromptState {
  enabled: boolean;
  name: string;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readSystemPromptStateFromStorage(): StoredSystemPromptState {
  if (!hasStorage()) {
    return { enabled: false, name: "" };
  }

  try {
    return {
      enabled: window.localStorage.getItem(SYSPROMPT_ENABLED_STORAGE_KEY) === "true",
      name: window.localStorage.getItem(SYSPROMPT_NAME_STORAGE_KEY) || "",
    };
  } catch {
    return { enabled: false, name: "" };
  }
}

export function writeSystemPromptStateToStorage(
  patch: Partial<StoredSystemPromptState>,
): StoredSystemPromptState {
  const current = readSystemPromptStateFromStorage();
  const next: StoredSystemPromptState = {
    enabled: patch.enabled ?? current.enabled,
    name: typeof patch.name === "string" ? patch.name.trim() : current.name,
  };

  if (!hasStorage()) {
    return next;
  }

  try {
    window.localStorage.setItem(SYSPROMPT_ENABLED_STORAGE_KEY, String(next.enabled));
    if (next.name) {
      window.localStorage.setItem(SYSPROMPT_NAME_STORAGE_KEY, next.name);
    } else {
      window.localStorage.removeItem(SYSPROMPT_NAME_STORAGE_KEY);
    }
  } catch {
    // 忽略存储失败，调用方仍拿到规范化快照
  }

  return next;
}

export function readSystemNarratorNameFromStorage(): string {
  if (!hasStorage()) {
    return "";
  }

  try {
    return (window.localStorage.getItem(SYSTEM_NARRATOR_NAME_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function writeSystemNarratorNameToStorage(name: string): string {
  const normalized = name.trim();
  if (!hasStorage()) {
    return normalized;
  }

  try {
    if (normalized) {
      window.localStorage.setItem(SYSTEM_NARRATOR_NAME_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(SYSTEM_NARRATOR_NAME_STORAGE_KEY);
    }
  } catch {
    // 忽略存储失败，调用方仍拿到规范化结果
  }

  return normalized;
}

function hasSystemSendOptions(options: SendOptions | undefined): boolean {
  return options?.at !== undefined || options?.name !== undefined || options?.compact !== undefined;
}

export async function emitSystemMessage(
  ctx: ExecutionContext,
  text: string,
  options?: SendOptions,
): Promise<void> {
  if (ctx.onSendSystem) {
    if (hasSystemSendOptions(options)) {
      await Promise.resolve(ctx.onSendSystem(text, options));
      return;
    }

    await Promise.resolve(ctx.onSendSystem(text));
    return;
  }

  if (hasSystemSendOptions(options)) {
    await Promise.resolve(ctx.onSend(`[SYS] ${text}`, options));
    return;
  }

  await Promise.resolve(ctx.onSend(`[SYS] ${text}`));
}
