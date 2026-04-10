/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                STPromptManager - 辅助类型与工具函数                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  STPrompt,
  STPromptOrder,
  STCombinedPreset,
  STContextPreset,
  STSyspromptPreset,
  MacroEnv,
  ChatMessage,
  GenerationType,
  ExtendedChatMessage,
  PromptNames,
  PostProcessOptions,
} from "../st-preset-types";
import type { DepthInjection } from "../world-book-advanced";
import {
  ST_PROMPT_IDENTIFIERS,
  ST_MARKER_IDENTIFIERS,
  DEFAULT_CONTEXT_PRESET,
  PostProcessingMode,
} from "../st-preset-types";
import { postProcessMessages } from "./post-processor";
import {
  STMacroEvaluator,
  evaluateHandlebarsConditions,
} from "../st-macro-evaluator";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 带元数据的聊天消息
 * identifier 用于调试追踪
 */
export interface ChatMessageWithMeta extends ChatMessage {
  identifier?: string;
}

export interface AbsoluteInjection {
  message: ChatMessageWithMeta;
  depth: number;
  order: number;
}

export interface BuildMessagesOptions {
  characterId?: number;
  generationType?: GenerationType;
  worldInfoDepthInjections?: DepthInjection[];
  userInput?: string;

  /* ─────────────────────────────────────────────────────────────────────────
     后处理选项 (Requirements: 1.1-1.5, 2.1-2.5)
     ───────────────────────────────────────────────────────────────────────── */

  /** 后处理模式，默认 NONE（不做后处理） */
  postProcessingMode?: PostProcessingMode;

  /** 角色名称集合，用于名称前缀规范化 */
  promptNames?: PromptNames;

  /** 是否保留工具调用字段，默认 false */
  tools?: boolean;

  /** Assistant prefill 内容 */
  prefill?: string;

  /** 占位符文本，默认 "Let's get started." */
  placeholder?: string;
}

export interface SamplingParams {
  temperature: number;
  top_p: number;
  top_k?: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  max_context: number;
  seed?: number;
}

/**
 * buildMessagesForModel 选项
 *
 * 继承 BuildMessagesOptions 的所有选项，用于模型特定消息构建
 */
export interface BuildMessagesForModelOptions extends BuildMessagesOptions {
  // 继承所有 BuildMessagesOptions 的字段
  // 模型特定选项可在此扩展
}

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 检查 prompt 是否匹配当前生成类型
 *
 * 规则：
 * - trigger 为 undefined/null → 所有类型都启用
 * - trigger 为空数组 → 所有类型都启用
 * - trigger 为 string → 仅当 generationType === trigger 时启用
 * - trigger 为非空数组 → 当 generationType 在数组中时启用
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function matchesTrigger(prompt: STPrompt, generationType?: GenerationType): boolean {
  const trigger = prompt.injection_trigger;

  // 无 trigger 或无 generationType → 启用
  if (!trigger || !generationType) return true;

  // 数组类型
  if (Array.isArray(trigger)) {
    // 空数组 → 所有类型都启用
    return trigger.length === 0 || trigger.includes(generationType);
  }

  // 单值字符串
  return trigger === generationType;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 解析 marker 内容
 *
 * 规则（对齐 SillyTavern）：
 * 1. 优先使用硬编码 markerMap（已知的标准 marker）
 * 2. 若 markerMap 无匹配，回退到 env[identifier]
 * 3. 空/undefined 返回空字符串（调用方会跳过）
 *
 * 这允许 preset 作者添加自定义 marker，无需修改代码
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function resolveMarker(identifier: string, env: MacroEnv): string {
  // 硬编码的标准 marker 映射
  const markerMap: Record<string, string | undefined> = {
    [ST_PROMPT_IDENTIFIERS.WORLD_INFO_BEFORE]: env.wiBefore,
    [ST_PROMPT_IDENTIFIERS.WORLD_INFO_AFTER]: env.wiAfter,
    [ST_PROMPT_IDENTIFIERS.CHAR_DESCRIPTION]: env.description,
    [ST_PROMPT_IDENTIFIERS.CHAR_PERSONALITY]: env.personality,
    [ST_PROMPT_IDENTIFIERS.SCENARIO]: env.scenario,
    [ST_PROMPT_IDENTIFIERS.PERSONA_DESCRIPTION]: env.persona,
    [ST_PROMPT_IDENTIFIERS.DIALOGUE_EXAMPLES]: env.mesExamples,
    [ST_PROMPT_IDENTIFIERS.CHAT_HISTORY]: env.chatHistory,
  };

  // 优先使用 markerMap
  if (identifier in markerMap) {
    return markerMap[identifier] || "";
  }

  // 回退到 env[identifier]（类型安全访问）
  const envValue = env[identifier];
  if (typeof envValue === "string") {
    return envValue;
  }

  // 非字符串值（number/boolean/array/undefined）返回空字符串
  return "";
}

export function enrichEnv(env: MacroEnv, userInput?: string): MacroEnv {
  const history = env.chatHistoryMessages || [];
  const lastEntry = history[history.length - 1];
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  const resolvedUserInput = userInput ?? env.userInput ?? env.lastUserMessage ?? lastUser?.content;

  return {
    ...env,
    userInput: resolvedUserInput ?? env.userInput,
    lastUserMessage: env.lastUserMessage ?? resolvedUserInput ?? env.lastMessage,
    lastCharMessage: env.lastCharMessage ?? lastAssistant?.content,
    lastMessage: env.lastMessage ?? lastEntry?.content ?? resolvedUserInput,
    messageCount: env.messageCount ?? history.length,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 处理单个 prompt，生成 ChatMessage
 *
 * 字段输出规则（对齐 SillyTavern）：
 * - prompt.name → ChatMessage.name（用于群聊和多角色示例）
 * - prompt.identifier → ChatMessage.identifier（用于调试追踪）
 *
 * Requirements: 5.1, 5.2, 6.1
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function processPrompt(
  prompt: STPrompt,
  env: MacroEnv,
  macroEvaluator: STMacroEvaluator,
): ChatMessageWithMeta | null {
  const role = prompt.role || "system";

  if (prompt.marker || ST_MARKER_IDENTIFIERS.has(prompt.identifier)) {
    const content = resolveMarker(prompt.identifier, env);
    if (!content?.trim()) return null;
    const msg: ChatMessageWithMeta = { role, content };
    // name 字段：用于群聊和多角色示例（Requirements 5.1, 5.2）
    if (prompt.name) msg.name = prompt.name;
    // identifier 字段：用于调试追踪（Requirements 6.1）
    if (prompt.identifier) msg.identifier = prompt.identifier;
    return msg;
  }

  if (!prompt.content) return null;

  let content = evaluateHandlebarsConditions(prompt.content, env);
  content = macroEvaluator.evaluate(content, env);
  if (!content.trim()) return null;

  const msg: ChatMessageWithMeta = { role, content };
  // name 字段：用于群聊和多角色示例（Requirements 5.1, 5.2）
  if (prompt.name) msg.name = prompt.name;
  // identifier 字段：用于调试追踪（Requirements 6.1）
  if (prompt.identifier) msg.identifier = prompt.identifier;
  return msg;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 按 depth 位置注入消息（对齐 SillyTavern）
 *
 * ST 实现逻辑：
 * 1. reverse messages（最新消息变成 index 0）
 * 2. 从 depth=0 开始处理，插入到 depth + totalInserted 位置
 * 3. 同 depth 内按 order desc、role priority 排序
 * 4. 最后 reverse 回来
 *
 * 最终效果：
 * - depth=0 的消息在数组末尾
 * - 高 depth 的消息在数组前面
 * - 同 depth 内，高 order 在前
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function injectAbsoluteMessages(
  messages: ChatMessageWithMeta[],
  injections: AbsoluteInjection[],
): ChatMessageWithMeta[] {
  if (injections.length === 0) return messages;

  // role 优先级映射：system 最高(0)，assistant 最低(2)
  const rolePriority: Record<string, number> = { system: 0, user: 1, assistant: 2 };

  // 按 depth 分组
  const depthGroups = new Map<number, AbsoluteInjection[]>();
  for (const inj of injections) {
    const group = depthGroups.get(inj.depth) || [];
    group.push(inj);
    depthGroups.set(inj.depth, group);
  }

  // 获取所有 depth 并按升序排列（低 depth 先处理，对齐 ST）
  const depths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

  // reverse messages（对齐 ST：最新消息变成 index 0）
  const result = [...messages].reverse();
  let totalInserted = 0;

  for (const depth of depths) {
    const group = depthGroups.get(depth)!;

    // 同 depth 内排序：order desc → role priority
    // 排序后高 order 在前，同 order 内 system 在前
    group.sort((a, b) => {
      if (a.order !== b.order) return b.order - a.order;
      return (rolePriority[a.message.role] ?? 3) - (rolePriority[b.message.role] ?? 3);
    });

    // 计算插入位置（对齐 ST）
    const insertIdx = depth + totalInserted;

    // 一次性插入同 depth 的所有消息
    // 注意：因为最后会 reverse，所以这里需要 reverse 插入顺序
    // 这样 reverse 后高 order 才会在前
    const messagesToInsert = group.map(inj => inj.message).reverse();
    result.splice(insertIdx, 0, ...messagesToInsert);
    totalInserted += messagesToInsert.length;
  }

  // reverse 回来
  return result.reverse();
}
