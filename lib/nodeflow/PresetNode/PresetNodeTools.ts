/**
 * PresetNodeTools - 使用 STPromptManager 构建提示词框架
 *
 * 核心职责：
 * 1. 优先加载用户导入且启用的预设（从 IndexedDB）
 * 2. 回退到极简内置预设（内置文件已移除）
 * 3. 构建 MacroEnv 环境变量（含世界书内容）
 * 4. 调用 STPromptManager 生成最终消息
 * 5. 支持变量持久化（按对话隔离）
 */

import { NodeTool } from "@/lib/nodeflow/NodeTool";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { Character } from "@/lib/core/character";
import { STPromptManager } from "@/lib/core/prompt";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { loadWorldBookContent } from "@/lib/core/world-book-loader";
import {
  getEvaluatorForDialogue,
  persistVariables,
} from "@/lib/core/macro-evaluator-manager";
import type { STCombinedPreset, STOpenAIPreset, STPrompt, MacroEnv, ChatMessage, PromptNames, PostProcessingMode, STContextPreset, STSyspromptPreset } from "@/lib/core/st-preset-types";
import { DEFAULT_CONTEXT_PRESET, DEFAULT_SAMPLING_PARAMS } from "@/lib/core/st-preset-types";
import type { Preset, PresetPrompt } from "@/lib/models/preset-model";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";

/** 系统预设类型（开发期允许自定义字符串标识） */
export type SystemPresetType = "none" | string;

export class PresetNodeTools extends NodeTool {
  protected static readonly toolType: string = "preset";
  protected static readonly version: string = "2.0.0";

  static getToolType(): string {
    return this.toolType;
  }

  static async executeMethod(methodName: string, ...params: unknown[]): Promise<unknown> {
    const method = (this as unknown as Record<string, unknown>)[methodName];
    
    if (typeof method !== "function") {
      console.error(`Method lookup failed: ${methodName} not found in PresetNodeTools`);
      throw new Error(`Method ${methodName} not found in ${this.getToolType()}Tool`);
    }

    try {
      this.logExecution(methodName, params);
      return await (method as (...args: unknown[]) => Promise<unknown>).apply(this, params);
    } catch (error) {
      this.handleError(error as Error, methodName);
    }
  }

  /**
   * 构建提示词框架
   * 优先使用用户导入且启用的预设，回退到内置默认预设
   *
   * Requirements: 2.6, 3.1
   * - 接收 chatHistoryMessages 并设置到 MacroEnv
   * - 移除 chatHistory 占位符字符串，改用结构化消息
   *
   * @param chatHistoryMessages - 来自 HistoryPreNode 的结构化历史消息
   */
  static async buildPromptFramework(
    characterId: string,
    language: "zh" | "en" = "zh",
    username?: string,
    charName?: string,
    number?: number,
    _fastModel: boolean = false,
    _systemPresetType: SystemPresetType = "none",
    dialogueKey?: string,
    currentUserInput?: string,
    chatHistoryMessages?: ChatMessage[],
    contextPreset?: STContextPreset,
    sysprompt?: STSyspromptPreset & { enabled?: boolean },
    promptNames?: PromptNames,
    postProcessingMode?: PostProcessingMode,
  ): Promise<{ messages: ChatMessage[]; presetId?: string }> {
    try {
      /* ═══════════════════════════════════════════════════════════════════════
         1. 加载角色数据
         ═══════════════════════════════════════════════════════════════════════ */

      const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
      if (!characterRecord) {
        throw new Error(`Character not found: ${characterId}`);
      }
      const character = new Character(characterRecord);
      const finalCharName = charName || character.characterData.name;

      /* ═══════════════════════════════════════════════════════════════════════
         2. 加载预设配置
         ═══════════════════════════════════════════════════════════════════════ */

      const { openaiPreset, presetId, presetContext, presetSysprompt } = await this.loadUserEnabledPreset();
      const effectiveContext = contextPreset || presetContext;
      const effectiveSysprompt = sysprompt?.enabled === false
        ? undefined
        : sysprompt || presetSysprompt;

      const combinedPreset: STCombinedPreset = {
        openai: openaiPreset,
        context: effectiveContext,
        sysprompt: effectiveSysprompt,
      };

      /* ═══════════════════════════════════════════════════════════════════════
         3. 初始化 PromptManager
         ═══════════════════════════════════════════════════════════════════════ */

      const effectiveDialogueKey = dialogueKey || characterId;
      const macroEvaluator = await getEvaluatorForDialogue(effectiveDialogueKey);
      const promptManager = new STPromptManager(combinedPreset, macroEvaluator);

      /* ═══════════════════════════════════════════════════════════════════════
         4. 加载世界书内容
         ═══════════════════════════════════════════════════════════════════════ */

      const { wiBefore, wiAfter } = await loadWorldBookContent(
        character,
        effectiveDialogueKey,
        currentUserInput || "",
      );

      /* ═══════════════════════════════════════════════════════════════════════
         5. 构建 MacroEnv
         Requirements: 2.6 - 设置 chatHistoryMessages
         ═══════════════════════════════════════════════════════════════════════ */

      const env: MacroEnv = {
        // 基础变量
        user: username || "用户",
        char: finalCharName,
        number: number || 200,
        language,

        // 角色信息
        description: character.characterData.description || "",
        personality: character.characterData.personality || "",
        scenario: character.characterData.scenario || "",
        persona: "",
        mesExamples: character.characterData.mes_example || "",

        // 世界书
        wiBefore,
        wiAfter,

        // 聊天历史：使用结构化消息数组，而非占位符字符串
        // Requirements: 2.6, 3.1
        chatHistoryMessages: chatHistoryMessages || [],
      };

      // ═══════════════════════════════════════════════════════════════════════
      // 5.1 世界书模板替换（与 SillyTavern 一致）：在环境就绪后执行宏求值
      //     这样 {{user}}/{{char}} 等占位符会在注入前被展开
      // ═══════════════════════════════════════════════════════════════════════
      env.wiBefore = macroEvaluator.evaluate(env.wiBefore || "", env);
      env.wiAfter = macroEvaluator.evaluate(env.wiAfter || "", env);

      if (currentUserInput) {
        env.lastUserMessage = currentUserInput;
        env.userInput = currentUserInput;
      }

      /* ═══════════════════════════════════════════════════════════════════════
         6. 构建消息数组
         ═══════════════════════════════════════════════════════════════════════ */

      const vectorManager = getVectorMemoryManager();
      const hasUserHistory = (chatHistoryMessages || []).some((m) => m.role === "user");
      let vectorMemoryText = "";

      // 仅在开启且已有用户历史时检索向量记忆，避免首包污染
      if (currentUserInput && hasUserHistory && vectorManager.isEnabled()) {
        const vectorRetrieval = await vectorManager.retrieve({
          sessionId: effectiveDialogueKey,
          query: currentUserInput,
        });
        vectorMemoryText = vectorRetrieval.formattedText;
      }

      const messages = promptManager.buildMessagesWithSysprompt(env, {
        userInput: currentUserInput,
        promptNames,
        postProcessingMode,
      });
      const contextMessage = this.buildContextPresetMessage(promptManager, env, effectiveContext);
      if (contextMessage) {
        messages.unshift(contextMessage);
      }

      // 首轮对话不注入向量记忆，避免干扰预设首包
      if (vectorMemoryText) {
        messages.unshift({
          role: "system",
          content: vectorMemoryText,
          identifier: "3_vectors",
        });
      }
      const normalizedMessages: ChatMessage[] = messages
        .filter((m) => m.role === "system" || m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          name: m.name,
        }));

      /* ═══════════════════════════════════════════════════════════════════════
         7. 持久化变量状态
         ═══════════════════════════════════════════════════════════════════════ */

      await persistVariables(effectiveDialogueKey);

      console.log(
        `[PresetNodeTools] Built: preset=${presetId}, msgs=${normalizedMessages.length}, ` +
        `historyMsgs=${chatHistoryMessages?.length || 0}`,
      );

      return { messages: normalizedMessages, presetId };
    } catch (error) {
      this.handleError(error as Error, "buildPromptFramework");
    }
  }

  private static buildContextPresetMessage(
    promptManager: STPromptManager,
    env: MacroEnv,
    contextPreset?: STContextPreset,
  ): ChatMessage | null {
    if (!contextPreset) {
      return null;
    }

    const isDefaultContext = contextPreset.name === DEFAULT_CONTEXT_PRESET.name
      && contextPreset.story_string === DEFAULT_CONTEXT_PRESET.story_string;
    if (isDefaultContext) {
      return null;
    }

    const position = contextPreset.story_string_position ?? DEFAULT_CONTEXT_PRESET.story_string_position;
    const depth = contextPreset.story_string_depth ?? DEFAULT_CONTEXT_PRESET.story_string_depth;
    const supportsPlacement = position === DEFAULT_CONTEXT_PRESET.story_string_position
      && depth === DEFAULT_CONTEXT_PRESET.story_string_depth;
    if (!supportsPlacement) {
      throw new Error(
        `Unsupported context preset placement for '${contextPreset.name}': ` +
        `story_string_position=${position}, story_string_depth=${depth}`,
      );
    }

    const content = promptManager.renderStoryString(env).trim();
    if (!content) {
      return null;
    }

    const role = contextPreset.story_string_role === 1
      ? "user"
      : contextPreset.story_string_role === 2
        ? "assistant"
        : "system";

    return {
      role,
      content,
      name: contextPreset.name,
    };
  }

  /**
   * 加载用户导入且启用的预设
   * 优先从 IndexedDB 加载，回退到内置默认预设
   */
  private static async loadUserEnabledPreset(): Promise<{
    openaiPreset: STOpenAIPreset;
    presetId: string;
    presetContext?: STContextPreset;
    presetSysprompt?: STSyspromptPreset;
  }> {
    try {
      // 1. 查找用户启用的预设
      const allPresets = await PresetOperations.getAllPresets();
      console.log(`[PresetNodeTools] Found ${allPresets.length} presets in IndexedDB`);
      
      for (const p of allPresets) {
        console.log(`[PresetNodeTools] Preset: ${p.name}, enabled=${p.enabled}, id=${p.id}, prompts=${p.prompts?.length}, prompt_order=${p.prompt_order?.length}`);
      }
      
      const enabledPreset = allPresets.find((preset) => preset.enabled !== false);

      if (enabledPreset && enabledPreset.id) {
        console.log(`[PresetNodeTools] Using user enabled preset: ${enabledPreset.name} (${enabledPreset.id})`);
        console.log(`[PresetNodeTools] Preset has prompt_order: ${!!enabledPreset.prompt_order}, length: ${enabledPreset.prompt_order?.length || 0}`);
        
        // 2. 获取排序后的 prompts
        const orderedPrompts = await PresetOperations.getOrderedPrompts(enabledPreset.id);
        console.log(`[PresetNodeTools] Got ${orderedPrompts.length} ordered prompts`);
        
        if (orderedPrompts.length > 0) {
          // 3. 转换为 STOpenAIPreset 格式
          const openaiPreset = this.convertToSTOpenAIPreset(enabledPreset, orderedPrompts);
          console.log(`[PresetNodeTools] Converted to STOpenAIPreset with ${openaiPreset.prompts.length} prompts`);

          return {
            openaiPreset,
            presetId: enabledPreset.id,
            presetContext: enabledPreset.context,
            presetSysprompt: enabledPreset.sysprompt,
          };
        } else {
          console.warn(`[PresetNodeTools] No ordered prompts found for preset ${enabledPreset.id}`);
        }
      } else {
        console.log("[PresetNodeTools] No enabled preset found in IndexedDB");
      }

      // 回退到极简默认预设（不再加载内置文件）
      console.log("[PresetNodeTools] Falling back to minimal default preset");
      const defaultPreset = this.getFallbackOpenAIPreset();
      return { openaiPreset: defaultPreset, presetId: "default" };
    } catch (error) {
      console.error("[PresetNodeTools] Failed to load user preset:", error);
      const defaultPreset = this.getFallbackOpenAIPreset();
      return { openaiPreset: defaultPreset, presetId: "default" };
    }
  }

  /**
   * 将用户预设转换为 STOpenAIPreset 格式
   */
  private static convertToSTOpenAIPreset(preset: Preset, orderedPrompts: PresetPrompt[]): STOpenAIPreset {
    const prompts: STPrompt[] = orderedPrompts.map(p => ({
      identifier: p.identifier,
      name: p.name,
      content: p.content,
      role: p.role as "system" | "user" | "assistant" | undefined,
      system_prompt: true,
      marker: p.marker,
      forbid_overrides: p.forbid_overrides,
      injection_position: p.injection_position,
      injection_depth: p.injection_depth,
      injection_order: p.injection_order,
    }));

    const promptOrder = [{
      character_id: 100001,
      order: orderedPrompts.map(p => ({
        identifier: p.identifier,
        enabled: p.enabled !== false,
      })),
    }];

    return {
      prompts,
      prompt_order: promptOrder,
      temperature: preset.sampling?.temperature ?? DEFAULT_SAMPLING_PARAMS.temperature,
      top_p: preset.sampling?.topP ?? DEFAULT_SAMPLING_PARAMS.top_p,
      top_k: preset.sampling?.topK,
      frequency_penalty: preset.sampling?.frequencyPenalty ?? DEFAULT_SAMPLING_PARAMS.frequency_penalty,
      presence_penalty: preset.sampling?.presencePenalty ?? DEFAULT_SAMPLING_PARAMS.presence_penalty,
      repetition_penalty: preset.sampling?.repeatPenalty,
      openai_max_context: preset.sampling?.contextWindow ?? DEFAULT_SAMPLING_PARAMS.openai_max_context,
      openai_max_tokens: preset.sampling?.maxTokens ?? DEFAULT_SAMPLING_PARAMS.openai_max_tokens,
      stream_openai: preset.sampling?.streaming ?? true,
      squash_system_messages: false,
    };
  }

  /**
   * 获取回退的 OpenAI Preset
   */
  private static getFallbackOpenAIPreset(): STOpenAIPreset {
    return {
      prompts: [
        { identifier: "main", name: "Main Prompt", system_prompt: true, role: "system", content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}." },
        { identifier: "worldInfoBefore", name: "World Info (before)", system_prompt: true, marker: true },
        { identifier: "charDescription", name: "Char Description", system_prompt: true, marker: true },
        { identifier: "charPersonality", name: "Char Personality", system_prompt: true, marker: true },
        { identifier: "scenario", name: "Scenario", system_prompt: true, marker: true },
        { identifier: "worldInfoAfter", name: "World Info (after)", system_prompt: true, marker: true },
        { identifier: "chatHistory", name: "Chat History", system_prompt: true, marker: true },
        { identifier: "jailbreak", name: "Post-History Instructions", system_prompt: true, role: "system", content: "" },
      ],
      prompt_order: [{
        character_id: 100001,
        order: [
          { identifier: "main", enabled: true },
          { identifier: "worldInfoBefore", enabled: true },
          { identifier: "charDescription", enabled: true },
          { identifier: "charPersonality", enabled: true },
          { identifier: "scenario", enabled: true },
          { identifier: "worldInfoAfter", enabled: true },
          { identifier: "chatHistory", enabled: true },
          { identifier: "jailbreak", enabled: true },
        ],
      }],
      ...DEFAULT_SAMPLING_PARAMS,
      stream_openai: true,
      squash_system_messages: false,
    };
  }

  /**
   * 清除 Preset 缓存
   */
  static clearCache(): void {
    console.log("[PresetNodeTools] Preset cache cleared (no-op, built-in presets removed)");
  }
} 
