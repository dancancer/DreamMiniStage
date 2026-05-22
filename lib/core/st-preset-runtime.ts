/**
 * SillyTavern Preset 运行时类型
 *
 * 宏替换、消息格式、后处理、多模态内容、工具调用、
 * 常量与默认值
 *
 * 预设结构类型见 st-preset-types.ts
 */

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
 * 设计原则：单一消息结构承载多模态、工具调用和 prefill 语义
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
