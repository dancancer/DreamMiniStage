/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Message Actions                                      ║
 * ║                                                                           ║
 * ║  消息添加和编辑 - 好品味：简单直接，职责单一                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage, DialogueState } from "../types";
import type { SendOptions } from "@/lib/slash-command/types";
import { DEFAULT_DIALOGUE_DATA } from "../types";
import { normalizeInsertIndex } from "../utils/helpers";

/* ═══════════════════════════════════════════════════════════════════════════
   添加用户消息（不触发生成）
   ═══════════════════════════════════════════════════════════════════════════ */

export function addUserMessage(
  dialogueKey: string,
  message: string | undefined | null,
  options: SendOptions | undefined,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey || message === undefined || message === null) return;

  const text = String(message);
  const messages = getState().dialogues[dialogueKey]?.messages || [];
  const targetIndex = normalizeInsertIndex(options?.at, messages.length);

  const userMessage: DialogueMessage = {
    id: Date.now().toString() + "-user",
    role: "user",
    content: text,
    name: options?.name,
    compact: options?.compact,
  };

  const nextMessages = [...messages];
  nextMessages.splice(targetIndex, 0, userMessage);

  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...(state.dialogues[dialogueKey] || { ...DEFAULT_DIALOGUE_DATA }),
        messages: nextMessages,
        openingLocked: true,
      },
    },
  }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   添加任意角色消息
   ═══════════════════════════════════════════════════════════════════════════ */

export function addRoleMessage(
  dialogueKey: string,
  role: string,
  message: string,
  options: SendOptions | undefined,
  getState: () => DialogueState,
  setState: (updater: (state: DialogueState) => Partial<DialogueState>) => void,
) {
  if (!dialogueKey || !message.trim()) return;

  const messages = getState().dialogues[dialogueKey]?.messages || [];
  const targetIndex = normalizeInsertIndex(options?.at, messages.length);
  const newMessage: DialogueMessage = {
    id: Date.now().toString() + "-" + role,
    role,
    content: message,
    name: options?.name,
    compact: options?.compact,
  };
  const nextMessages = [...messages];
  nextMessages.splice(targetIndex, 0, newMessage);

  setState((state: DialogueState) => ({
    dialogues: {
      ...state.dialogues,
      [dialogueKey]: {
        ...state.dialogues[dialogueKey],
        messages: nextMessages,
        openingLocked: true,
      },
    },
  }));
}
