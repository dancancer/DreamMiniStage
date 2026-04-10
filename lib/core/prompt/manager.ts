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
  GenerationType,
  ExtendedChatMessage,
  PostProcessOptions,
} from "../st-preset-types";
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

import {
  matchesTrigger,
  enrichEnv,
  processPrompt,
  injectAbsoluteMessages,
} from "./manager-helpers";

import type {
  ChatMessageWithMeta,
  AbsoluteInjection,
  BuildMessagesOptions,
  SamplingParams,
  BuildMessagesForModelOptions,
} from "./manager-helpers";

// ============================================================================
//                              重导出类型
// ============================================================================

export type {
  ChatMessageWithMeta,
  BuildMessagesOptions,
  SamplingParams,
  BuildMessagesForModelOptions,
};

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

      if (prompt && matchesTrigger(prompt, generationType)) {
        result.push(prompt);
      }
    }
    return result;
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

    const effectiveEnv = enrichEnv(env, options.userInput);
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

      const message = processPrompt(prompt, effectiveEnv, this.macroEvaluator);
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

    const finalMessages = injectAbsoluteMessages(relativeMessages, absoluteInjections);

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

  /* ─────────────────────────────────────────────────────────────────────────
     Sysprompt 支持
     ───────────────────────────────────────────────────────────────────────── */

  buildMessagesWithSysprompt(env: MacroEnv, options: BuildMessagesOptions = {}): ExtendedChatMessage[] {
    const effectiveEnv = enrichEnv(env, options.userInput);
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
