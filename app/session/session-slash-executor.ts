/**
 * @input  lib/quick-reply/store
 * @output createSessionSlashExecutor
 * @pos    /session story runtime 输入执行器
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Story Session Input Executor                         ║
 * ║                                                                           ║
 * ║  SAC-Phase 6a 后，/session 不再执行 slash script 或 script-bridge。          ║
 * ║  Quick Reply 只允许展开为普通用户输入；脚本控制流必须在导入编译期处理。        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { VisibleQuickReplyEntry } from "@/lib/quick-reply/store";

interface QuickReplyStoreLike {
  resolveVisibleQuickReply: (dialogueId: string | undefined, index: number) => VisibleQuickReplyEntry;
  activateContextSets: (dialogueId: string, reply: VisibleQuickReplyEntry["reply"]) => void;
}

interface CreateSessionSlashExecutorOptions extends Record<string, unknown> {
  sessionId?: string | null;
  dialogue: {
    addUserMessage: (text: string) => void | Promise<void>;
  };
  quickReplyStore: QuickReplyStoreLike;
  setUserInput: (text: string) => void;
}

export function createSessionSlashExecutor(options: CreateSessionSlashExecutorOptions) {
  return {
    executeQuickReplyByIndex: async (index: number): Promise<string> => {
      const entry = options.quickReplyStore.resolveVisibleQuickReply(options.sessionId || undefined, index);
      if (options.sessionId) {
        options.quickReplyStore.activateContextSets(options.sessionId, entry.reply);
      }

      return executeQuickReplyPayload(entry, {
        setUserInput: options.setUserInput,
        addUserMessage: options.dialogue.addUserMessage,
      });
    },
    executeSessionSlashInput: async (script: string): Promise<string> => {
      throw new Error(`Slash scripts are not supported in story runtime: ${script}`);
    },
  };
}

async function executeQuickReplyPayload(
  entry: VisibleQuickReplyEntry,
  actions: {
    setUserInput: (text: string) => void;
    addUserMessage: (text: string) => void | Promise<void>;
  },
): Promise<string> {
  const payload = entry.reply.message.trim();
  if (!payload) {
    return "";
  }

  if (payload.startsWith("/")) {
    throw new Error(`Slash scripts are not supported in story runtime: ${payload}`);
  }

  if (entry.set.nosend) {
    actions.setUserInput(payload);
    return payload;
  }

  await actions.addUserMessage(payload);
  return payload;
}
