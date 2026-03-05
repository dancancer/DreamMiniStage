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
  deleteCurrentChat?: () => void | Promise<void>;
  deleteMessagesByName?: (name: string) => number | Promise<number>;
  deleteSwipe?: (swipeId?: number) => string | number | void | Promise<string | number | void>;
  getCurrentCharacter?: () => CharacterSummary | undefined | Promise<CharacterSummary | undefined>;
  listCharacters?: () => CharacterSummary[] | Promise<CharacterSummary[]>;
  switchCharacter?: (
    target: string
  ) => CharacterSwitchResult | void | Promise<CharacterSwitchResult | void>;

  // 扩展操作 - World Book
  getWorldBookEntry?: (id: string) => WorldBookEntryData | undefined | Promise<WorldBookEntryData | undefined>;
  searchWorldBook?: (query: string) => WorldBookEntryData[] | Promise<WorldBookEntryData[]>;
  setWorldBookEntry?: (id: string, data: Partial<WorldBookEntryData>) => void | Promise<void>;
  createWorldBookEntry?: (data: Partial<WorldBookEntryData>) => WorldBookEntryData | Promise<WorldBookEntryData | undefined>;
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
  generate?: (prompt: string, options?: GenerateOptions) => Promise<string>;
  generateQuiet?: (prompt: string, options?: GenerateOptions) => Promise<string>;
  injectPrompt?: (prompt: string, options?: InjectOptions) => void | Promise<void>;

  // 扩展操作 - World Info 激活
  activateWorldInfoEntry?: (name: string, options?: ActivateLoreOptions) => void | Promise<void>;

  // 扩展操作 - Preset
  getPreset?: () => PresetInfo | undefined | Promise<PresetInfo | undefined>;
  setPreset?: (name: string) => void | Promise<void>;
  listPresets?: () => PresetInfo[] | Promise<PresetInfo[]>;
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
  reloadPage?: () => void | Promise<void>;

  // 扩展操作 - P2 高频缺口（branch / ui）
  togglePanels?: () => void | Promise<void>;
  resetPanels?: () => void | Promise<void>;
  toggleVisualNovelMode?: () => void | Promise<void>;
  setBackground?: (background?: string) => string | Promise<string>;
  setTheme?: (theme?: string) => string | Promise<string>;
  setMovingUiPreset?: (presetName: string) => string | Promise<string>;
  setCssVariable?: (args: { varName: string; value: string; target?: string }) => void | Promise<void>;
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

/** 注入选项 */
export interface InjectOptions {
  position?: "before" | "after";
  depth?: number;
  role?: "system" | "user" | "assistant";
  ephemeral?: boolean;
}

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
