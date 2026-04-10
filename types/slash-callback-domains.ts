/**
 * @input  lib/slash-command/types
 * @output 10 个域回调接口
 * @pos    Slash Command 域回调类型定义 — 消除 Data Clump 的核心抽象层
 * @update 一旦我被更新，务必更新我的开头注释
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Slash Command Domain Callback Interfaces                ║
 * ║                                                                           ║
 * ║  将 130+ 扁平回调按业务域分组为 10 个内聚接口，                              ║
 * ║  供 CharacterChatPanel / useScriptBridge / ApiCallContext 统一引用。        ║
 * ║  每个域对应 slash-context-adapter 中一个独立的功能区块。                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  CharacterSwitchResult,
  ExpressionClassifyOptions,
  ExpressionFolderOverrideOptions,
  ExpressionListOptions,
  ExpressionSetOptions,
  ExpressionUploadOptions,
  GroupMemberField,
  GroupMemberMoveDirection,
  ImportVariableMapping,
  PopupCommandOptions,
  QuickReplyContextOptions,
  QuickReplyCreateOptions,
  QuickReplyLookup,
  QuickReplySetOptions,
  QuickReplySetScope,
  QuickReplySetSnapshot,
  QuickReplySetVisibilityOptions,
  QuickReplySnapshot,
  QuickReplyUpdateOptions,
  ReasoningParseOptions,
  ReasoningParseResult,
  SendOptions,
  TranslateTextOptions,
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectState,
  YouTubeTranscriptOptions,
  ButtonsCommandOptions,
  CaptionCommandOptions,
} from "@/lib/slash-command/types";

// ============================================================================
//  1. 消息操作 — send / trigger / swipe 等核心消息行为
// ============================================================================

export interface MessageCallbacks {
  onSend?: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger?: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string, options?: SendOptions) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  onAddSwipe?: (
    text: string,
    options?: { switch?: boolean },
  ) => string | number | void | Promise<string | number | void>;
}

// ============================================================================
//  2. 会话管理 — 聊天生命周期、输入控制、隐藏/显示
// ============================================================================

export interface ChatManagementCallbacks {
  onCloseChat?: () => void | Promise<void>;
  onGetChatName?: () => string | Promise<string>;
  onRenameChat?: (name: string) => string | Promise<string>;
  onSetInput?: (text: string) => void | Promise<void>;
  onOpenTemporaryChat?: () => void | Promise<void>;
  onForceSaveChat?: () => void | Promise<void>;
  onHideMessages?: (startIndex: number) => void | Promise<void>;
  onUnhideMessages?: () => void | Promise<void>;
  onDuplicateCharacter?: () => string | void | Promise<string | void>;
  onNewChat?: (options?: { deleteCurrentChat?: boolean }) => void | Promise<void>;
}

// ============================================================================
//  3. 检查点/分支 — checkpoint CRUD 与分支导航
// ============================================================================

export interface CheckpointCallbacks {
  onCreateCheckpoint?: (messageId: string, requestedName?: string) => string | Promise<string>;
  onCreateBranch?: (messageId: string) => string | Promise<string>;
  onGetCheckpoint?: (messageId: string) => string | Promise<string>;
  onListCheckpoints?: (options?: { links?: boolean }) => Array<number | string> | Promise<Array<number | string>>;
  onGoCheckpoint?: (messageId: string) => string | Promise<string>;
  onExitCheckpoint?: () => string | Promise<string>;
  onGetCheckpointParent?: () => string | Promise<string>;
}

// ============================================================================
//  4. 群组成员 — 群聊角色的增删改查与启用状态
// ============================================================================

export interface GroupMemberCallbacks {
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
}

// ============================================================================
//  5. 快速回复 — set scope 管理、条目 CRUD、上下文绑定
// ============================================================================

export interface QuickReplyCallbacks {
  onExecuteQuickReplyByIndex?: (
    index: number,
  ) => string | number | void | Promise<string | number | void>;
  onToggleGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onAddGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onRemoveGlobalQuickReplySet?: (setName: string) => void | Promise<void>;
  onToggleChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onAddChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  onRemoveChatQuickReplySet?: (setName: string) => void | Promise<void>;
  onListQuickReplySets?: (
    scope?: QuickReplySetScope,
  ) => string[] | QuickReplySetSnapshot[] | Promise<string[] | QuickReplySetSnapshot[]>;
  onListQuickReplies?: (
    setName: string,
  ) => string[] | QuickReplySnapshot[] | Promise<string[] | QuickReplySnapshot[]>;
  onGetQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>;
  onCreateQuickReply?: (
    setName: string,
    label: string,
    message: string,
    options?: QuickReplyCreateOptions,
  ) => void | Promise<void>;
  onUpdateQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
    options?: QuickReplyUpdateOptions,
  ) => void | Promise<void>;
  onDeleteQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  onAddQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
    options?: QuickReplyContextOptions,
  ) => void | Promise<void>;
  onRemoveQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
  ) => void | Promise<void>;
  onClearQuickReplyContextSets?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  onCreateQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  onUpdateQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  onDeleteQuickReplySet?: (name: string) => void | Promise<void>;
}

// ============================================================================
//  6. 表情/精灵 — 角色表情系统操作
// ============================================================================

export interface ExpressionCallbacks {
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
  onUploadExpressionAsset?: (
    imageUrl: string,
    options: ExpressionUploadOptions,
  ) => string | Promise<string>;
}

// ============================================================================
//  7. 宿主能力 — 翻译、YouTube、剪贴板、扩展管理
// ============================================================================

export interface HostCapabilityCallbacks {
  onSelectProxyPreset?: (name?: string) => string | Promise<string>;
  onTranslateText?: (
    text: string,
    options?: TranslateTextOptions,
  ) => string | Promise<string>;
  onGetYouTubeTranscript?: (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ) => string | Promise<string>;
  onGetClipboardText?: () => string | Promise<string>;
  onSetClipboardText?: (text: string) => void | Promise<void>;
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
  onImportVariables?: (
    from: string,
    mappings: ImportVariableMapping[],
  ) => number | void | Promise<number | void>;
}

// ============================================================================
//  8. 世界信息 — 定时效果读写
// ============================================================================

export interface WorldInfoCallbacks {
  onGetWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    options?: { format?: WorldInfoTimedEffectFormat },
  ) => boolean | number | Promise<boolean | number>;
  onSetWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    state: WorldInfoTimedEffectState,
  ) => void | Promise<void>;
}

// ============================================================================
//  9. UI 操作 — 面板、主题、背景、弹窗、显示模式
// ============================================================================

export interface UICallbacks {
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
  onSetAverageBackgroundColor?: (color?: string) => string | Promise<string>;
  onSetChatDisplayMode?: (mode: "default" | "bubble" | "document") => void | Promise<void>;
  onShowButtonsPopup?: (
    text: string,
    labels: string[],
    options?: ButtonsCommandOptions,
  ) => string | string[] | Promise<string | string[]>;
  onShowPopup?: (
    text: string,
    options?: PopupCommandOptions,
  ) => string | number | null | undefined | Promise<string | number | null | undefined>;
  onPickIcon?: () => string | false | Promise<string | false>;
  onIsMobile?: () => boolean | Promise<boolean>;
  onGenerateCaption?: (options?: CaptionCommandOptions) => string | Promise<string>;
  onPlayNotificationSound?: () => void | Promise<void>;
}

// ============================================================================
//  10. 导航 — 消息跳转、角色切换、渲染控制
// ============================================================================

export interface NavigationCallbacks {
  onJumpToMessage?: (index: number) => void | Promise<void>;
  onRenderChatMessages?: (
    count: number,
    options?: { scroll?: boolean },
  ) => void | Promise<void>;
  onSwitchCharacter?: (
    target: string,
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
  onRenameCurrentCharacter?: (
    name: string,
    options?: { silent?: boolean; chats?: boolean },
  ) => string | Promise<string>;
  onSelectContextPreset?: (
    name?: string,
    options?: { quiet?: boolean },
  ) => string | Promise<string>;
  onParseReasoningBlock?: (
    input: string,
    options?: ReasoningParseOptions,
  ) => ReasoningParseResult | null | undefined | Promise<ReasoningParseResult | null | undefined>;
  onApplyReasoningRegex?: (reasoning: string) => string | Promise<string>;
  onListGallery?: (
    options?: { character?: string; group?: string },
  ) => string[] | Promise<string[]>;
  onShowGallery?: (
    options?: { character?: string; group?: string },
  ) => void | Promise<void>;
  onReloadPage?: () => void | Promise<void>;
}
