/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  Slash Command 执行上下文 / 命令处理器类型                   ║
 * ║                                                                            ║
 * ║  ExecutionContext 定义所有命令可调用的宿主能力                               ║
 * ║  注: ExecutionContext 是单一接口，体量由宿主 API 面积决定                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";
import type { CommandInvocationMeta, CommandScope } from "./parsing";

import type {
  SendOptions,
  AuthorNoteState,
  ConnectionProfileState,
  ReasoningParseOptions,
  ReasoningParseResult,
  QuickReplyLookup,
  QuickReplyCreateOptions,
  QuickReplyUpdateOptions,
  QuickReplyContextOptions,
  QuickReplySetOptions,
  QuickReplySetVisibilityOptions,
  QuickReplySetScope,
  ImageGenerationOptions,
  ImageGenerationConfig,
  InstructModeState,
  InstructModePatch,
  SetModelOptions,
  NarrateOptions,
  TranslateTextOptions,
  YouTubeTranscriptOptions,
  WorldInfoTimedEffectName,
  WorldInfoTimedEffectFormat,
  WorldInfoTimedEffectState,
  GenerateOptions,
  GenerateRawOptions,
  InjectOptions,
  ListGalleryOptions,
  ActivateLoreOptions,
  AudioOptions,
  PersonaSetMode,
  PersonaLockType,
  PersonaLockState,
  DataBankSource,
  ExpressionSetOptions,
  ExpressionFolderOverrideOptions,
  ExpressionListOptions,
  ExpressionClassifyOptions,
  ExpressionUploadOptions,
  CaptionCommandOptions,
  ButtonsCommandOptions,
  PopupCommandOptions,
  CharacterTagCommandOptions,
  ImportVariableMapping,
} from "./options";

import type {
  CharacterSummary,
  CharacterSwitchResult,
  LorebookBindings,
  PromptEntryState,
  PromptEntryStateUpdate,
  PromptInjectionState,
  DataBankEntrySnapshot,
  SlashToolDefinition,
  SlashToolRegistration,
  QuickReplySnapshot,
  QuickReplySetSnapshot,
  PresetInfo,
  RegexScriptInfo,
  AudioChannelType,
  AudioChannelSnapshot,
  VariableScope,
  WorldBookEntryData,
  GroupMemberField,
  GroupMemberMoveDirection,
} from "./entities";

// ============================================================================
//                              执行上下文类型
// ============================================================================

/** 命令执行所需的上下文 */
export interface ExecutionContext {
  characterId?: string;
  dialogueId?: string;
  messages: DialogueMessage[];
  onSend: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string, options?: SendOptions) => void | Promise<void>;
  onImpersonate?: (text: string) => void | Promise<void>;
  onContinue?: () => void | Promise<void>;
  onSwipe?: (target?: string) => void | Promise<void>;
  openChatManager?: () => void | Promise<void>;
  reloadCurrentChat?: () => void | Promise<void>;
  getVariable: (key: string) => unknown;
  setVariable: (key: string, value: unknown) => void;
  deleteVariable: (key: string) => void;
  listVariables?: () => string[];
  flushVariables?: () => void;
  dumpVariables?: () => Record<string, unknown>;
  getScopedVariable?: (scope: VariableScope, key: string) => unknown;
  setScopedVariable?: (scope: VariableScope, key: string, value: unknown) => void;
  deleteScopedVariable?: (scope: VariableScope, key: string) => void;
  listScopedVariables?: (scope: VariableScope) => string[];
  dumpScopedVariables?: (scope: VariableScope) => Record<string, unknown>;

  // 扩展操作 - 消息管理
  getMessage?: (index: number) => DialogueMessage | undefined;
  editMessage?: (index: number, content: string) => void | Promise<void>;
  deleteMessage?: (index: number) => void | Promise<void>;
  getMessageCount?: () => number;
  setMessageRole?: (index: number, role: "user" | "assistant" | "system") => void | Promise<void>;
  setMessageName?: (index: number, name: string) => void | Promise<void>;
  getMessageReasoning?: (index: number) => string | undefined | Promise<string | undefined>;
  setMessageReasoning?: (
    index: number,
    reasoning: string,
    options?: { collapse?: boolean },
  ) => void | Promise<void>;
  parseReasoningBlock?: (
    input: string,
    options?: ReasoningParseOptions,
  ) => ReasoningParseResult | null | undefined | Promise<ReasoningParseResult | null | undefined>;
  applyReasoningRegex?: (reasoning: string) => string | Promise<string>;
  deleteCurrentChat?: () => void | Promise<void>;
  closeCurrentChat?: () => void | Promise<void>;
  deleteMessagesByName?: (name: string) => number | Promise<number>;
  deleteSwipe?: (swipeId?: number) => string | number | void | Promise<string | number | void>;
  getGroupMember?: (
    target: string,
    field: GroupMemberField,
  ) => string | number | undefined | Promise<string | number | undefined>;
  getGroupMemberCount?: () => number | Promise<number>;
  addGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  removeGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  moveGroupMember?: (
    target: string,
    direction: GroupMemberMoveDirection,
  ) => string | number | void | Promise<string | number | void>;
  peekGroupMember?: (
    target: string,
  ) => string | number | void | Promise<string | number | void>;
  setGroupMemberEnabled?: (
    target: string,
    enabled: boolean,
  ) => string | number | void | Promise<string | number | void>;
  addSwipe?: (
    text: string,
    options?: { switch?: boolean },
  ) => string | number | void | Promise<string | number | void>;
  executeQuickReplyByIndex?: (
    index: number,
  ) => string | number | void | Promise<string | number | void>;
  toggleGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  addGlobalQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  removeGlobalQuickReplySet?: (setName: string) => void | Promise<void>;
  toggleChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  addChatQuickReplySet?: (
    setName: string,
    options?: QuickReplySetVisibilityOptions,
  ) => void | Promise<void>;
  removeChatQuickReplySet?: (setName: string) => void | Promise<void>;
  listQuickReplySets?: (
    scope?: QuickReplySetScope,
  ) => string[] | QuickReplySetSnapshot[] | Promise<string[] | QuickReplySetSnapshot[]>;
  listQuickReplies?: (
    setName: string,
  ) => string[] | QuickReplySnapshot[] | Promise<string[] | QuickReplySnapshot[]>;
  getQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>;
  createQuickReply?: (
    setName: string,
    label: string,
    message: string,
    options?: QuickReplyCreateOptions,
  ) => void | Promise<void>;
  updateQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
    options?: QuickReplyUpdateOptions,
  ) => void | Promise<void>;
  deleteQuickReply?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  addQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
    options?: QuickReplyContextOptions,
  ) => void | Promise<void>;
  removeQuickReplyContextSet?: (
    setName: string,
    target: QuickReplyLookup,
    contextSetName: string,
  ) => void | Promise<void>;
  clearQuickReplyContextSets?: (
    setName: string,
    target: QuickReplyLookup,
  ) => void | Promise<void>;
  createQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  updateQuickReplySet?: (
    name: string,
    options?: QuickReplySetOptions,
  ) => void | Promise<void>;
  deleteQuickReplySet?: (name: string) => void | Promise<void>;
  getCurrentChatName?: () => string | Promise<string>;
  renameCurrentChat?: (name: string) => string | Promise<string>;
  setInputText?: (text: string) => void | Promise<void>;
  openTemporaryChat?: () => void | Promise<void>;
  forceSaveChat?: () => void | Promise<void>;
  hideMessages?: (startIndex: number) => void | Promise<void>;
  unhideMessages?: () => void | Promise<void>;
  createCheckpoint?: (messageId: string, requestedName?: string) => string | Promise<string>;
  createBranch?: (messageId: string) => string | Promise<string>;
  getCheckpoint?: (messageId: string) => string | Promise<string>;
  listCheckpoints?: (options?: { links?: boolean }) => Array<number | string> | Promise<Array<number | string>>;
  goCheckpoint?: (messageId: string) => string | Promise<string>;
  exitCheckpoint?: () => string | Promise<string>;
  getCheckpointParent?: () => string | Promise<string>;
  getCurrentCharacter?: () => CharacterSummary | undefined | Promise<CharacterSummary | undefined>;
  renameCurrentCharacter?: (
    name: string,
    options?: { silent?: boolean; chats?: boolean },
  ) => string | Promise<string>;
  listCharacters?: () => CharacterSummary[] | Promise<CharacterSummary[]>;
  switchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;
  duplicateCharacter?: () => string | void | Promise<string | void>;
  createNewChat?: (options?: { deleteCurrentChat?: boolean }) => void | Promise<void>;
  askCharacter?: (
    target: string,
    prompt: string,
    options?: { returnType?: "pipe" | "none" },
  ) => string | void | Promise<string | void>;
  getAuthorNoteState?: () => AuthorNoteState | Promise<AuthorNoteState>;
  setAuthorNoteState?: (
    patch: Partial<AuthorNoteState>,
  ) => AuthorNoteState | Promise<AuthorNoteState>;
  getPersonaName?: () => string | Promise<string>;
  setPersonaName?: (
    name: string,
    options?: { mode?: PersonaSetMode },
  ) => string | Promise<string>;
  getCurrentProfileName?: () => string | null | Promise<string | null>;
  setCurrentProfileName?: (
    name: string | null,
    options?: { await?: boolean; timeout?: number },
  ) => string | null | Promise<string | null>;
  listConnectionProfiles?: () => ConnectionProfileState[] | Promise<ConnectionProfileState[]>;
  createConnectionProfile?: (
    name: string,
  ) => ConnectionProfileState | Promise<ConnectionProfileState>;
  updateConnectionProfile?: () => ConnectionProfileState | Promise<ConnectionProfileState>;
  getConnectionProfile?: (
    name?: string,
  ) => ConnectionProfileState | null | undefined | Promise<ConnectionProfileState | null | undefined>;
  getPromptPostProcessing?: () => string | Promise<string>;
  setPromptPostProcessing?: (value: string) => string | Promise<string>;
  syncPersona?: () => void | Promise<void>;
  getPersonaLockState?: (
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;

  // 扩展操作 - World Book
  getWorldBookEntry?: (id: string) => WorldBookEntryData | undefined | Promise<WorldBookEntryData | undefined>;
  searchWorldBook?: (query: string) => WorldBookEntryData[] | Promise<WorldBookEntryData[]>;
  setWorldBookEntry?: (id: string, data: Partial<WorldBookEntryData>) => void | Promise<void>;
  createWorldBookEntry?: (
    data: Partial<WorldBookEntryData>,
    bookName?: string,
  ) => WorldBookEntryData | Promise<WorldBookEntryData | undefined>;
  deleteWorldBookEntry?: (id: string) => void | Promise<void>;
  activateWorldBookEntry?: (id: string) => void | Promise<void>;
  listWorldBookEntries?: (bookName?: string) => WorldBookEntryData[] | Promise<WorldBookEntryData[]>;
  getGlobalLorebooks?: () => string[] | Promise<string[]>;
  setGlobalLorebooks?: (bookNames: string[]) => void | Promise<void>;
  getCharLorebooks?: (target?: string) => LorebookBindings | Promise<LorebookBindings>;
  getChatLorebook?: () => string | null | Promise<string | null>;
  getPersonaLorebook?: () => string | null | Promise<string | null>;
  getLoreField?: (
    file: string,
    uid: string,
    field: string,
  ) => unknown | Promise<unknown>;
  setLoreField?: (
    file: string,
    uid: string,
    field: string,
    value: string,
  ) => void | Promise<void>;
  getWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    options?: { format?: WorldInfoTimedEffectFormat },
  ) => boolean | number | Promise<boolean | number>;
  setWorldInfoTimedEffect?: (
    file: string,
    uid: string,
    effect: WorldInfoTimedEffectName,
    state: WorldInfoTimedEffectState,
  ) => void | Promise<void>;

  // 扩展操作 - 生成
  generateImage?: (
    prompt: string,
    options?: ImageGenerationOptions,
  ) => string | Promise<string>;
  getImageGenerationConfig?: () => ImageGenerationConfig | Promise<ImageGenerationConfig>;
  setImageGenerationConfig?: (
    patch: Partial<ImageGenerationConfig>,
  ) => ImageGenerationConfig | Promise<ImageGenerationConfig>;
  getInstructMode?: () => InstructModeState | Promise<InstructModeState>;
  setInstructMode?: (
    patch: InstructModePatch,
  ) => InstructModeState | Promise<InstructModeState>;
  getStopStrings?: () => string[] | Promise<string[]>;
  setStopStrings?: (
    stopStrings: string[],
  ) => string[] | Promise<string[]>;
  getModel?: () => string | Promise<string>;
  setModel?: (
    model: string,
    options?: SetModelOptions,
  ) => string | Promise<string>;
  selectProxyPreset?: (name?: string) => string | Promise<string>;
  narrateText?: (
    text: string,
    options?: NarrateOptions,
  ) => void | Promise<void>;
  translateText?: (
    text: string,
    options?: TranslateTextOptions,
  ) => string | Promise<string>;
  getYouTubeTranscript?: (
    urlOrId: string,
    options?: YouTubeTranscriptOptions,
  ) => string | Promise<string>;
  generate?: (prompt: string, options?: GenerateOptions) => Promise<string>;
  generateQuiet?: (prompt: string, options?: GenerateOptions) => Promise<string>;
  generateRaw?: (prompt: string, options?: GenerateRawOptions) => Promise<string>;
  stopGeneration?: () => boolean | Promise<boolean>;
  injectPrompt?: (prompt: string, options?: InjectOptions) => void | Promise<void>;
  listPromptInjections?: () => PromptInjectionState[] | Promise<PromptInjectionState[]>;
  removePromptInjections?: (id?: string) => number | Promise<number>;

  // 扩展操作 - World Info 激活
  activateWorldInfoEntry?: (name: string, options?: ActivateLoreOptions) => void | Promise<void>;

  // 扩展操作 - Preset
  getPreset?: () => PresetInfo | undefined | Promise<PresetInfo | undefined>;
  setPreset?: (name: string) => void | Promise<void>;
  listPresets?: () => PresetInfo[] | Promise<PresetInfo[]>;
  selectContextPreset?: (
    name?: string,
    options?: { quiet?: boolean },
  ) => string | Promise<string>;
  listPromptEntries?: () => PromptEntryState[] | Promise<PromptEntryState[]>;
  setPromptEntriesEnabled?: (
    updates: PromptEntryStateUpdate[],
  ) => void | Promise<void>;

  // 扩展操作 - Regex
  listRegexScripts?: () => RegexScriptInfo[] | Promise<RegexScriptInfo[]>;
  getRegexScript?: (name: string) => RegexScriptInfo | undefined | Promise<RegexScriptInfo | undefined>;
  setRegexScriptEnabled?: (name: string, enabled: boolean) => void | Promise<void>;
  runRegexScript?: (name: string, input: string) => string | Promise<string>;
  getRegexPreset?: () => string | null | Promise<string | null>;
  setRegexPreset?: (nameOrId: string) => string | null | Promise<string | null>;

  // 扩展操作 - Audio
  playAudio?: (url: string, options?: AudioOptions) => void | Promise<void>;
  stopAudio?: () => void | Promise<void>;
  pauseAudio?: () => void | Promise<void>;
  resumeAudio?: () => void | Promise<void>;
  setAudioVolume?: (volume: number) => void | Promise<void>;
  playAudioByType?: (type: AudioChannelType, track?: { url: string; title?: string }) => void | Promise<void>;
  pauseAudioByType?: (type: AudioChannelType) => void | Promise<void>;
  stopAudioByType?: (type: AudioChannelType) => void | Promise<void>;
  setAudioEnabledByType?: (type: AudioChannelType, enabled: boolean) => void | Promise<void>;
  setAudioModeByType?: (type: AudioChannelType, mode: AudioChannelSnapshot["mode"]) => void | Promise<void>;
  getAudioListByType?: (type: AudioChannelType) => Array<{ url: string; title?: string }>;
  replaceAudioListByType?: (type: AudioChannelType, list: Array<{ url: string; title?: string }>) => void | Promise<void>;
  appendAudioListByType?: (type: AudioChannelType, list: Array<{ url: string; title?: string }>) => void | Promise<void>;
  getAudioStateByType?: (type: AudioChannelType) => AudioChannelSnapshot | undefined;

  // 扩展操作 - API 读取（P2 高频命令族）
  getApiSource?: () => string | undefined | Promise<string | undefined>;
  getApiUrl?: (api?: string) => string | undefined | Promise<string | undefined>;

  // 扩展操作 - P2 高频缺口（run / trimtokens / reload-page）
  runSlashCommand?: (script: string) => string | Promise<string>;
  countTokens?: (text: string) => number | Promise<number>;
  sliceByTokens?: (
    text: string,
    limit: number,
    direction: "start" | "end",
  ) => string | Promise<string>;
  setPersonaLock?: (
    state: PersonaLockState,
    options?: { type?: PersonaLockType },
  ) => boolean | Promise<boolean>;
  getClipboardText?: () => string | Promise<string>;
  setClipboardText?: (text: string) => void | Promise<void>;
  importVariables?: (
    from: string,
    mappings: ImportVariableMapping[],
  ) => number | void | Promise<number | void>;
  reloadPage?: () => void | Promise<void>;
  listTools?: () => SlashToolDefinition[] | Promise<SlashToolDefinition[]>;
  invokeTool?: (
    name: string,
    parameters: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
  addCharacterTag?: (
    tagName: string,
    options?: CharacterTagCommandOptions,
  ) => boolean | Promise<boolean>;
  removeCharacterTag?: (
    tagName: string,
    options?: CharacterTagCommandOptions,
  ) => boolean | Promise<boolean>;
  hasCharacterTag?: (
    tagName: string,
    options?: CharacterTagCommandOptions,
  ) => boolean | Promise<boolean>;
  listCharacterTags?: (
    options?: CharacterTagCommandOptions,
  ) => string[] | Promise<string[]>;
  listGallery?: (
    options?: ListGalleryOptions,
  ) => string[] | Promise<string[]>;
  showGallery?: (
    options?: ListGalleryOptions,
  ) => void | Promise<void>;
  registerTool?: (
    registration: SlashToolRegistration,
  ) => boolean | Promise<boolean>;
  unregisterTool?: (name: string) => boolean | Promise<boolean>;
  openDataBank?: () => void | Promise<void>;
  listDataBankEntries?: (
    options?: { source?: DataBankSource },
  ) => DataBankEntrySnapshot[] | Promise<DataBankEntrySnapshot[]>;
  getDataBankText?: (
    target: string,
    options?: { source?: DataBankSource },
  ) => string | Promise<string>;
  addDataBankText?: (
    content: string,
    options?: { source?: DataBankSource; name?: string },
  ) => string | Promise<string>;
  updateDataBankText?: (
    target: string,
    content: string,
    options?: { source?: DataBankSource },
  ) => string | void | Promise<string | void>;
  deleteDataBankEntry?: (
    target: string,
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  setDataBankEntryEnabled?: (
    target: string,
    enabled: boolean,
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  ingestDataBank?: (
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  purgeDataBank?: (
    options?: { source?: DataBankSource },
  ) => void | Promise<void>;
  searchDataBank?: (
    query: string,
    options?: {
      source?: DataBankSource;
      threshold?: number;
      count?: number;
      returnType?: "urls" | "chunks";
    },
  ) => string[] | string | Promise<string[] | string>;
  isExtensionInstalled?: (
    extensionName: string,
  ) => boolean | Promise<boolean>;
  getExtensionEnabledState?: (
    extensionName: string,
  ) => boolean | Promise<boolean>;
  setExtensionEnabled?: (
    extensionName: string,
    enabled: boolean,
    options?: { reload?: boolean },
  ) => string | void | Promise<string | void>;
  getVectorWorldInfoState?: () => boolean | Promise<boolean>;
  setVectorWorldInfoState?: (
    enabled: boolean,
  ) => boolean | void | Promise<boolean | void>;
  getVectorChatsState?: () => boolean | Promise<boolean>;
  setVectorChatsState?: (
    enabled: boolean,
  ) => boolean | void | Promise<boolean | void>;
  getVectorFilesState?: () => boolean | Promise<boolean>;
  setVectorFilesState?: (
    enabled: boolean,
  ) => boolean | void | Promise<boolean | void>;
  getVectorMaxEntries?: () => number | Promise<number>;
  setVectorMaxEntries?: (
    value: number,
  ) => number | void | Promise<number | void>;
  getVectorQueryMessages?: () => number | Promise<number>;
  setVectorQueryMessages?: (
    value: number,
  ) => number | void | Promise<number | void>;
  getVectorScoreThreshold?: () => number | Promise<number>;
  setVectorScoreThreshold?: (
    value: number,
  ) => number | void | Promise<number | void>;

  // 扩展操作 - P2 高频缺口（branch / ui）
  togglePanels?: () => void | Promise<void>;
  resetPanels?: () => void | Promise<void>;
  toggleVisualNovelMode?: () => void | Promise<void>;
  setBackground?: (background?: string) => string | Promise<string>;
  lockBackground?: () => void | Promise<void>;
  unlockBackground?: () => void | Promise<void>;
  autoBackground?: () => void | Promise<void>;
  setTheme?: (theme?: string) => string | Promise<string>;
  setMovingUiPreset?: (presetName: string) => string | Promise<string>;
  setCssVariable?: (args: { varName: string; value: string; target?: string }) => void | Promise<void>;
  setAverageBackgroundColor?: (color?: string) => string | Promise<string>;
  setChatDisplayMode?: (
    mode: "default" | "bubble" | "document",
  ) => void | Promise<void>;
  showButtonsPopup?: (
    text: string,
    labels: string[],
    options?: ButtonsCommandOptions,
  ) => string | string[] | Promise<string | string[]>;
  showPopup?: (
    text: string,
    options?: PopupCommandOptions,
  ) => string | number | null | undefined | Promise<string | number | null | undefined>;
  pickIcon?: () => string | false | Promise<string | false>;
  isMobileDevice?: () => boolean | Promise<boolean>;
  generateCaption?: (
    options?: CaptionCommandOptions,
  ) => string | Promise<string>;
  playNotificationSound?: () => void | Promise<void>;
  uploadExpressionAsset?: (
    imageUrl: string,
    options: ExpressionUploadOptions,
  ) => string | Promise<string>;
  setExpression?: (
    label: string,
    options?: ExpressionSetOptions,
  ) => string | Promise<string>;
  setExpressionFolderOverride?: (
    folder: string,
    options?: ExpressionFolderOverrideOptions,
  ) => string | void | Promise<string | void>;
  getLastExpression?: (name?: string) => string | Promise<string>;
  listExpressions?: (
    options?: ExpressionListOptions,
  ) => string[] | Promise<string[]>;
  classifyExpression?: (
    text: string,
    options?: ExpressionClassifyOptions,
  ) => string | Promise<string>;
  jumpToMessage?: (index: number) => void | Promise<void>;
  renderChatMessages?: (
    count: number,
    options?: { scroll?: boolean },
  ) => void | Promise<void>;
}

// ============================================================================
//                              命令处理器类型
// ============================================================================

/** 单个命令的处理函数签名 */
export type CommandHandler = (
  args: string[],
  namedArgs: Record<string, string>,
  context: ExecutionContext,
  pipe: string,
  invocationMeta?: CommandInvocationMeta,
  scope?: CommandScope,
) => Promise<string>;
