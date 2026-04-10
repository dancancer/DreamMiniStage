/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     TavernHelper API 实现                                  ║
 * ║                                                                            ║
 * ║  为沙箱脚本提供与主应用交互的 API                                            ║
 * ║  设计原则：简洁、类型安全、无特殊情况                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ScriptContext } from "@/types/script-runner";
import {
  createVariableAPIs,
  createPresetAPIs,
  createWorldbookAPIs,
  createToolAPIs,
} from "./tavern-helper-context";

// ── 类型重新导出（保持现有消费者导入路径不变） ──────────────────────────
export type {
  ScriptVariableValue,
  EventListener,
  GenerationResult,
  PresetData,
  WorldBookEntry,
} from "./tavern-helper-context";

import type {
  ScriptVariableValue,
  EventListener,
  GenerationResult,
  PresetData,
  WorldBookEntry,
} from "./tavern-helper-context";

/* ═══════════════════════════════════════════════════════════════════════════
   TavernHelperAPI 接口
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TavernHelperAPI {
  getChatMessages: (options?: { count?: number; fromEnd?: boolean }) => Array<{ role: string; content: string; id?: number }>;
  createChatMessages: (messages: Array<{ role: string; content: string }>) => Promise<void>;
  getCurrentMessageId: () => string | null;
  generate: (config?: { quiet?: boolean; systemPrompt?: string }) => Promise<GenerationResult>;
  generateRaw: (config: { messages: Array<{ role: string; content: string }>; model?: string; temperature?: number }) => Promise<GenerationResult>;
  stopGenerationById: (id: string) => void;
  stopAllGeneration: () => void;
  eventOn: (type: string, listener: EventListener) => { stop: () => void };
  eventEmit: (type: string, ...data: unknown[]) => unknown;
  eventOnce: (type: string, listener: EventListener) => Promise<unknown>;
  eventMakeFirst: (type: string, listener: EventListener) => { stop: () => void };
  eventMakeLast: (type: string, listener: EventListener) => { stop: () => void };
  eventClearAll: () => void;
  getVariables: (options?: { scope?: string; includeGlobal?: boolean }) => Record<string, ScriptVariableValue>;
  replaceVariables: (vars: Record<string, ScriptVariableValue>, options?: { scope?: string }) => void;
  getAllVariables: () => Record<string, ScriptVariableValue>;
  getPreset: (name?: string) => PresetData | null;
  loadPreset: (name: string) => Promise<void>;
  getWorldbookNames: () => string[];
  createWorldbookEntries: (entries: WorldBookEntry[]) => Promise<void>;
  triggerSlash: (command: string) => Promise<unknown>;
  substitudeMacros: (text: string) => string;
  _cleanup: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TavernHelper 工厂函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建 TavernHelper 实例
 *
 * 每个脚本执行上下文都有独立的 TavernHelper 实例
 * 脚本结束时自动清理事件监听器和资源
 */
export function createTavernHelper(
  scriptId: string,
  context: ScriptContext,
): TavernHelperAPI {
  const cleanupFns: Array<() => void> = [];

  const getSessionKey = (): string => {
    return context.sessionId || context.characterId || "global";
  };

  const getEventEmitter = () => {
    try {
      const { eventEmitter } = require("@/lib/events");
      return eventEmitter;
    } catch {
      return null;
    }
  };

  const getDialogueStore = () => {
    try {
      const { dialogueStore } = require("@/lib/store/dialogue-store/index");
      return dialogueStore;
    } catch {
      return null;
    }
  };

  // 组装上下文相关 API
  const variableAPIs = createVariableAPIs(getSessionKey);
  const presetAPIs = createPresetAPIs();
  const worldbookAPIs = createWorldbookAPIs(getSessionKey);
  const toolAPIs = createToolAPIs(getSessionKey, context);

  return {
    /* ─────────────────────────────────────────────────────────────────────
       消息管理 API
       ───────────────────────────────────────────────────────────────────── */

    getChatMessages: (options = {}) => {
      const store = getDialogueStore();
      if (!store) return [];

      const state = store.getState();
      const sessionKey = getSessionKey();
      const dialogueState = state.dialogues[sessionKey];
      if (!dialogueState) return [];

      let messages = dialogueState.messages || [];
      if (options.count) {
        messages = options.fromEnd
          ? messages.slice(-options.count)
          : messages.slice(0, options.count);
      }

      return messages.map((msg: { role: string; content: string }, idx: number) => ({
        role: msg.role,
        content: msg.content,
        id: idx,
      }));
    },

    createChatMessages: async (messages) => {
      const store = getDialogueStore();
      if (!store) return;

      const state = store.getState();
      const sessionKey = getSessionKey();

      for (const msg of messages) {
        if (msg.role === "user") {
          state.addUserMessage(sessionKey, msg.content);
        } else if (msg.role === "assistant") {
          state.addRoleMessage(sessionKey, "assistant", msg.content);
        } else {
          state.addRoleMessage(sessionKey, msg.role, msg.content);
        }
      }
    },

    getCurrentMessageId: () => {
      const store = getDialogueStore();
      if (!store) return null;

      const state = store.getState();
      const sessionKey = getSessionKey();
      const dialogueState = state.dialogues[sessionKey];
      if (!dialogueState?.messages?.length) return null;

      return String(dialogueState.messages.length - 1);
    },

    /* ─────────────────────────────────────────────────────────────────────
       生成控制 API
       ───────────────────────────────────────────────────────────────────── */

    generate: async (config = {}) => {
      const store = getDialogueStore();
      if (!store) return { success: false, error: "DialogueStore not available" };

      const state = store.getState();
      const sessionKey = getSessionKey();
      const characterId = context.characterId || sessionKey;

      const params = {
        dialogueKey: sessionKey,
        characterId,
        language: (context.language as "zh" | "en") || "zh",
        modelName: context.modelName || "gpt-4",
        baseUrl: context.baseUrl || "",
        apiKey: context.apiKey || "",
        llmType: (context.llmType as "openai" | "ollama" | "gemini") || "openai",
        responseLength: context.responseLength || 2000,
        fastModel: context.fastModel || false,
      };

      if (config.quiet) {
        await state.triggerGeneration(params);
      } else {
        const lastUserMsg = state.dialogues[sessionKey]?.messages
          ?.slice().reverse()
          .find((m: { role: string }) => m.role === "user");
        if (lastUserMsg) {
          await state.triggerGeneration(params);
        }
      }

      return { success: true };
    },

    generateRaw: async () => {
      throw new Error(
        "generateRaw not yet implemented. " +
        "This requires direct LLM API call bypassing preset system.",
      );
    },

    stopGenerationById: (id) => {
      console.warn("stopGenerationById not yet implemented:", id);
    },

    stopAllGeneration: () => {
      console.warn("stopAllGeneration not yet implemented");
    },

    /* ─────────────────────────────────────────────────────────────────────
       事件系统 API
       ───────────────────────────────────────────────────────────────────── */

    eventOn: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) return { stop: () => {} };
      const unsubscribe = emitter.on(type, listener);
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventEmit: (type, ...data) => {
      const emitter = getEventEmitter();
      if (!emitter) return data[0] ?? null;
      emitter.emit(type, ...data);
      return data[0] ?? null;
    },

    eventOnce: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) return Promise.resolve(null);
      return new Promise((resolve) => {
        const unsubscribe = emitter.once(type, (...args: unknown[]) => {
          listener(...args);
          resolve(args[0]);
        });
        cleanupFns.push(unsubscribe);
      });
    },

    eventMakeFirst: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) return { stop: () => {} };
      const unsubscribe = emitter.on(type, listener, { priority: 1000 });
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventMakeLast: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) return { stop: () => {} };
      const unsubscribe = emitter.on(type, listener, { priority: -1000 });
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventClearAll: () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
    },

    /* ─────────────────────────────────────────────────────────────────────
       上下文相关 API（委托给子模块）
       ───────────────────────────────────────────────────────────────────── */

    ...variableAPIs,
    ...presetAPIs,
    ...worldbookAPIs,
    ...toolAPIs,

    /* ─────────────────────────────────────────────────────────────────────
       清理方法
       ───────────────────────────────────────────────────────────────────── */

    _cleanup: () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default createTavernHelper;
