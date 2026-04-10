/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  Slash Command 选项 / 配置 / 状态类型                      ║
 * ║                                                                            ║
 * ║  所有 *Options / *Config / *State 参数包                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
//                              发送 & 基础选项
// ============================================================================

export interface SendOptions {
  at?: number;
  name?: string;
  compact?: boolean;
  returnType?: string;
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

// ============================================================================
//                              表情 & 标签选项
// ============================================================================

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

export interface ExpressionUploadOptions {
  name?: string;
  label: string;
  folder?: string;
  spriteName?: string;
}

// ============================================================================
//                              UI 弹窗 & 按钮选项
// ============================================================================

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

// ============================================================================
//                              角色标签 & 变量选项
// ============================================================================

export interface CharacterTagCommandOptions {
  name?: string;
}

export interface ImportVariableMapping {
  source: string;
  target: string;
}

export interface ReasoningParseResult {
  reasoning: string;
  content: string;
}

export interface ReasoningParseOptions {
  strict?: boolean;
}

// ============================================================================
//                              Quick Reply 选项
// ============================================================================

export interface QuickReplyLookup {
  label?: string;
  id?: number;
}

export interface QuickReplyCreateOptions {
  icon?: string;
  showLabel?: boolean;
  title?: string;
  hidden?: boolean;
  startup?: boolean;
  user?: boolean;
  bot?: boolean;
  load?: boolean;
  new?: boolean;
  group?: boolean;
  generation?: boolean;
  automationId?: string;
}

export interface QuickReplyUpdateOptions extends QuickReplyCreateOptions {
  newLabel?: string;
  message?: string;
}

export interface QuickReplyContextOptions {
  chain?: boolean;
}

export interface QuickReplySetOptions {
  nosend?: boolean;
  before?: boolean;
  inject?: boolean;
}

export interface QuickReplySetVisibilityOptions {
  visible?: boolean;
}

export type QuickReplySetScope = "all" | "global" | "chat";

// ============================================================================
//                              图像生成选项
// ============================================================================

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

// ============================================================================
//                              Instruct / 模型 / 翻译选项
// ============================================================================

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

export interface TranslateTextOptions {
  target?: string;
  provider?: string;
}

export interface YouTubeTranscriptOptions {
  lang?: string;
}

// ============================================================================
//                              World Info 时效选项
// ============================================================================

export type WorldInfoTimedEffectName = "sticky" | "cooldown" | "delay";
export type WorldInfoTimedEffectFormat = "boolean" | "number";
export type WorldInfoTimedEffectState = "on" | "off" | "toggle";

// ============================================================================
//                              生成 & 注入选项
// ============================================================================

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

/** 激活 Lore 选项 */
export interface ActivateLoreOptions {
  duration?: number;
}

/** 音频播放选项 */
export interface AudioOptions {
  volume?: number;
  loop?: boolean;
}
