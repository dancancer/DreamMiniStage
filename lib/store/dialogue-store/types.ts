/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Dialogue Store Types                                 ║
 * ║                                                                           ║
 * ║  类型定义集中管理 - 好品味：类型与实现分离                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage, OpeningMessage, OpeningPayload } from "@/types/character-dialogue";
import type { SendOptions } from "@/lib/slash-command/types";

/* ═══════════════════════════════════════════════════════════════════════════
   导出核心类型
   ═══════════════════════════════════════════════════════════════════════════ */

export type { DialogueMessage, OpeningMessage, OpeningPayload } from "@/types/character-dialogue";

/* ═══════════════════════════════════════════════════════════════════════════
   对话状态结构
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DialogueData {
  messages: DialogueMessage[];
  openingMessages: OpeningMessage[];
  openingIndex: number;
  openingLocked: boolean;
  suggestedInputs: string[];
  isSending: boolean;
  pendingOpening?: OpeningPayload;
}

/* ═══════════════════════════════════════════════════════════════════════════
   操作参数类型
   ═══════════════════════════════════════════════════════════════════════════ */

export interface LLMConfig {
  language: "zh" | "en";
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
  responseLength: number;
  fastModel: boolean;
}

export interface InitDialogueParams extends LLMConfig {
  dialogueKey: string;
  characterId: string;
}

export interface SendMessageParams extends LLMConfig {
  dialogueKey: string;
  characterId: string;
  message: string;
  onError?: (message: string) => void;
}

export interface TriggerGenerationParams extends LLMConfig {
  dialogueKey: string;
  characterId: string;
  onError?: (message: string) => void;
}

export interface RegenerateParams extends LLMConfig {
  onError?: (message: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Store State 定义
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DialogueState {
  // ========== 状态 ==========
  dialogues: Record<string, DialogueData>;

  // ========== 生命周期操作 ==========
  fetchLatestDialogue: (
    dialogueKey: string,
    characterId: string,
    language: "zh" | "en"
  ) => Promise<void>;

  initializeNewDialogue: (params: InitDialogueParams) => Promise<void>;

  // ========== 消息操作 ==========
  sendMessage: (params: SendMessageParams) => Promise<void>;
  addUserMessage: (dialogueKey: string, message: string, options?: SendOptions) => void;
  addRoleMessage: (dialogueKey: string, role: string, message: string) => void;

  // ========== 生成操作 ==========
  triggerGeneration: (params: TriggerGenerationParams) => Promise<void>;
  regenerateMessage: (
    dialogueKey: string,
    characterId: string,
    nodeId: string,
    params: RegenerateParams
  ) => Promise<void>;

  // ========== Swipe 操作 ==========
  switchSwipe: (
    dialogueKey: string,
    messageId: string,
    target: "prev" | "next" | number
  ) => Promise<void>;

  // ========== 导航操作 ==========
  navigateOpening: (dialogueKey: string, direction: "prev" | "next") => Promise<void>;
  truncateMessagesAfter: (dialogueKey: string, nodeId: string) => Promise<void>;

  // ========== 简单操作 ==========
  setMessages: (dialogueKey: string, messages: DialogueMessage[]) => void;
  setSuggestedInputs: (dialogueKey: string, inputs: string[]) => void;
  clearDialogue: (dialogueKey: string) => void;
  getDialogue: (dialogueKey: string) => DialogueData | undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
   默认状态
   ═══════════════════════════════════════════════════════════════════════════ */

export const DEFAULT_DIALOGUE_DATA: DialogueData = {
  messages: [],
  openingMessages: [],
  openingIndex: 0,
  openingLocked: false,
  suggestedInputs: [],
  isSending: false,
  pendingOpening: undefined,
};
