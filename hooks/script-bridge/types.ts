/**
 * @input  types/character-dialogue, lib/slash-command/types
 * @output ApiCallContext, ApiHandler, ApiHandlerMap
 * @pos    脚本桥接类型定义 - Script Bridge 核心类型
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Bridge 类型定义                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";
import type { SendOptions } from "@/lib/slash-command/types";

// ============================================================================
//                              API Handler 上下文
// ============================================================================

export interface ApiCallContext {
  characterId?: string;
  dialogueId?: string;
  chatId?: string;
  messageId?: string;
  presetName?: string;
  messages: DialogueMessage[];
  // ─── iframe 标识 ───
  iframeId?: string;
  // ─── iframe 消息派发 ───
  dispatchToIframe?: (
    iframeId: string,
    type: string,
    payload: unknown
  ) => void;
  setScriptVariable: (
    key: string,
    value: unknown,
    scope: "global" | "character",
    id?: string
  ) => void;
  deleteScriptVariable: (
    key: string,
    scope?: "global" | "character",
    id?: string
  ) => void;
  getVariablesSnapshot: () => {
    global: Record<string, unknown>;
    character: Record<string, Record<string, unknown>>;
  };
  // ─── Slash Command 回调 ───
  onSend?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger?: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  onSwitchCharacter?: (target: string) => void | Promise<void>;
}

// ============================================================================
//                              Handler 类型
// ============================================================================

export type ApiHandler = (
  args: unknown[],
  context: ApiCallContext
) => Promise<unknown> | unknown;

export type ApiHandlerMap = Record<string, ApiHandler>;
