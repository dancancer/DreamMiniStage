/**
 * @input  (none)
 * @output DialogueMessage, OpeningMessage, OpeningPayload, Character, LLMType, LLMConfig, UseCharacterDialogueOptions, UseCharacterDialogueReturn
 * @pos    类型定义层 - 角色对话核心类型：消息、开场白、LLM 配置、Hook 接口
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character Dialogue Type Defs                          ║
 * ║  角色对话相关的共享类型：消息、开场白、LLM 配置、Hook 返回值                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export interface DialogueMessage {
  id: string;
  role: string;
  thinkingContent?: string;
  content: string;
  name?: string;
  hidden?: boolean;
  compact?: boolean;
  swipe?: { activeIndex: number; total: number };
}

export interface OpeningMessage {
  id: string;
  content: string;
  fullContent?: string;
}

export interface OpeningPayload {
  id: string;
  content: string;
  fullContent: string;
}

export interface Character {
  id: string;
  name: string;
  personality?: string;
  avatar_path?: string;
  extensions?: any;
}

export type LLMType = "openai" | "ollama" | "gemini";

export interface LLMConfig {
  llmType: LLMType;
  modelName: string;
  baseUrl: string;
  apiKey: string;
}

export interface UseCharacterDialogueOptions {
  characterId: string | null;
  onError?: (message: string) => void;
  t: (key: string) => string;
}

export interface UseCharacterDialogueReturn {
  messages: DialogueMessage[];
  openingMessages: OpeningMessage[];
  openingIndex: number;
  openingLocked: boolean;
  suggestedInputs: string[];
  isSending: boolean;
  setMessages: React.Dispatch<React.SetStateAction<DialogueMessage[]>>;
  setSuggestedInputs: React.Dispatch<React.SetStateAction<string[]>>;
  fetchLatestDialogue: () => Promise<void>;
  initializeNewDialogue: (charId: string) => Promise<void>;
  handleSendMessage: (message: string) => Promise<void>;
  addUserMessage: (message: string, options?: { at?: number; name?: string; compact?: boolean; returnType?: string }) => void;
  addRoleMessage: (role: string, message: string) => void;
  triggerGeneration: () => Promise<void>;
  truncateMessagesAfter: (nodeId: string) => Promise<void>;
  handleRegenerate: (nodeId: string) => Promise<void>;
  handleSwipe: (target?: string) => Promise<void>;
  handleOpeningNavigate: (direction: "prev" | "next") => Promise<void>;
  exportJsonl: () => Promise<void>;
  importJsonl: (file: File) => Promise<void>;
  readLlmConfig: () => LLMConfig;
}
