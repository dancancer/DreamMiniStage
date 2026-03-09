/* ═══════════════════════════════════════════════════════════════════════════
   Character Dialogue - 角色对话核心逻辑
   ═══════════════════════════════════════════════════════════════════════════ */

import { Character } from "@/lib/core/character";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableLambda } from "@langchain/core/runnables";
import { getCharacterCompressorPromptZh, getCharacterCompressorPromptEn } from "@/lib/prompts/character-prompts";
import { CharacterHistory } from "@/lib/core/character-history";
import { DialogueOptions } from "@/lib/models/character-dialogue-model";
import { createGeminiRunnable } from "@/lib/core/gemini-client";
import { getString } from "@/lib/storage/client-storage";
import type { Runnable, RunnableLike } from "@langchain/core/runnables";
import type { ChatPromptValueInterface } from "@langchain/core/prompt_values";

/* ───────────────────────────────────────────────────────────────────────────
   类型定义
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * LLM 联合类型 - 支持的所有 LLM 实现
 */
type LLMInstance = ChatOpenAI | ChatOllama | ReturnType<typeof createGeminiRunnable>;

/**
 * 对话输入接口 - RunnablePassthrough 的输入结构
 */
interface DialogueInput {
  system_message: string;
  user_message: string;
}

/* ───────────────────────────────────────────────────────────────────────────
   主类实现
   ─────────────────────────────────────────────────────────────────────────── */

export class CharacterDialogue {
  character: Character;
  history: CharacterHistory;
  llm: LLMInstance | null;
  dialogueChain: Runnable<DialogueInput, string> | null = null;
  language: "zh" | "en" = "zh";
  llmType: "openai" | "ollama" | "gemini" = "openai";

  constructor(character: Character) {
    this.character = character;
    this.history = new CharacterHistory(this.language);
    this.llm = null;
  }

  async initialize(options?: DialogueOptions): Promise<void> {
    try {
      if (options?.language) {
        this.language = options.language;
        this.history = new CharacterHistory(options.language);
      }
      if (options?.llmType) {
        this.llmType = options.llmType;
      }

      this.setupLLM(options);
      this.setupDialogueChain();
    } catch (error) {
      console.error("Failed to initialize character dialogue:", error);
      throw new Error("Failed to initialize character dialogue");
    }
  }

  async getFirstMessage(): Promise<string[]> {
    const firstMessage = await this.character.getFirstMessage();
    return firstMessage;
  }

  setupLLM(options?: DialogueOptions): void {
    if (!options) {
      return;
    }
    const {
      modelName,
      apiKey,
      baseUrl,
      llmType,
      temperature = 0.7,
      streaming = false,
    } = options;

    const safeModel = modelName && modelName.trim() ? modelName.trim() : "";
    this.llmType = llmType || "openai";

    type LLMSettings = {
      temperature: number;
      maxTokens?: number;
      timeout?: number;
      maxRetries: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      topK?: number;
      repeatPenalty?: number;
    };
    
    let llmSettings: LLMSettings = {
      temperature: temperature || 0.9,
      maxRetries: 2,
      topP: 0.7,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 40,
      repeatPenalty: 1.1,
    };
    
    try {
      const savedSettings = getString("llmSettings");
      if (savedSettings) {
        llmSettings = {
          temperature: 0.9,
          maxTokens: undefined,
          timeout: undefined,
          maxRetries: 2,
          topP: 0.7,
          frequencyPenalty: 0,
          presencePenalty: 0,
          topK: 40,
          repeatPenalty: 1.1,
        };
      }
    } catch (error) {
      console.warn("Failed to load LLM settings from localStorage, using defaults", error);
    }

    if (llmType === "openai") {
      this.llm = new ChatOpenAI({
        modelName: safeModel,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
        },
        temperature: llmSettings.temperature,
        maxTokens: llmSettings.maxTokens,
        timeout: llmSettings.timeout,
        maxRetries: llmSettings.maxRetries,
        topP: llmSettings.topP,
        frequencyPenalty: llmSettings.frequencyPenalty,
        presencePenalty: llmSettings.presencePenalty,
        streaming: false,
        streamUsage: false,
      });
    } else if (llmType === "ollama") {
      // Ensure proper URL formatting for Windows compatibility
      let finalBaseUrl = baseUrl && baseUrl.trim() ? baseUrl.trim() : "http://localhost:11434";
      if (finalBaseUrl === "localhost:11434" || finalBaseUrl === "11434") {
        finalBaseUrl = "http://localhost:11434";
      } else if (finalBaseUrl.startsWith("localhost:") && !finalBaseUrl.startsWith("http://")) {
        finalBaseUrl = "http://" + finalBaseUrl;
      } else if (!finalBaseUrl.startsWith("http://") && !finalBaseUrl.startsWith("https://")) {
        finalBaseUrl = "http://" + finalBaseUrl;
      }
      if (finalBaseUrl.endsWith("/")) {
        finalBaseUrl = finalBaseUrl.slice(0, -1);
      }

      this.llm = new ChatOllama({
        model: safeModel,
        baseUrl: finalBaseUrl,
        temperature: llmSettings.temperature,
        topK: llmSettings.topK,
        topP: llmSettings.topP,
        frequencyPenalty: llmSettings.frequencyPenalty,
        presencePenalty: llmSettings.presencePenalty,
        repeatPenalty: llmSettings.repeatPenalty,
        streaming: false,
      });
    } else if (llmType === "gemini") {
      this.llm = createGeminiRunnable({
        apiKey: apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
        model: safeModel || "gemini-1.5-flash",
        baseUrl: baseUrl?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_BASE_URL || "",
        timeout: llmSettings.timeout,
        temperature: llmSettings.temperature,
        maxTokens: llmSettings.maxTokens,
        topP: llmSettings.topP,
        topK: llmSettings.topK,
      });
    }
  }

  setupDialogueChain(): void {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    const dialoguePrompt = ChatPromptTemplate.fromMessages([
      ["system", "{system_message}"],
      ["human", "{user_message}"],
    ]);

    // 创建可运行的对话链
    const assignRunnable = RunnableLambda.from((input: DialogueInput) => ({
      system_message: input.system_message,
      user_message: input.user_message,
    }));

    this.dialogueChain = assignRunnable
      .pipe(dialoguePrompt)
      .pipe(this.llm as unknown as RunnableLike<ChatPromptValueInterface, string>)
      .pipe(new StringOutputParser());
  }
  
  async compressStory(userInput: string, story: string): Promise<string> {
    if (!this.llm) {
      throw new Error("LLM not initialized");
    }

    // 对于 Ollama 模型，可能需要设置 streaming 选项
    if (this.llmType === "ollama" && "streaming" in this.llm) {
      const llmWithStreaming = this.llm as { streaming?: boolean };
      llmWithStreaming.streaming = false;
    }

    try {
      let compressorPrompt;
      if (this.language === "zh") {
        compressorPrompt = ChatPromptTemplate.fromMessages([
          ["system", ""],
          ["user", getCharacterCompressorPromptZh(userInput, story)],
        ]);
      } else {
        compressorPrompt = ChatPromptTemplate.fromMessages([
          ["system", ""],
          ["user", getCharacterCompressorPromptEn(userInput, story)],
        ]);
      }

      const compressorChain = compressorPrompt
        .pipe(this.llm as unknown as RunnableLike<ChatPromptValueInterface, string>)
        .pipe(new StringOutputParser());
      const compressedStory = await compressorChain.invoke({});

      return compressedStory;
    } catch (error) {
      console.error("Error compressing story:", error);
      throw new Error(`Failed to compress story: ${error}`);
    }
  }
}
