/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                         Dialogue Store                                    ║
 * ║                                                                           ║
 * ║  对话状态的全局管理 - 好品味：职责清晰，模块化设计                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { create } from "zustand";
import type {
  DialogueState,
  DialogueMessage,
  InitDialogueParams,
  SendMessageParams,
  TriggerGenerationParams,
  RegenerateParams,
} from "./types";
import type { SendOptions } from "@/lib/slash-command/types";
import { DEFAULT_DIALOGUE_DATA } from "./types";

// 导入 actions
import * as LifecycleActions from "./actions/lifecycle-actions";
import * as MessageActions from "./actions/message-actions";
import * as GenerationActions from "./actions/generation-actions";
import * as NavigationActions from "./actions/navigation-actions";

/* ═══════════════════════════════════════════════════════════════════════════
   导出类型
   ═══════════════════════════════════════════════════════════════════════════ */

export type { DialogueMessage, OpeningMessage } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   Store 实现 - 好品味：薄层封装，逻辑在 actions 中
   ═══════════════════════════════════════════════════════════════════════════ */

export const useDialogueStore = create<DialogueState>((set, get) => ({
  // ========== 初始状态 ==========
  dialogues: {},

  // ========== 生命周期操作 ==========
  fetchLatestDialogue: async (dialogueKey, characterId, language) => {
    await LifecycleActions.fetchLatestDialogue(dialogueKey, characterId, language, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  initializeNewDialogue: async (params: InitDialogueParams) => {
    await LifecycleActions.initializeNewDialogue(params, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  // ========== 消息操作 ==========
  sendMessage: async (params: SendMessageParams) => {
    await GenerationActions.sendMessage(params, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  addUserMessage: (dialogueKey: string, message: string, options?: SendOptions) => {
    MessageActions.addUserMessage(dialogueKey, message, options, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  addRoleMessage: (dialogueKey: string, role: string, message: string, options?: SendOptions) => {
    MessageActions.addRoleMessage(dialogueKey, role, message, options, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  // ========== 生成操作 ==========
  triggerGeneration: async (params: TriggerGenerationParams) => {
    await GenerationActions.triggerGeneration(params, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  regenerateMessage: async (
    dialogueKey: string,
    characterId: string,
    nodeId: string,
    params: RegenerateParams,
  ) => {
    await GenerationActions.regenerateMessage(dialogueKey, characterId, nodeId, params, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  // ========== 导航操作 ==========
  truncateMessagesAfter: async (dialogueKey: string, nodeId: string) => {
    await NavigationActions.truncateMessagesAfter(dialogueKey, nodeId, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  navigateOpening: async (dialogueKey: string, direction: "prev" | "next") => {
    await NavigationActions.navigateOpening(dialogueKey, direction, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  switchSwipe: async (dialogueKey: string, messageId: string, target: "prev" | "next" | number) => {
    await NavigationActions.switchSwipe(dialogueKey, messageId, target, get, set as (updater: (state: DialogueState) => Partial<DialogueState>) => void);
  },

  // ========== 简单操作 - 好品味：直接状态更新，无需提取 ==========
  setMessages: (dialogueKey: string, messages: DialogueMessage[]) => {
    set((state) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: {
          ...(state.dialogues[dialogueKey] || DEFAULT_DIALOGUE_DATA),
          messages,
        },
      },
    }));
  },

  setSuggestedInputs: (dialogueKey: string, inputs: string[]) => {
    set((state) => ({
      dialogues: {
        ...state.dialogues,
        [dialogueKey]: {
          ...(state.dialogues[dialogueKey] || DEFAULT_DIALOGUE_DATA),
          suggestedInputs: inputs,
        },
      },
    }));
  },

  clearDialogue: (dialogueKey: string) => {
    set((state) => {
      const newDialogues = { ...state.dialogues };
      delete newDialogues[dialogueKey];
      return { dialogues: newDialogues };
    });
  },

  // ========== 查询 ==========
  getDialogue: (dialogueKey: string) => {
    return get().dialogues[dialogueKey];
  },
}));
