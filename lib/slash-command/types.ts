/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Slash Command 类型定义                             ║
 * ║                                                                            ║
 * ║  定义命令解析、执行的核心数据结构                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueMessage } from "@/types/character-dialogue";

export interface SendOptions {
  at?: number;
  name?: string;
  compact?: boolean;
  returnType?: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
}

export interface CharacterSwitchResult {
  target: string;
  characterId: string;
  characterName: string;
  sessionId: string;
  sessionName: string;
}

export interface LorebookBindings {
  primary: string | null;
  additional: string[];
}

export interface PromptEntryState {
  identifier: string;
  name: string;
  enabled: boolean;
}

export interface PromptEntryStateUpdate {
  identifier: string;
  enabled: boolean;
}

export interface PromptInjectionState {
  id: string;
  content: string;
  role: "system" | "assistant" | "user";
  position: "before" | "after" | "in_chat" | "none";
  depth: number;
  should_scan: boolean;
  createdAt: string;
}

export type DataBankSource = "global" | "character" | "chat";
export type PersonaLockType = "chat" | "character" | "default";
export type PersonaLockState = "on" | "off" | "toggle";
export type PersonaSetMode = "lookup" | "temp" | "all";
export type ExpressionSetType = "expression" | "sprite";
export type AuthorNotePosition = "before" | "after" | "chat";
export type AuthorNoteRole = "system" | "user" | "assistant";

export interface AuthorNoteState {
  text: string;
  depth: number;
  frequency: number;
  position: AuthorNotePosition;
  role: AuthorNoteRole;
}

export interface ConnectionProfileState {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface DataBankEntrySnapshot {
  name: string;
  url: string;
  source?: DataBankSource;
  enabled?: boolean;
}

export interface ExpressionSetOptions {
  type?: ExpressionSetType;
}

export interface ExpressionFolderOverrideOptions {
  name?: string;
}

export interface ExpressionListOptions {
  filterAvailable?: boolean;
}

export interface ExpressionClassifyOptions {
  api?: string;
  filterAvailable?: boolean;
  prompt?: string;
}

export interface CaptionCommandOptions {
  prompt?: string;
  quiet?: boolean;
  mesId?: number;
  index?: number;
}

export interface ButtonsCommandOptions {
  multiple?: boolean;
}

export interface PopupCommandOptions {
  header?: string;
  scroll?: boolean;
  large?: boolean;
  wide?: boolean;
  wider?: boolean;
  transparent?: boolean;
  okButton?: string;
  cancelButton?: string;
  result?: boolean;
}

export interface ImportVariableMapping {
  source: string;
  target: string;
}

export type ImageGenerationProcessingMode = "standard" | "minimal";

export interface ImageGenerationConfig {
  source: string;
  style: string;
  comfyWorkflow: string;
}

export interface ImageGenerationOptions {
  quiet?: boolean;
  negative?: string;
  extend?: boolean;
  edit?: boolean;
  multimodal?: boolean;
  snap?: boolean;
  processing?: ImageGenerationProcessingMode;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  skip?: number;
  model?: string;
  sampler?: string;
  scheduler?: string;
  vae?: string;
  upscaler?: string;
  hires?: boolean;
  scale?: number;
  denoise?: number;
  secondPassSteps?: number;
  faces?: boolean;
}

export interface InstructModeState {
  enabled: boolean;
  preset: string | null;
}

export interface InstructModePatch {
  enabled?: boolean;
  preset?: string;
  quiet?: boolean;
}

export interface SetModelOptions {
  quiet?: boolean;
}

export interface NarrateOptions {
  voice?: string;
}

// ============================================================================
//                              解析结果类型
// ============================================================================

/** 单个 Slash 命令的解析结果 */
export interface SlashCommand {
  name: string;                           // 命令名，如 "send"
  args: string[];                         // 位置参数
  namedArgs: Record<string, string>;      // 命名参数 key=value
  namedArgumentList?: ParsedNamedArgument[]; // 命名参数赋值列表（保序，包含重复）
  unnamedArgumentList?: ParsedUnnamedArgument[]; // 位置参数赋值列表（保序）
  parserFlags?: ParserFlags;              // 解析期 parser flag 快照
  scopeDepth?: number;                    // 解析期作用域深度（root=0）
  raw: string;                            // 原始命令字符串，用于错误报告
}

/** 命名参数赋值（解析期元数据） */
export interface ParsedNamedArgument {
  name: string;
  value: string;
  rawValue: string;
  wasQuoted: boolean;
}

/** 位置参数赋值（解析期元数据） */
export interface ParsedUnnamedArgument {
  value: string;
  rawValue: string;
  wasQuoted: boolean;
}

/** 单次命令调用元数据（执行期透传） */
export interface CommandInvocationMeta {
  raw: string;
  namedArgumentList: ParsedNamedArgument[];
  unnamedArgumentList: ParsedUnnamedArgument[];
  parserFlags?: ParserFlags;
  scopeDepth?: number;
}

/** parser flags（对齐 ST Parser 的最小子集） */
export interface ParserFlags {
  STRICT_ESCAPING: boolean;
  REPLACE_GETVAR: boolean;
}

export type ParserFlagName = keyof ParserFlags;

/** 解析器返回结果 */
export interface ParseResult {
  commands: SlashCommand[];
  isError: boolean;
  errorMessage?: string;
}

// ============================================================================
//                              执行结果类型
// ============================================================================

/** 命令执行结果 */
export interface ExecutionResult {
  pipe: string;                           // 管道输出值
  isError: boolean;
  errorMessage?: string;
  aborted?: boolean;
}

// ============================================================================
//                              执行上下文类型
// ============================================================================

/** 命令执行所需的上下文 */
export interface ExecutionContext {
  characterId?: string;
  messages: DialogueMessage[];
  onSend: (text: string, options?: SendOptions) => void | Promise<void>;
  onTrigger: (member?: string) => void | Promise<void>;
  onSendAs?: (role: string, text: string) => void | Promise<void>;
  onSendSystem?: (text: string) => void | Promise<void>;
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
  getCurrentChatName?: () => string | Promise<string>;
  setInputText?: (text: string) => void | Promise<void>;
  getCurrentCharacter?: () => CharacterSummary | undefined | Promise<CharacterSummary | undefined>;
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
  narrateText?: (
    text: string,
    options?: NarrateOptions,
  ) => void | Promise<void>;
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
  listGallery?: (
    options?: ListGalleryOptions,
  ) => string[] | Promise<string[]>;
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

/** Preset 信息 */
export interface PresetInfo {
  name: string;
  type?: "openai" | "context" | "sysprompt";
}

/** Regex 脚本信息 */
export interface RegexScriptInfo {
  name: string;
  enabled: boolean;
  pattern?: string;
  replacement?: string;
}

/** 音频播放选项 */
export interface AudioOptions {
  volume?: number;
  loop?: boolean;
}

/** 音频通道类型 */
export type AudioChannelType = "bgm" | "ambient";

/** 音频通道运行时快照 */
export interface AudioChannelSnapshot {
  enabled: boolean;
  mode: "repeat" | "random" | "single" | "stop";
  currentUrl: string | null;
  playlist: Array<{ url: string; title?: string }>;
  isPlaying: boolean;
}

/** 变量作用域 */
export type VariableScope = "local" | "global";

/** World Book 条目数据 */
export interface WorldBookEntryData {
  id: string;
  keys: string[];
  content: string;
  enabled: boolean;
  comment?: string;
  priority?: number;
  depth?: number;
}

/** 生成选项 */
export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/** 原始生成选项（对应 /genraw） */
export interface GenerateRawOptions {
  lock?: boolean;
  instruct?: boolean;
  as?: "system" | "char";
  systemPrompt?: string;
  prefillPrompt?: string;
  responseLength?: number;
  trimNames?: boolean;
  stopSequences?: string[];
}

/** 注入选项 */
export interface InjectOptions {
  position?: "before" | "after" | "chat" | "in_chat" | "none";
  depth?: number;
  role?: "system" | "user" | "assistant";
  ephemeral?: boolean;
}

export interface ListGalleryOptions {
  character?: string;
  group?: string;
}

export type GroupMemberField = "name" | "index" | "id" | "avatar";
export type GroupMemberMoveDirection = "up" | "down";

/** 激活 Lore 选项 */
export interface ActivateLoreOptions {
  duration?: number;
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
) => Promise<string>;
