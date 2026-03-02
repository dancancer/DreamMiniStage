/**
 * @input  hooks/script-bridge/types, lib/slash-command/registry
 * @output quickReplyHandlers
 * @pos    Quick Reply Handlers - SillyTavern 快捷回复到 Slash Command 的映射
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Quick Reply Handlers                               ║
 * ║                                                                            ║
 * ║  映射 SillyTavern Quick Reply API 到 Slash Command 系统                   ║
 * ║  设计：复用现有命令基础设施，提供兼容层                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import { getRegisteredCommands, registerCommand } from "@/lib/slash-command/registry/index";
import type { CommandHandler } from "@/lib/slash-command/types";

// ============================================================================
//                              Quick Reply 类型
// ============================================================================

interface QuickReplyEntry {
  label: string;
  message: string;
  title?: string;
  hidden?: boolean;
  automationId?: string;
}

interface QuickReplySet {
  name: string;
  enabled: boolean;
  entries: QuickReplyEntry[];
}

// ============================================================================
//                              内部存储
// ============================================================================

/**
 * Quick Reply 集合存储
 * 映射集合名 → 条目列表
 */
const quickReplySets = new Map<string, QuickReplySet>();

// ============================================================================
//                              Handler 实现
// ============================================================================

export const quickReplyHandlers: ApiHandlerMap = {
  /**
   * getQuickReplySetNames - 获取所有 Quick Reply 集合名称
   */
  "getQuickReplySetNames": (_args: unknown[], _ctx: ApiCallContext): string[] => {
    return Array.from(quickReplySets.keys());
  },

  /**
   * getQuickReplySet - 获取指定集合
   */
  "getQuickReplySet": (args: unknown[], _ctx: ApiCallContext): QuickReplySet | null => {
    const [setName] = args as [string];
    return quickReplySets.get(setName) || null;
  },

  /**
   * createQuickReplySet - 创建 Quick Reply 集合
   * 实际上注册为 Slash Commands
   */
  "createQuickReplySet": (args: unknown[], _ctx: ApiCallContext): QuickReplySet | null => {
    const [setName, definition] = args as [string, Partial<QuickReplySet>];
    if (!setName) return null;

    const set: QuickReplySet = {
      name: setName,
      enabled: definition.enabled ?? true,
      entries: definition.entries || [],
    };

    // 为每个条目注册对应的 Slash Command
    for (const entry of set.entries) {
      if (!entry.label) continue;

      const handler: CommandHandler = async (_cmdArgs, _namedArgs, _execCtx, pipe) => {
        // 返回条目的消息内容
        return entry.message || pipe;
      };

      registerCommand(entry.label, handler);
    }

    quickReplySets.set(setName, set);
    console.log("[createQuickReplySet] Created:", setName, "entries:", set.entries.length);
    return set;
  },

  /**
   * deleteQuickReplySet - 删除 Quick Reply 集合
   */
  "deleteQuickReplySet": (args: unknown[], _ctx: ApiCallContext): boolean => {
    const [setName] = args as [string];
    const deleted = quickReplySets.delete(setName);
    if (deleted) {
      console.log("[deleteQuickReplySet] Deleted:", setName);
    }
    return deleted;
  },

  /**
   * updateQuickReplySet - 更新 Quick Reply 集合
   */
  "updateQuickReplySet": (args: unknown[], _ctx: ApiCallContext): boolean => {
    const [setName, updates] = args as [string, Partial<QuickReplySet>];
    const existing = quickReplySets.get(setName);
    if (!existing) return false;

    // 更新字段
    if (updates.enabled !== undefined) existing.enabled = updates.enabled;
    if (updates.entries) {
      existing.entries = updates.entries;
      // 重新注册命令
      for (const entry of existing.entries) {
        if (!entry.label) continue;
        const handler: CommandHandler = async (_cmdArgs, _namedArgs, _execCtx, pipe) => {
          return entry.message || pipe;
        };
        registerCommand(entry.label, handler);
      }
    }

    quickReplySets.set(setName, existing);
    return true;
  },

  /**
   * executeQuickReply - 执行 Quick Reply
   * 已在 slash-runner-shim.js 中映射到 triggerSlash
   * 这里提供服务端实现以供直接调用
   */
  "executeQuickReply": async (args: unknown[], ctx: ApiCallContext): Promise<string> => {
    const [setName, label] = args as [string, string];
    const set = quickReplySets.get(setName);
    if (!set || !set.enabled) return "";

    const entry = set.entries.find((e) => e.label === label);
    if (!entry) return "";

    // 执行对应的消息
    return entry.message || "";
  },
};
