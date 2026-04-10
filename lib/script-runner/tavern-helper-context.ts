/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                TavernHelper 上下文相关 API 实现                             ║
 * ║                                                                            ║
 * ║  从 tavern-helper.ts 拆分而来                                              ║
 * ║  包含：变量管理、预设管理、世界书管理、工具方法、清理                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ScriptContext } from "@/types/script-runner";
import { useMvuStore } from "@/lib/mvu/data/store";
import type { MvuData } from "@/lib/mvu/types";

/* ═══════════════════════════════════════════════════════════════════════════
   共享类型定义
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

/* ═══════════════════════════════════════════════════════════════════════════
   变量管理 API 工厂
   ═══════════════════════════════════════════════════════════════════════════ */

export function createVariableAPIs(
  getSessionKey: () => string,
) {
  return {
    getVariables: (options: { scope?: string; includeGlobal?: boolean } = {}) => {
      const sessionKey = getSessionKey();
      const mvuStore = useMvuStore.getState();

      const variables = mvuStore.getVariables(sessionKey);
      if (!variables) {
        return {};
      }

      // 返回 stat_data（当前变量状态）
      return (variables as { stat_data?: Record<string, ScriptVariableValue> }).stat_data || {};
    },

    replaceVariables: (vars: Record<string, ScriptVariableValue>, options: { scope?: string } = {}) => {
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
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   预设管理 API 工厂
   ═══════════════════════════════════════════════════════════════════════════ */

export function createPresetAPIs() {
  return {
    getPreset: (name?: string) => {
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

    loadPreset: async (name: string) => {
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
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   世界书管理 API 工厂
   ═══════════════════════════════════════════════════════════════════════════ */

export function createWorldbookAPIs(
  getSessionKey: () => string,
) {
  return {
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

    createWorldbookEntries: async (entries: Array<{ keys: string[]; content: string; comment?: string; enabled?: boolean; [key: string]: unknown }>) => {
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
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具方法 API 工厂
   ═══════════════════════════════════════════════════════════════════════════ */

export function createToolAPIs(
  getSessionKey: () => string,
  context: ScriptContext,
) {
  return {
    triggerSlash: async (command: string) => {
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

    substitudeMacros: (text: string) => {
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
  };
}
