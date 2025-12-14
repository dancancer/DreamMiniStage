/**
 * SillyTavern Preset 类型定义
 *
 * 完全兼容 SillyTavern 的三层预设结构：
 * 1. OpenAI Preset - 提示词定义、排序、采样参数
 * 2. Context Preset - story_string Handlebars 模板
 * 3. Sysprompt Preset - 主系统提示词和历史后注入
 */

/* ═══════════════════════════════════════════════════════════════════════════
   OpenAI Preset 类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 单个 Prompt 定义
 */
export interface STPrompt {
  /** 唯一标识符 (main, jailbreak, chatHistory 等) */
  identifier: string;
  /** 显示名称 */
  name: string;
  /** 提示词内容 (支持宏替换) */
  content?: string;
  /** 消息角色 */
  role?: "system" | "user" | "assistant";
  /** 是否为系统提示 */
  system_prompt?: boolean;
  /** 是否为占位符标记 (chatHistory, worldInfoBefore 等) */
  marker?: boolean;

  /* ─────────────────────────────────────────────────────────────────────────
     注入控制
     ───────────────────────────────────────────────────────────────────────── */

  /** 注入位置模式: 0=相对位置, 1=绝对位置 */
  injection_position?: number;
  /** 绝对注入时的深度 (从聊天历史底部计算) */
  injection_depth?: number;
  /** 同深度时的排序优先级 */
  injection_order?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     触发条件
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 触发类型 (normal/continue/quiet/impersonate/swipe 等)
   * 支持单值或数组：
   * - string: 仅在该类型时启用
   * - string[]: 在数组中任一类型时启用
   * - 空数组/undefined: 所有类型都启用
   */
  injection_trigger?: STInjectionTrigger | STInjectionTrigger[];

  /* ─────────────────────────────────────────────────────────────────────────
     权限控制
     ───────────────────────────────────────────────────────────────────────── */

  /** 禁止角色卡覆盖此 prompt */
  forbid_overrides?: boolean;
}

/**
 * 注入触发类型
 */
export type STInjectionTrigger =
  | "normal"
  | "continue"
  | "quiet"
  | "impersonate"
  | "swipe"
  | "regenerate"
  | "group";

/**
 * Prompt 排序条目
 */
export interface STPromptOrderEntry {
  /** 对应 prompt 的 identifier */
  identifier: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * Prompt 排序配置 (支持按角色自定义)
 */
export interface STPromptOrder {
  /** 角色 ID: 100000=旧默认, 100001=新默认, 其他为角色特定 */
  character_id: number;
  /** 排序列表 */
  order: STPromptOrderEntry[];
}

/**
 * OpenAI Preset 完整格式
 */
export interface STOpenAIPreset {
  /* ─────────────────────────────────────────────────────────────────────────
     提示词配置
     ───────────────────────────────────────────────────────────────────────── */

  /** 提示词定义数组 */
  prompts: STPrompt[];
  /** 排序控制 (支持按角色自定义) */
  prompt_order: STPromptOrder[];

  /* ─────────────────────────────────────────────────────────────────────────
     采样参数
     ───────────────────────────────────────────────────────────────────────── */

  temperature?: number;
  top_p?: number;
  top_k?: number;
  top_a?: number;
  min_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  /** 最大上下文长度 */
  openai_max_context?: number;
  /** 最大生成 token 数 */
  openai_max_tokens?: number;
  /** 随机种子 (-1 为随机) */
  seed?: number;
  /** 生成数量 */
  n?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     特殊提示词模板
     ───────────────────────────────────────────────────────────────────────── */

  /** 扮演用户时的提示词 */
  impersonation_prompt?: string;
  /** 新对话开始提示 */
  new_chat_prompt?: string;
  /** 新群聊开始提示 */
  new_group_chat_prompt?: string;
  /** 新示例对话提示 */
  new_example_chat_prompt?: string;
  /** 继续生成提示 */
  continue_nudge_prompt?: string;
  /** 群聊指定角色提示 */
  group_nudge_prompt?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     格式化模板
     ───────────────────────────────────────────────────────────────────────── */

  /** World Info 格式 ({0} 为内容占位符) */
  wi_format?: string;
  /** 场景格式 */
  scenario_format?: string;
  /** 性格格式 */
  personality_format?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     流式和其他选项
     ───────────────────────────────────────────────────────────────────────── */

  /** 是否启用流式输出 */
  stream_openai?: boolean;
  /** 助手预填充内容 */
  assistant_prefill?: string;
  /** 扮演时的助手预填充 */
  assistant_impersonation?: string;
  /** 是否合并连续系统消息 */
  squash_system_messages?: boolean;
  /** 继续生成时的预填充 */
  continue_prefill?: boolean;
  /** 继续生成时的后缀 */
  continue_postfix?: string;
  /** 是否内联图片 */
  image_inlining?: boolean;

  /* ─────────────────────────────────────────────────────────────────────────
     模型配置 (可选，用于导入兼容)
     ───────────────────────────────────────────────────────────────────────── */

  chat_completion_source?: string;
  openai_model?: string;
  claude_model?: string;
  google_model?: string;
  custom_model?: string;
  custom_url?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Context Preset 类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Context Preset 格式
 * 控制 story_string 的 Handlebars 模板渲染
 */
export interface STContextPreset {
  /** 预设名称 */
  name: string;
  /** 故事字符串 Handlebars 模板 */
  story_string: string;
  /** 示例对话分隔符 */
  example_separator: string;
  /** 聊天开始标记 */
  chat_start: string;
  /** 是否使用停止字符串 */
  use_stop_strings?: boolean;
  /** 是否将角色名作为停止字符串 */
  names_as_stop_strings?: boolean;
  /** story_string 位置: 0=系统消息, 1=用户消息 */
  story_string_position?: number;
  /** story_string 深度 */
  story_string_depth?: number;
  /** story_string 角色: 0=system, 1=user, 2=assistant */
  story_string_role?: number;
  /** 是否始终强制使用角色名 */
  always_force_name2?: boolean;
  /** 是否裁剪句子 */
  trim_sentences?: boolean;
  /** 是否单行模式 */
  single_line?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sysprompt Preset 类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Sysprompt Preset 格式
 * 独立的系统提示词配置
 */
export interface STSyspromptPreset {
  /** 预设名称 */
  name: string;
  /** 主系统提示词内容 */
  content: string;
  /** 历史后注入内容 (Post-History) */
  post_history?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   组合预设类型 (运行时使用)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 组合预设 - 运行时使用的完整配置
 */
export interface STCombinedPreset {
  /** OpenAI 预设 (必需) */
  openai: STOpenAIPreset;
  /** Context 预设 (可选) */
  context?: STContextPreset;
  /** Sysprompt 预设 (可选) */
  sysprompt?: STSyspromptPreset;
}

/* ═══════════════════════════════════════════════════════════════════════════
   宏替换环境类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 宏替换环境
 * 包含所有可用于宏替换的变量
 */
export interface MacroEnv {
  /* ─────────────────────────────────────────────────────────────────────────
     基础变量
     ───────────────────────────────────────────────────────────────────────── */

  /** 用户名 */
  user: string;
  /** 角色名 */
  char: string;
  /** 当前用户输入（用于占位符替换） */
  userInput?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     角色信息
     ───────────────────────────────────────────────────────────────────────── */

  /** 角色描述 */
  description?: string;
  /** 角色性格 */
  personality?: string;
  /** 场景描述 */
  scenario?: string;
  /** 用户人设 */
  persona?: string;
  /** 示例对话 */
  mesExamples?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     World Info
     ───────────────────────────────────────────────────────────────────────── */

  /** World Info 前置内容 */
  wiBefore?: string;
  /** World Info 后置内容 */
  wiAfter?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     聊天历史
     ───────────────────────────────────────────────────────────────────────── */

  /** 聊天历史（字符串格式，用于宏替换） */
  chatHistory?: string;
  /** 聊天历史消息数组（用于在 chatHistory marker 位置展开插入） */
  chatHistoryMessages?: ChatMessage[];
  /** 最后一条消息 */
  lastMessage?: string;
  /** 最后用户消息 */
  lastUserMessage?: string;
  /** 最后角色消息 */
  lastCharMessage?: string;
  /** 最后消息 ID */
  lastMessageId?: number;
  /** 消息数量 */
  messageCount?: number;

  /* ─────────────────────────────────────────────────────────────────────────
     锚点 (Author's Note 等)
     ───────────────────────────────────────────────────────────────────────── */

  /** 前置锚点 */
  anchorBefore?: string;
  /** 后置锚点 */
  anchorAfter?: string;
  /** 系统提示词 */
  system?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     群聊
     ───────────────────────────────────────────────────────────────────────── */

  /** 群组成员列表 */
  group?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     扩展变量
     ───────────────────────────────────────────────────────────────────────── */

  /** 允许任意扩展变量 */
  [key: string]: string | number | boolean | ChatMessage[] | undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
   生成类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成类型 - 用于 injection_trigger 过滤
 */
export type GenerationType =
  | "normal"
  | "continue"
  | "quiet"
  | "impersonate"
  | "swipe"
  | "regenerate"
  | "group";

/* ═══════════════════════════════════════════════════════════════════════════
   后处理模式
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 消息后处理模式
 *
 * 控制消息合并和规整策略，适配不同模型的 API 要求：
 * - none:   不做任何处理，原样返回
 * - merge:  合并连续同角色消息，保留 system 位置
 * - semi:   merge + 将中途 system 降级为 user
 * - strict: semi + 强制首条为 user + 插入占位符
 * - single: 所有消息合并为单条 user 消息
 */
export enum PostProcessingMode {
  NONE = "none",
  MERGE = "merge",
  SEMI = "semi",
  STRICT = "strict",
  SINGLE = "single",
}

/* ═══════════════════════════════════════════════════════════════════════════
   角色名称集合
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 角色名称集合
 *
 * 用于名称前缀规范化，确保群聊/多角色示例在忽略 name 字段的模型上
 * 仍能正确显示说话人标识
 */
export interface PromptNames {
  /** 角色名 */
  charName: string;
  /** 用户名 */
  userName: string;
  /** 群组成员名列表 */
  groupNames: string[];
  /** 检查消息是否以群组成员名开头 */
  startsWithGroupName: (message: string) => boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   多模态内容类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 文本内容片段
 */
export interface TextContentPart {
  type: "text";
  text: string;
}

/**
 * 图片内容片段
 */
export interface ImageContentPart {
  type: "image_url";
  image_url: { url: string };
}

/**
 * 视频内容片段
 */
export interface VideoContentPart {
  type: "video_url";
  video_url: { url: string };
}

/**
 * 音频内容片段
 */
export interface AudioContentPart {
  type: "audio_url";
  audio_url: { url: string };
}

/**
 * 工具使用内容片段 (Claude 格式)
 */
export interface ToolUseContentPart {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

/**
 * 工具结果内容片段 (Claude 格式)
 */
export interface ToolResultContentPart {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

/**
 * 多模态内容片段联合类型
 *
 * 支持文本、图片、视频、音频以及工具调用相关内容
 */
export type ContentPart =
  | TextContentPart
  | ImageContentPart
  | VideoContentPart
  | AudioContentPart
  | ToolUseContentPart
  | ToolResultContentPart;

/* ═══════════════════════════════════════════════════════════════════════════
   工具调用类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 工具调用 (OpenAI 格式)
 *
 * 用于 function calling 功能
 */
export interface ToolCall {
  /** 工具调用唯一 ID */
  id: string;
  /** 调用类型，目前仅支持 function */
  type: "function";
  /** 函数调用详情 */
  function: {
    /** 函数名 */
    name: string;
    /** JSON 格式的参数字符串 */
    arguments: string;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   消息类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 聊天消息 - 最终发送给 API 的格式
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** 消息发送者名称 (OpenAI API 支持) */
  name?: string;
  /**
   * 消息来源的 prompt identifier
   * 用于 squash 排除和调试追踪
   * 注意：发送 API 前应剥离此字段
   */
  identifier?: string;
}

/**
 * 扩展聊天消息 - 支持多模态内容和工具调用
 *
 * 在 ChatMessage 基础上扩展：
 * - content 支持 string | ContentPart[] 多模态内容
 * - 新增 tool 角色支持工具调用响应
 * - 新增 tool_calls 支持发起工具调用
 * - 新增 prefix 支持 assistant prefill
 *
 * 设计原则：向后兼容，现有 ChatMessage 代码无需修改
 */
export interface ExtendedChatMessage {
  /** 消息角色，新增 tool 角色用于工具调用响应 */
  role: "system" | "user" | "assistant" | "tool";

  /** 消息内容：字符串或多模态数组 */
  content: string | ContentPart[];

  /** 发送者名称（处理后会被移除） */
  name?: string;

  /** 来源标识符（用于调试，API 发送前移除） */
  identifier?: string;

  /** 工具调用数组 (OpenAI 格式) */
  tool_calls?: ToolCall[];

  /** 工具调用 ID（tool 角色消息必需） */
  tool_call_id?: string;

  /** Prefill 标记，用于 Claude 等模型的 assistant 预填充 */
  prefix?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   后处理配置
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 后处理配置选项
 */
export interface PostProcessOptions {
  /** 后处理模式 */
  mode: PostProcessingMode;

  /** 角色名称集合 */
  names: PromptNames;

  /** 是否保留工具调用，默认 false */
  tools?: boolean;

  /** Assistant prefill 内容 */
  prefill?: string;

  /** 占位符文本，默认 "Let's get started." */
  placeholder?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   标准 Prompt Identifiers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 标准 Prompt 标识符常量
 */
export const ST_PROMPT_IDENTIFIERS = {
  /** 主系统提示词 */
  MAIN: "main",
  /** 辅助提示词 (原 NSFW) */
  NSFW: "nsfw",
  /** 历史后指令 (Post-History) */
  JAILBREAK: "jailbreak",
  /** 增强定义 */
  ENHANCE_DEFINITIONS: "enhanceDefinitions",
  /** World Info 前置注入点 */
  WORLD_INFO_BEFORE: "worldInfoBefore",
  /** World Info 后置注入点 */
  WORLD_INFO_AFTER: "worldInfoAfter",
  /** 角色描述注入点 */
  CHAR_DESCRIPTION: "charDescription",
  /** 角色性格注入点 */
  CHAR_PERSONALITY: "charPersonality",
  /** 场景注入点 */
  SCENARIO: "scenario",
  /** 用户人设注入点 */
  PERSONA_DESCRIPTION: "personaDescription",
  /** 示例对话注入点 */
  DIALOGUE_EXAMPLES: "dialogueExamples",
  /** 聊天历史注入点 */
  CHAT_HISTORY: "chatHistory",
} as const;

/**
 * Marker 类型的标识符集合
 */
export const ST_MARKER_IDENTIFIERS: Set<string> = new Set([
  ST_PROMPT_IDENTIFIERS.WORLD_INFO_BEFORE,
  ST_PROMPT_IDENTIFIERS.WORLD_INFO_AFTER,
  ST_PROMPT_IDENTIFIERS.CHAR_DESCRIPTION,
  ST_PROMPT_IDENTIFIERS.CHAR_PERSONALITY,
  ST_PROMPT_IDENTIFIERS.SCENARIO,
  ST_PROMPT_IDENTIFIERS.PERSONA_DESCRIPTION,
  ST_PROMPT_IDENTIFIERS.DIALOGUE_EXAMPLES,
  ST_PROMPT_IDENTIFIERS.CHAT_HISTORY,
]);

/* ═══════════════════════════════════════════════════════════════════════════
   默认值
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 默认 OpenAI Preset 采样参数
 */
export const DEFAULT_SAMPLING_PARAMS = {
  temperature: 1,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  openai_max_context: 4095,
  openai_max_tokens: 300,
} as const;

/**
 * 默认 Context Preset
 */
export const DEFAULT_CONTEXT_PRESET: STContextPreset = {
  name: "Default",
  story_string:
    "{{#if system}}{{system}}\n{{/if}}{{#if wiBefore}}{{wiBefore}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{personality}}\n{{/if}}{{#if scenario}}{{scenario}}\n{{/if}}{{#if wiAfter}}{{wiAfter}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}{{trim}}",
  example_separator: "***",
  chat_start: "***",
  use_stop_strings: false,
  names_as_stop_strings: true,
  story_string_position: 0,
  story_string_depth: 1,
  story_string_role: 0,
  always_force_name2: true,
  trim_sentences: false,
  single_line: false,
};

/* ═══════════════════════════════════════════════════════════════════════════
   工具函数类型
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 宏处理器函数类型
 */
export type MacroHandler = (
  args: string[],
  env: MacroEnv
) => string | undefined;

/**
 * 宏注册表类型
 */
export type MacroRegistry = Map<string, MacroHandler>;
