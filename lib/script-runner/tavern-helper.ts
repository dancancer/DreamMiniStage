/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     TavernHelper API 实现                                  ║
 * ║                                                                            ║
 * ║  为沙箱脚本提供与主应用交互的 API                                            ║
 * ║  设计原则：简洁、类型安全、无特殊情况                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ScriptContext } from "@/types/script-runner";
import type { Unsubscribe } from "@/lib/events/types";
import { useMvuStore } from "@/lib/mvu/data/store";
import type { MvuData } from "@/lib/mvu/types";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 脚本变量值类型（支持嵌套）
 */
export type ScriptVariableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ScriptVariableValue[]
  | { [key: string]: ScriptVariableValue };

/**
 * 事件监听器函数签名
 */
export type EventListener = (...args: unknown[]) => void | Promise<void>;

/**
 * 生成结果类型
 */
export interface GenerationResult {
  success: boolean;
  error?: string;
  content?: string;
}

/**
 * 预设数据类型
 */
export interface PresetData {
  id: string;
  name: string;
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * 世界书条目类型
 */
export interface WorldBookEntry {
  keys: string[];
  content: string;
  comment?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface TavernHelperAPI {
  // ────────────────────────────────────────────────────────────────────────
  // 消息管理
  // ────────────────────────────────────────────────────────────────────────
  getChatMessages: (options?: {
    count?: number;
    fromEnd?: boolean;
  }) => Array<{ role: string; content: string; id?: number }>;

  createChatMessages: (messages: Array<{
    role: string;
    content: string;
  }>) => Promise<void>;

  getCurrentMessageId: () => string | null;

  // ────────────────────────────────────────────────────────────────────────
  // 生成控制
  // ────────────────────────────────────────────────────────────────────────
  generate: (config?: {
    quiet?: boolean;
    systemPrompt?: string;
  }) => Promise<GenerationResult>;

  generateRaw: (config: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
  }) => Promise<GenerationResult>;

  stopGenerationById: (id: string) => void;
  stopAllGeneration: () => void;

  // ────────────────────────────────────────────────────────────────────────
  // 事件系统
  // ────────────────────────────────────────────────────────────────────────
  eventOn: (type: string, listener: EventListener) => { stop: () => void };
  eventEmit: (type: string, ...data: unknown[]) => unknown;
  eventOnce: (type: string, listener: EventListener) => Promise<unknown>;
  eventMakeFirst: (type: string, listener: EventListener) => { stop: () => void };
  eventMakeLast: (type: string, listener: EventListener) => { stop: () => void };
  eventClearAll: () => void;

  // ────────────────────────────────────────────────────────────────────────
  // 变量管理
  // ────────────────────────────────────────────────────────────────────────
  getVariables: (options?: { scope?: string; includeGlobal?: boolean }) => Record<string, ScriptVariableValue>;
  replaceVariables: (vars: Record<string, ScriptVariableValue>, options?: { scope?: string }) => void;
  getAllVariables: () => Record<string, ScriptVariableValue>;

  // ────────────────────────────────────────────────────────────────────────
  // 预设管理
  // ────────────────────────────────────────────────────────────────────────
  getPreset: (name?: string) => PresetData | null;
  loadPreset: (name: string) => Promise<void>;

  // ────────────────────────────────────────────────────────────────────────
  // 世界书管理
  // ────────────────────────────────────────────────────────────────────────
  getWorldbookNames: () => string[];
  createWorldbookEntries: (entries: WorldBookEntry[]) => Promise<void>;

  // ────────────────────────────────────────────────────────────────────────
  // 工具方法
  // ────────────────────────────────────────────────────────────────────────
  triggerSlash: (command: string) => Promise<unknown>;
  substitudeMacros: (text: string) => string;

  // ────────────────────────────────────────────────────────────────────────
  // 内部清理（脚本结束时自动调用）
  // ────────────────────────────────────────────────────────────────────────
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
  // ═══════════════════════════════════════════════════════════════════════
  // 清理函数列表
  // ═══════════════════════════════════════════════════════════════════════
  const cleanupFns: Array<() => void> = [];

  // ═══════════════════════════════════════════════════════════════════════
  // 辅助函数：获取当前 sessionKey
  // ═══════════════════════════════════════════════════════════════════════
  const getSessionKey = (): string => {
    return context.sessionId || context.characterId || "global";
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 辅助函数：安全获取 eventEmitter
  // ═══════════════════════════════════════════════════════════════════════
  const getEventEmitter = () => {
    try {
      const { eventEmitter } = require("@/lib/events");
      return eventEmitter;
    } catch {
      // 测试环境或模块未加载时的fallback
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 辅助函数：安全获取 dialogueStore
  // ═══════════════════════════════════════════════════════════════════════
  const getDialogueStore = () => {
    try {
      const { dialogueStore } = require("@/lib/store/dialogue-store/index");
      return dialogueStore;
    } catch {
      // 测试环境或模块未加载时的fallback
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // API 实现
  // ═══════════════════════════════════════════════════════════════════════

  return {
    /* ─────────────────────────────────────────────────────────────────────
       消息管理 API
       ───────────────────────────────────────────────────────────────────── */

    getChatMessages: (options = {}) => {
      const store = getDialogueStore();
      if (!store) {
        return [];  // 测试环境fallback
      }

      const state = store.getState();
      const sessionKey = getSessionKey();

      const dialogueState = state.dialogues[sessionKey];
      if (!dialogueState) {
        return [];
      }

      let messages = dialogueState.messages || [];

      // 应用过滤选项
      if (options.count) {
        messages = options.fromEnd
          ? messages.slice(-options.count)
          : messages.slice(0, options.count);
      }

      // 转换为标准格式
      return messages.map((msg: { role: string; content: string }, idx: number) => ({
        role: msg.role,
        content: msg.content,
        id: idx,
      }));
    },

    createChatMessages: async (messages) => {
      const store = getDialogueStore();
      if (!store) {
        return;  // 测试环境fallback
      }

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
      if (!store) {
        return null;  // 测试环境fallback
      }

      const state = store.getState();
      const sessionKey = getSessionKey();

      const dialogueState = state.dialogues[sessionKey];
      if (!dialogueState || !dialogueState.messages) {
        return null;
      }

      const messages = dialogueState.messages;
      if (messages.length === 0) {
        return null;
      }

      // 返回最后一条消息的 ID（简化实现，使用索引）
      return String(messages.length - 1);
    },

    /* ─────────────────────────────────────────────────────────────────────
       生成控制 API
       ───────────────────────────────────────────────────────────────────── */

    generate: async (config = {}) => {
      const store = getDialogueStore();
      if (!store) {
        return { success: false, error: "DialogueStore not available" };  // 测试环境fallback
      }

      const state = store.getState();
      const sessionKey = getSessionKey();

      // 从 context 获取生成参数
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

      // 如果 quiet 模式，只触发生成不添加用户消息
      if (config.quiet) {
        await state.triggerGeneration(params);
      } else {
        // 正常流程：发送消息并生成
        const lastUserMsg = state.dialogues[sessionKey]?.messages
          ?.slice()
          .reverse()
          .find((m: { role: string }) => m.role === "user");

        if (lastUserMsg) {
          await state.triggerGeneration(params);
        }
      }

      return { success: true };
    },

    generateRaw: async (config) => {
      // 原始生成暂未实现，抛出错误提示
      throw new Error(
        "generateRaw not yet implemented. " +
        "This requires direct LLM API call bypassing preset system.",
      );
    },

    stopGenerationById: (id) => {
      // 停止特定生成任务
      console.warn("stopGenerationById not yet implemented:", id);
    },

    stopAllGeneration: () => {
      // 停止所有生成任务
      console.warn("stopAllGeneration not yet implemented");
    },

    /* ─────────────────────────────────────────────────────────────────────
       事件系统 API
       ───────────────────────────────────────────────────────────────────── */

    eventOn: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) {
        // 测试环境fallback
        return { stop: () => {} };
      }
      const unsubscribe = emitter.on(type, listener);
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventEmit: (type, ...data) => {
      const emitter = getEventEmitter();
      if (!emitter) {
        return data[0] ?? null;  // 测试环境fallback
      }
      emitter.emit(type, ...data);
      return data[0] ?? null;
    },

    eventOnce: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) {
        // 测试环境fallback
        return Promise.resolve(null);
      }
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
      if (!emitter) {
        return { stop: () => {} };  // 测试环境fallback
      }
      const unsubscribe = emitter.on(type, listener, { priority: 1000 });
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventMakeLast: (type, listener) => {
      const emitter = getEventEmitter();
      if (!emitter) {
        return { stop: () => {} };  // 测试环境fallback
      }
      const unsubscribe = emitter.on(type, listener, { priority: -1000 });
      cleanupFns.push(unsubscribe);
      return { stop: unsubscribe };
    },

    eventClearAll: () => {
      // 清理当前脚本注册的所有事件
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
    },

    /* ─────────────────────────────────────────────────────────────────────
       变量管理 API
       ───────────────────────────────────────────────────────────────────── */

    getVariables: (options = {}) => {
      const sessionKey = getSessionKey();
      const mvuStore = useMvuStore.getState();

      const variables = mvuStore.getVariables(sessionKey);
      if (!variables) {
        return {};
      }

      // 返回 stat_data（当前变量状态）
      return (variables as { stat_data?: Record<string, ScriptVariableValue> }).stat_data || {};
    },

    replaceVariables: (vars, options = {}) => {
      const sessionKey = getSessionKey();
      const mvuStore = useMvuStore.getState();

      // 批量更新变量
      const updates = Object.entries(vars).map(([path, value]) => ({
        path,
        value,
        reason: "TavernHelper.replaceVariables",
      }));

      mvuStore.setVariables(sessionKey, updates);
    },

    getAllVariables: () => {
      const sessionKey = getSessionKey();
      const mvuStore = useMvuStore.getState();

      const variables = mvuStore.getVariables(sessionKey);
      if (!variables) {
        return {};
      }

      // 返回所有变量（stat_data + display_data）
      return {
        ...variables.stat_data,
        _display: variables.display_data,
        _delta: variables.delta_data,
      };
    },

    /* ─────────────────────────────────────────────────────────────────────
       预设管理 API
       ───────────────────────────────────────────────────────────────────── */

    getPreset: (name) => {
      try {
        const { PresetOperations } = require("@/lib/data/roleplay/preset-operation");

        // 同步 API 但内部是异步操作，使用 Promise 包装
        PresetOperations.getAllPresets().then((presets: PresetData[]) => {
          if (!name) {
            // 无名称时返回当前激活的预设
            const active = presets.find(p => p.enabled === true);
            return active || null;
          }
          // 按名称查找
          const found = presets.find(p => p.name === name);
          return found || null;
        }).catch(() => null);

        // 临时返回 null（真正结果在 Promise 中）
        return null;
      } catch {
        return null;
      }
    },

    loadPreset: async (name) => {
      try {
        const { PresetOperations } = require("@/lib/data/roleplay/preset-operation");

        const presets = await PresetOperations.getAllPresets();
        const target = presets.find((p: PresetData) => p.name === name);

        if (!target) {
          console.warn(`Preset not found: ${name}`);
          return;
        }

        // 禁用所有其他预设
        for (const preset of presets) {
          if (preset.id !== target.id && preset.enabled) {
            await PresetOperations.updatePreset(preset.id, { enabled: false });
          }
        }

        // 激活目标预设
        await PresetOperations.updatePreset(target.id, { enabled: true });
      } catch (err) {
        console.error("loadPreset failed:", err);
      }
    },

    /* ─────────────────────────────────────────────────────────────────────
       世界书管理 API
       ───────────────────────────────────────────────────────────────────── */

    getWorldbookNames: () => {
      try {
        const { WorldBookOperations } = require("@/lib/data/roleplay/world-book-operation");

        // 异步获取世界书列表，但 API 是同步的
        // 返回一个 Promise（SillyTavern 兼容性限制）
        WorldBookOperations.getWorldBooks().then((books: Record<string, unknown>) => {
          return Object.keys(books).filter(key => !key.endsWith("_settings"));
        }).catch(() => []);

        // 临时返回空数组
        return [];
      } catch {
        return [];
      }
    },

    createWorldbookEntries: async (entries) => {
      try {
        const { WorldBookOperations } = require("@/lib/data/roleplay/world-book-operation");
        const sessionKey = getSessionKey();

        // 遍历并创建每个条目
        for (const entry of entries) {
          await WorldBookOperations.addWorldBookEntry(sessionKey, entry);
        }
      } catch (err) {
        console.error("createWorldbookEntries failed:", err);
      }
    },

    /* ─────────────────────────────────────────────────────────────────────
       工具方法 API
       ───────────────────────────────────────────────────────────────────── */

    triggerSlash: async (command) => {
      try {
        const { executeSlashCommandScript, createMinimalContext } = require("@/lib/slash-command/executor");
        const sessionKey = getSessionKey();
        const mvuStore = useMvuStore.getState();

        // 创建执行上下文
        const executionContext = createMinimalContext({
          characterId: context.characterId,
          getVariable: (key: string) => {
            const variables = mvuStore.getVariables(sessionKey);
            return variables?.stat_data?.[key];
          },
          setVariable: (key: string, value: ScriptVariableValue) => {
            mvuStore.setVariables(sessionKey, [{
              path: key,
              value,
              reason: "TavernHelper.triggerSlash",
            }]);
          },
          deleteVariable: (key: string) => {
            mvuStore.setVariables(sessionKey, [{
              path: key,
              value: undefined,
              reason: "TavernHelper.triggerSlash (delete)",
            }]);
          },
        });

        // 执行斜杠命令
        const result = await executeSlashCommandScript(command, executionContext);

        if (result.isError) {
          console.error("Slash command error:", result.errorMessage);
          return null;
        }

        return result.pipe || null;
      } catch (err) {
        console.error("triggerSlash failed:", err);
        return null;
      }
    },

    substitudeMacros: (text) => {
      try {
        const { evaluateMacros } = require("@/lib/core/st-macro-evaluator");
        const sessionKey = getSessionKey();
        const mvuStore = useMvuStore.getState();

        // 构建宏环境
        const variables = mvuStore.getVariables(sessionKey);
        const statData = ((variables as MvuData | null)?.stat_data ?? {}) as Record<string, ScriptVariableValue>;
        const macroEnv = {
          // 从 context 提取环境变量
          user: context.characterId || "User",
          char: context.characterId || "Character",
          ...statData,
          // 可以添加更多环境变量
        };

        // 执行宏替换
        return evaluateMacros(text, macroEnv);
      } catch (err) {
        console.error("substitudeMacros failed:", err);
        return text;
      }
    },

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
