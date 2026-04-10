/**
 * @input  types/character-dialogue, types/slash-callback-domains, lib/slash-command/types
 * @output ApiCallContext, ApiHandler, ApiHandlerMap
 * @pos    脚本桥接类型定义 - Script Bridge 核心类型
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Bridge 类型定义                             ║
 * ║                                                                           ║
 * ║  穿透 UI 层的回调通过 10 个域接口引用 (slash-callback-domains)              ║
 * ║  仅 adapter 内部使用的回调保持扁平，避免向 UI 层泄露不必要的复杂度。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";
import type {
  AuthorNoteState,
  ConnectionProfileState,
  DataBankEntrySnapshot,
  DataBankSource,
  ImageGenerationConfig,
  ImageGenerationOptions,
  InstructModePatch,
  InstructModeState,
  NarrateOptions,
  PersonaLockState,
  PersonaSetMode,
  PersonaLockType,
  SetModelOptions,
} from "@/lib/slash-command/types";
import type { ScriptHostDebugResolvedPath, ScriptHostDebugState } from "./host-debug-state";
import type {
  MessageCallbacks,
  ChatManagementCallbacks,
  CheckpointCallbacks,
  GroupMemberCallbacks,
  QuickReplyCallbacks,
  ExpressionCallbacks,
  HostCapabilityCallbacks,
  WorldInfoCallbacks,
  UICallbacks,
  NavigationCallbacks,
} from "@/types/slash-callback-domains";

// ─── re-export 域接口，方便消费端直接从本文件引入 ───
export type {
  MessageCallbacks,
  ChatManagementCallbacks,
  CheckpointCallbacks,
  GroupMemberCallbacks,
  QuickReplyCallbacks,
  ExpressionCallbacks,
  HostCapabilityCallbacks,
  WorldInfoCallbacks,
  UICallbacks,
  NavigationCallbacks,
} from "@/types/slash-callback-domains";

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
  hostDebugState?: ScriptHostDebugState;
  hostCapabilitySources?: Partial<Record<
    "translation" | "youtubeTranscript" | "clipboardRead" | "clipboardWrite" | "extensionRead" | "extensionWrite" | "galleryList" | "galleryShow",
    Extract<ScriptHostDebugResolvedPath, "session-default" | "api-context">
  >>;
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

  // ─── 域回调分组 (穿透 UI 层) ───
  messageCallbacks?: MessageCallbacks;
  chatManagementCallbacks?: ChatManagementCallbacks;
  checkpointCallbacks?: CheckpointCallbacks;
  groupMemberCallbacks?: GroupMemberCallbacks;
  quickReplyCallbacks?: QuickReplyCallbacks;
  expressionCallbacks?: ExpressionCallbacks;
  hostCapabilityCallbacks?: HostCapabilityCallbacks;
  worldInfoCallbacks?: WorldInfoCallbacks;
  uiCallbacks?: UICallbacks;
  navigationCallbacks?: NavigationCallbacks;

  // ─── 仅 adapter 内部使用的回调 (不穿透 UI 层) ───
  onGenerateImage?: (
    prompt: string,
    options?: ImageGenerationOptions,
  ) => string | Promise<string>;
  onGetImageGenerationConfig?: () => ImageGenerationConfig | Promise<ImageGenerationConfig>;
  onSetImageGenerationConfig?: (
    patch: Partial<ImageGenerationConfig>,
  ) => ImageGenerationConfig | Promise<ImageGenerationConfig>;
  onGetInstructMode?: () => InstructModeState | Promise<InstructModeState>;
  onSetInstructMode?: (
    patch: InstructModePatch,
  ) => InstructModeState | Promise<InstructModeState>;
  onGetStopStrings?: () => string[] | Promise<string[]>;
  onSetStopStrings?: (stopStrings: string[]) => string[] | Promise<string[]>;
  onGetModel?: () => string | Promise<string>;
  onSetModel?: (
    model: string,
    options?: SetModelOptions,
  ) => string | Promise<string>;
  onNarrateText?: (
    text: string,
    options?: NarrateOptions,
  ) => void | Promise<void>;
  onAskCharacter?: (
    target: string,
    prompt: string,
    options?: { returnType?: "pipe" | "none" },
  ) => string | void | Promise<string | void>;
  onGetAuthorNoteState?: () => AuthorNoteState | Promise<AuthorNoteState>;
  onSetAuthorNoteState?: (
    patch: Partial<AuthorNoteState>,
  ) => AuthorNoteState | Promise<AuthorNoteState>;
  onGetPersonaName?: () => string | Promise<string>;
  onSetPersonaName?: (
    name: string,
    options?: { mode?: PersonaSetMode },
  ) => string | Promise<string>;
  onGetCurrentProfileName?: () => string | null | Promise<string | null>;
  onSetCurrentProfileName?: (
    name: string | null,
    options?: { await?: boolean; timeout?: number },
  ) => string | null | Promise<string | null>;
  onListConnectionProfiles?: () => ConnectionProfileState[] | Promise<ConnectionProfileState[]>;
  onCreateConnectionProfile?: (
    name: string,
  ) => ConnectionProfileState | Promise<ConnectionProfileState>;
  onUpdateConnectionProfile?: () => ConnectionProfileState | Promise<ConnectionProfileState>;
  onGetConnectionProfile?: (
    name?: string,
  ) => ConnectionProfileState | null | undefined | Promise<ConnectionProfileState | null | undefined>;
  onGetPromptPostProcessing?: () => string | Promise<string>;
  onSetPromptPostProcessing?: (value: string) => string | Promise<string>;
  onSyncPersona?: () => void | Promise<void>;
  onSetPersonaLock?: (
    state: PersonaLockState,
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;
  onGetPersonaLockState?: (
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;
  onOpenDataBank?: () => void | Promise<void>;
  onListDataBankEntries?: (
    options?: { source?: DataBankSource },
  ) => DataBankEntrySnapshot[] | Promise<DataBankEntrySnapshot[]>;
  onGetDataBankText?: (
    target: string,
    options?: { source?: DataBankSource },
  ) => string | Promise<string>;
  onAddDataBankText?: (
    content: string,
    options?: { source?: DataBankSource; name?: string },
  ) => string | Promise<string>;
  onUpdateDataBankText?: (
    target: string,
    content: string,
    options?: { source?: DataBankSource },
  ) => string | void | Promise<string | void>;
  onDeleteDataBankEntry?: (
    target: string,
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  onSetDataBankEntryEnabled?: (
    target: string,
    enabled: boolean,
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  onIngestDataBank?: (
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  onPurgeDataBank?: (
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  onSearchDataBank?: (
    query: string,
    options?: {
      source?: DataBankSource;
      threshold?: number;
      count?: number;
      returnType?: "urls" | "chunks";
    },
  ) => string[] | string | Promise<string[] | string>;
  onRemovePromptInjections?: (id?: string) => number | Promise<number>;
}

// ============================================================================
//                              Handler 类型
// ============================================================================

export type ApiHandler = (
  args: unknown[],
  context: ApiCallContext
) => Promise<unknown> | unknown;

export type ApiHandlerMap = Record<string, ApiHandler>;
