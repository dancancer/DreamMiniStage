/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  System Message Shared Helpers                           ║
 * ║                                                                          ║
 * ║  sysprompt/sysname/sys/sysgen 共享存储与发送单路径                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { ExecutionContext, SendOptions } from "../../types";
import {
  getPromptSyspromptState,
  setPromptSyspromptState,
} from "@/lib/prompt-config/service";

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
  const current = getPromptSyspromptState();
  return {
    enabled: current.enabled,
    name: current.name,
  };
}

export function writeSystemPromptStateToStorage(
  patch: Partial<StoredSystemPromptState>,
): StoredSystemPromptState {
  const next = setPromptSyspromptState({
    enabled: patch.enabled,
    name: patch.name,
  });

  return {
    enabled: next.enabled,
    name: next.name,
  };
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
