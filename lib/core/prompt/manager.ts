/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     STPromptManager - 消息构建核心                          ║
 * ║                                                                            ║
 * ║  职责：根据 preset 配置构建最终消息数组                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type {
  STOpenAIPreset,
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
  convertForClaude,
  convertForGoogle,
  type ClaudeConversionResult,
  type GoogleConversionResult,
  type ModelType,
} from "./converters";
import {
  STMacroEvaluator,
  evaluateHandlebarsConditions,
} from "../st-macro-evaluator";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   扩展 ChatMessage 以支持元数据
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 带元数据的聊天消息
 * identifier 用于调试追踪
 */
export interface ChatMessageWithMeta extends ChatMessage {
  identifier?: string;
}

interface AbsoluteInjection {
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
   STPromptManager 类
   ═══════════════════════════════════════════════════════════════════════════ */

export class STPromptManager {
  private preset: STCombinedPreset;
  private macroEvaluator: STMacroEvaluator;

  constructor(preset: STCombinedPreset, macroEvaluator?: STMacroEvaluator) {
    this.preset = preset;
    this.macroEvaluator = macroEvaluator || new STMacroEvaluator();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Preset 访问器
     ───────────────────────────────────────────────────────────────────────── */

  getOpenAIPreset(): STOpenAIPreset { return this.preset.openai; }
  getContextPreset(): STContextPreset { return this.preset.context || DEFAULT_CONTEXT_PRESET; }
  getSyspromptPreset(): STSyspromptPreset | undefined { return this.preset.sysprompt; }
  getMacroEvaluator(): STMacroEvaluator { return this.macroEvaluator; }

  /* ─────────────────────────────────────────────────────────────────────────
     Prompt 排序
     ───────────────────────────────────────────────────────────────────────── */

  getPromptOrder(characterId?: number): STPromptOrder | undefined {
    const orders = this.preset.openai.prompt_order;
    if (characterId !== undefined) {
      const specific = orders.find((o) => o.character_id === characterId);
      if (specific) return specific;
    }
    return orders.find((o) => o.character_id === 100001) ||
           orders.find((o) => o.character_id === 100000) ||
           orders[0];
  }

  findPrompt(identifier: string): STPrompt | undefined {
    return this.preset.openai.prompts.find((p) => p.identifier === identifier);
  }

  getOrderedPrompts(characterId?: number, generationType?: GenerationType): STPrompt[] {
    const order = this.getPromptOrder(characterId);
    if (!order) return [];

    const result: STPrompt[] = [];
    for (const entry of order.order) {
      if (!entry.enabled) continue;

      let prompt = this.findPrompt(entry.identifier);
      if (!prompt && ST_MARKER_IDENTIFIERS.has(entry.identifier)) {
        prompt = { identifier: entry.identifier, name: entry.identifier, system_prompt: true, marker: true };
      }

      if (prompt && this.matchesTrigger(prompt, generationType)) {
        result.push(prompt);
      }
    }
    return result;
  }

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
  private matchesTrigger(prompt: STPrompt, generationType?: GenerationType): boolean {
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

  /* ─────────────────────────────────────────────────────────────────────────
     消息构建
     ───────────────────────────────────────────────────────────────────────── */

  buildMessages(env: MacroEnv, options: BuildMessagesOptions = {}): ExtendedChatMessage[] {
    const {
      characterId,
      generationType,
      worldInfoDepthInjections = [],
      postProcessingMode = PostProcessingMode.NONE,
      promptNames,
      tools = false,
      prefill,
      placeholder,
    } = options;

    const effectiveEnv = this.enrichEnv(env, options.userInput);
    const orderedPrompts = this.getOrderedPrompts(characterId, generationType);
    const relativeMessages: ChatMessageWithMeta[] = [];
    const absoluteInjections: AbsoluteInjection[] = [];

    for (const prompt of orderedPrompts) {
      // ═══════════════════════════════════════════════════════════════════════
      // 展开 chatHistory marker
      // 包含：历史消息 + 当前用户输入（作为最后一条 user 消息）
      // ═══════════════════════════════════════════════════════════════════════
      if (prompt.identifier === ST_PROMPT_IDENTIFIERS.CHAT_HISTORY) {
        const history = effectiveEnv.chatHistoryMessages || [];
        const hasCurrentUserInput = Boolean(effectiveEnv.userInput?.trim());
        const chatStartMessage = this.buildChatStartMessage(history.length > 0 || hasCurrentUserInput);

        if (chatStartMessage) {
          relativeMessages.push(chatStartMessage);
        }

        relativeMessages.push(...history);

        // 将当前用户输入作为最后一条 user 消息
        if (hasCurrentUserInput) {
          relativeMessages.push({ role: "user", content: effectiveEnv.userInput! });
        }
        continue;
      }

      const message = this.processPrompt(prompt, effectiveEnv);
      if (!message) continue;

      const decoratedMessage = prompt.identifier === ST_PROMPT_IDENTIFIERS.DIALOGUE_EXAMPLES
        ? this.decorateDialogueExamplesMessage(message)
        : message;

      if (prompt.injection_position === 1 && prompt.injection_depth !== undefined) {
        absoluteInjections.push({ message: decoratedMessage, depth: prompt.injection_depth, order: prompt.injection_order || 0 });
      } else {
        relativeMessages.push(decoratedMessage);
      }
    }

    // 添加 World Info 深度注入
    for (const wi of worldInfoDepthInjections) {
      if (wi.content.trim()) {
        absoluteInjections.push({ message: { role: "system", content: wi.content }, depth: wi.depth, order: wi.order });
      }
    }

    const finalMessages = this.injectAbsoluteMessages(relativeMessages, absoluteInjections);

    // ═══════════════════════════════════════════════════════════════════════
    // 后处理管线 (Requirements: 1.1-1.5, 2.1-2.5)
    // 根据 postProcessingMode 应用名称规范化、角色合并、严格模式等处理
    // ═══════════════════════════════════════════════════════════════════════
    if (postProcessingMode !== PostProcessingMode.NONE && promptNames) {
      const postProcessOptions: PostProcessOptions = {
        mode: postProcessingMode,
        names: promptNames,
        tools,
        prefill,
        placeholder,
      };
      return postProcessMessages(finalMessages as ExtendedChatMessage[], postProcessOptions);
    }

    return finalMessages as ExtendedChatMessage[];
  }

  private decorateDialogueExamplesMessage(message: ChatMessageWithMeta): ChatMessageWithMeta {
    const separator = String(this.getExampleSeparator() || "").trim();
    if (!separator || separator === DEFAULT_CONTEXT_PRESET.example_separator || !message.content.trim()) {
      return message;
    }

    return {
      ...message,
      content: `${separator}
${message.content}`,
    };
  }

  private buildChatStartMessage(hasConversation: boolean): ChatMessageWithMeta | null {
    if (!hasConversation) {
      return null;
    }

    const chatStart = String(this.getChatStart() || "").trim();
    if (!chatStart || chatStart === DEFAULT_CONTEXT_PRESET.chat_start) {
      return null;
    }

    return {
      role: "system",
      content: chatStart,
      identifier: "chatStart",
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
  private processPrompt(prompt: STPrompt, env: MacroEnv): ChatMessageWithMeta | null {
    const role = prompt.role || "system";

    if (prompt.marker || ST_MARKER_IDENTIFIERS.has(prompt.identifier)) {
      const content = this.resolveMarker(prompt.identifier, env);
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
    content = this.macroEvaluator.evaluate(content, env);
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
  private resolveMarker(identifier: string, env: MacroEnv): string {
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

  private enrichEnv(env: MacroEnv, userInput?: string): MacroEnv {
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
  private injectAbsoluteMessages(messages: ChatMessageWithMeta[], injections: AbsoluteInjection[]): ChatMessageWithMeta[] {
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

  /* ─────────────────────────────────────────────────────────────────────────
     Sysprompt 支持
     ───────────────────────────────────────────────────────────────────────── */

  buildMessagesWithSysprompt(env: MacroEnv, options: BuildMessagesOptions = {}): ExtendedChatMessage[] {
    const effectiveEnv = this.enrichEnv(env, options.userInput);
    const messages = this.buildMessages(effectiveEnv, { ...options, userInput: effectiveEnv.userInput });

    const syspromptContent = this.getSyspromptContent(effectiveEnv);
    if (syspromptContent) {
      const idx = messages.findIndex((m) => m.role === "system");
      if (idx >= 0) {
        messages[idx] = { ...messages[idx], content: syspromptContent + "\n\n" + messages[idx].content };
      } else {
        messages.unshift({ role: "system", content: syspromptContent });
      }
    }

    const postHistory = this.getSyspromptPostHistory(effectiveEnv);
    if (postHistory) {
      const lastUserIdx = this.findLastUserMessageIndex(messages);
      if (lastUserIdx >= 0) {
        messages.splice(lastUserIdx + 1, 0, { role: "system", content: postHistory });
      } else {
        messages.push({ role: "system", content: postHistory });
      }
    }
    return messages;
  }

  private getSyspromptContent(env: MacroEnv): string {
    const sysprompt = this.preset.sysprompt;
    if (!sysprompt?.content) return "";
    let content = evaluateHandlebarsConditions(sysprompt.content, env);
    return this.macroEvaluator.evaluate(content, env).trim();
  }

  private getSyspromptPostHistory(env: MacroEnv): string {
    const sysprompt = this.preset.sysprompt;
    if (!sysprompt?.post_history) return "";
    let content = evaluateHandlebarsConditions(sysprompt.post_history, env);
    return this.macroEvaluator.evaluate(content, env).trim();
  }

  private findLastUserMessageIndex(messages: ExtendedChatMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     采样参数
     ───────────────────────────────────────────────────────────────────────── */

  getSamplingParams(): SamplingParams {
    const p = this.preset.openai;
    return {
      temperature: p.temperature ?? 1,
      top_p: p.top_p ?? 1,
      top_k: p.top_k,
      frequency_penalty: p.frequency_penalty ?? 0,
      presence_penalty: p.presence_penalty ?? 0,
      max_tokens: p.openai_max_tokens ?? 300,
      max_context: p.openai_max_context ?? 4095,
      seed: p.seed,
    };
  }

  getAssistantPrefill(): string { return this.preset.openai.assistant_prefill || ""; }
  isStreamEnabled(): boolean { return this.preset.openai.stream_openai ?? true; }

  /* ─────────────────────────────────────────────────────────────────────────
     模型特定消息构建 (Requirements: 7.1, 8.1)
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * 构建消息并转换为特定模型格式
   *
   * 设计哲学：
   * - 组合 buildMessages + 模型特定转换器
   * - 通过类型重载提供精确的返回类型
   * - OpenAI 格式是基准格式，无需转换
   *
   * Requirements: 7.1, 8.1
   *
   * @param env - 宏替换环境
   * @param modelType - 目标模型类型
   * @param options - 构建选项
   * @returns 模型特定格式的消息
   */
  buildMessagesForModel(
    env: MacroEnv,
    modelType: "claude",
    options?: BuildMessagesForModelOptions
  ): ClaudeConversionResult;

  buildMessagesForModel(
    env: MacroEnv,
    modelType: "google",
    options?: BuildMessagesForModelOptions
  ): GoogleConversionResult;

  buildMessagesForModel(
    env: MacroEnv,
    modelType: "openai",
    options?: BuildMessagesForModelOptions
  ): { messages: ExtendedChatMessage[] };

  buildMessagesForModel(
    env: MacroEnv,
    modelType: ModelType,
    options: BuildMessagesForModelOptions = {},
  ): ClaudeConversionResult | GoogleConversionResult | { messages: ExtendedChatMessage[] } {
    // 构建基础消息
    const messages = this.buildMessages(env, options);

    // 根据模型类型选择转换器
    switch (modelType) {
    case "claude":
      return convertForClaude(messages, {
        useTools: options.tools,
        placeholder: options.placeholder,
      });

    case "google":
      return convertForGoogle(messages, {
        placeholder: options.placeholder,
      });

    case "openai":
    default:
      // OpenAI 格式是基准格式，直接返回
      return { messages };
    }
  }

  renderStoryString(env: MacroEnv): string {
    let result = this.getContextPreset().story_string;
    result = evaluateHandlebarsConditions(result, env);
    result = this.macroEvaluator.evaluate(result, env);
    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  getExampleSeparator(): string { return this.getContextPreset().example_separator; }
  getChatStart(): string { return this.getContextPreset().chat_start; }
}
