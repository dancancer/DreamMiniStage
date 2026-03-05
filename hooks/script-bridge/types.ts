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
import type {
  AuthorNoteState,
  ButtonsCommandOptions,
  CaptionCommandOptions,
  CharacterSwitchResult,
  DataBankEntrySnapshot,
  DataBankSource,
  ExpressionClassifyOptions,
  ExpressionFolderOverrideOptions,
  ExpressionListOptions,
  ExpressionSetOptions,
  GroupMemberField,
  GroupMemberMoveDirection,
  ImageGenerationConfig,
  ImageGenerationOptions,
  InstructModePatch,
  InstructModeState,
  NarrateOptions,
  PersonaLockState,
  PersonaSetMode,
  PersonaLockType,
  SetModelOptions,
  SendOptions,
} from "@/lib/slash-command/types";

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
  onCloseChat?: () => void | Promise<void>;
  onGetChatName?: () => string | Promise<string>;
  onSetInput?: (text: string) => void | Promise<void>;
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
  onGetGroupMember?: (
    target: string,
    field: GroupMemberField,
  ) => string | number | undefined | Promise<string | number | undefined>;
  onGetGroupMemberCount?: () => number | Promise<number>;
  onAddGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onRemoveGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onMoveGroupMember?: (
    target: string,
    direction: GroupMemberMoveDirection,
  ) => string | number | void | Promise<string | number | void>;
  onPeekGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  onSetGroupMemberEnabled?: (
    target: string,
    enabled: boolean,
  ) => string | number | void | Promise<string | number | void>;
  onAddSwipe?: (
    text: string,
    options?: { switch?: boolean },
  ) => string | number | void | Promise<string | number | void>;
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
  onSyncPersona?: () => void | Promise<void>;
  onSetPersonaLock?: (
    state: PersonaLockState,
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;
  onGetPersonaLockState?: (
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;
  onReloadPage?: () => void | Promise<void>;
  onGetClipboardText?: () => string | Promise<string>;
  onSetClipboardText?: (text: string) => void | Promise<void>;
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
  onIsExtensionInstalled?: (
    extensionName: string,
  ) => boolean | Promise<boolean>;
  onGetExtensionEnabledState?: (
    extensionName: string,
  ) => boolean | Promise<boolean>;
  onSetExtensionEnabled?: (
    extensionName: string,
    enabled: boolean,
    options?: { reload?: boolean },
  ) => string | void | Promise<string | void>;
  onTogglePanels?: () => void | Promise<void>;
  onResetPanels?: () => void | Promise<void>;
  onToggleVisualNovelMode?: () => void | Promise<void>;
  onSetBackground?: (background?: string) => string | Promise<string>;
  onLockBackground?: () => void | Promise<void>;
  onUnlockBackground?: () => void | Promise<void>;
  onAutoBackground?: () => void | Promise<void>;
  onSetTheme?: (theme?: string) => string | Promise<string>;
  onSetMovingUiPreset?: (presetName: string) => string | Promise<string>;
  onSetCssVariable?: (args: { varName: string; value: string; target?: string }) => void | Promise<void>;
  onSetAverageBackgroundColor?: (
    color?: string,
  ) => string | Promise<string>;
  onSetChatDisplayMode?: (
    mode: "default" | "bubble" | "document",
  ) => void | Promise<void>;
  onShowButtonsPopup?: (
    text: string,
    labels: string[],
    options?: ButtonsCommandOptions,
  ) => string | string[] | Promise<string | string[]>;
  onGenerateCaption?: (
    options?: CaptionCommandOptions,
  ) => string | Promise<string>;
  onPlayNotificationSound?: () => void | Promise<void>;
  onSetExpression?: (
    label: string,
    options?: ExpressionSetOptions,
  ) => string | Promise<string>;
  onSetExpressionFolderOverride?: (
    folder: string,
    options?: ExpressionFolderOverrideOptions,
  ) => string | void | Promise<string | void>;
  onGetLastExpression?: (name?: string) => string | Promise<string>;
  onListExpressions?: (
    options?: ExpressionListOptions,
  ) => string[] | Promise<string[]>;
  onClassifyExpression?: (
    text: string,
    options?: ExpressionClassifyOptions,
  ) => string | Promise<string>;
  onJumpToMessage?: (index: number) => void | Promise<void>;
  onRenderChatMessages?: (
    count: number,
    options?: { scroll?: boolean },
  ) => void | Promise<void>;
  onSelectContextPreset?: (
    name?: string,
    options?: { quiet?: boolean },
  ) => string | Promise<string>;
  onSwitchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
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
