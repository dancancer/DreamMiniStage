/**
 * SillyTavern Preset 类型定义
 *
 * 完全兼容 SillyTavern 的三层预设结构：
 * 1. OpenAI Preset - 提示词定义、排序、采样参数
 * 2. Context Preset - story_string Handlebars 模板
 * 3. Sysprompt Preset - 主系统提示词和历史后注入
 *
 * 运行时类型（消息、宏、后处理）见 st-preset-runtime.ts
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

// ============================================================================
//                 桶导出 - 从 st-preset-runtime 重导出全部运行时类型
// ============================================================================

export * from "./st-preset-runtime";
