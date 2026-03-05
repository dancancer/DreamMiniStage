/**
 * @input  hooks/script-bridge/types
 * @output promptInjectionHandlers
 * @pos    注入提示词 Handlers - injectPrompts / uninjectPrompts 宿主闭环
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Prompt Injection Compatibility Handlers               ║
 * ║                                                                           ║
 * ║  目标：提供 injectPrompts / uninjectPrompts 的单路径能力                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiCallContext, ApiHandlerMap } from "./types";

type PromptRole = "system" | "assistant" | "user";
type PromptPosition = "in_chat" | "none";

interface InjectPromptPayload {
  id?: string;
  content?: string;
  role?: PromptRole;
  position?: PromptPosition;
  depth?: number;
  should_scan?: boolean;
}

interface PromptInjectionRecord {
  id: string;
  content: string;
  role: PromptRole;
  position: PromptPosition;
  depth: number;
  should_scan: boolean;
  createdAt: string;
}

interface InjectPromptOptions {
  once?: boolean;
}

const promptInjectionStore = new Map<string, PromptInjectionRecord>();

function createInjectionId(): string {
  return `inject_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensurePromptRole(value: unknown, index: number): PromptRole {
  if (value === undefined) {
    return "system";
  }
  if (value === "system" || value === "assistant" || value === "user") {
    return value;
  }
  throw new Error(`injectPrompts role at index ${index} must be system|assistant|user`);
}

function ensurePromptPosition(value: unknown, index: number): PromptPosition {
  if (value === undefined) {
    return "in_chat";
  }
  if (value === "in_chat" || value === "none") {
    return value;
  }
  throw new Error(`injectPrompts position at index ${index} must be in_chat|none`);
}

function ensurePromptDepth(value: unknown, index: number): number {
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`injectPrompts depth at index ${index} must be number`);
  }
  return Math.trunc(value);
}

function normalizeInjectPrompts(args: unknown[]): {
  prompts: PromptInjectionRecord[];
  once: boolean;
} {
  const [rawPrompts, rawOptions] = args as [unknown, InjectPromptOptions?];
  if (!Array.isArray(rawPrompts) || rawPrompts.length === 0) {
    throw new Error("injectPrompts requires non-empty prompt array");
  }

  if (
    rawOptions !== undefined &&
    (!rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions))
  ) {
    throw new Error("injectPrompts options must be object");
  }

  const once = Boolean(rawOptions?.once);
  const prompts = rawPrompts.map((rawPrompt, index) => {
    if (!rawPrompt || typeof rawPrompt !== "object" || Array.isArray(rawPrompt)) {
      throw new Error(`injectPrompts prompt at index ${index} must be object`);
    }
    const prompt = rawPrompt as InjectPromptPayload;
    if (typeof prompt.content !== "string") {
      throw new Error(`injectPrompts content at index ${index} must be string`);
    }

    return {
      id: typeof prompt.id === "string" && prompt.id.trim().length > 0
        ? prompt.id.trim()
        : createInjectionId(),
      content: prompt.content,
      role: ensurePromptRole(prompt.role, index),
      position: ensurePromptPosition(prompt.position, index),
      depth: ensurePromptDepth(prompt.depth, index),
      should_scan: typeof prompt.should_scan === "boolean" ? prompt.should_scan : false,
      createdAt: new Date().toISOString(),
    };
  });

  return { prompts, once };
}

function normalizePromptIds(args: unknown[]): string[] {
  const [rawIds] = args as [unknown];
  if (!Array.isArray(rawIds)) {
    throw new Error("uninjectPrompts requires id array");
  }
  const ids = rawIds.map((rawId) => {
    if (typeof rawId !== "string" || rawId.trim().length === 0) {
      throw new Error("uninjectPrompts id must be non-empty string");
    }
    return rawId.trim();
  });
  if (ids.length === 0) {
    throw new Error("uninjectPrompts requires at least one id");
  }
  return ids;
}

function injectPrompts(args: unknown[], ctx: ApiCallContext): string[] {
  const { prompts, once } = normalizeInjectPrompts(args);
  for (const prompt of prompts) {
    promptInjectionStore.set(prompt.id, prompt);
  }

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:injectPrompts", {
      detail: {
        prompts,
        once,
        characterId: ctx.characterId,
        dialogueId: ctx.dialogueId,
        iframeId: ctx.iframeId,
      },
    }),
  );

  return prompts.map((prompt) => prompt.id);
}

function uninjectPrompts(args: unknown[], ctx: ApiCallContext): number {
  const ids = normalizePromptIds(args);
  let removed = 0;
  for (const id of ids) {
    if (promptInjectionStore.delete(id)) {
      removed += 1;
    }
  }

  window.dispatchEvent(
    new CustomEvent("DreamMiniStage:uninjectPrompts", {
      detail: {
        ids,
        removed,
        characterId: ctx.characterId,
        dialogueId: ctx.dialogueId,
        iframeId: ctx.iframeId,
      },
    }),
  );

  return removed;
}

export const promptInjectionHandlers: ApiHandlerMap = {
  "injectPrompts": injectPrompts,
  "uninjectPrompts": uninjectPrompts,
};
