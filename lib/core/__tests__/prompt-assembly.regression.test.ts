/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     消息拼装回归测试                                        ║
 * ║                                                                            ║
 * ║  基于真实角色卡和预设文件，验证消息拼装的正确性                              ║
 * ║  测试场景：Sgw3.card.json + 明月秋青v3.94.json + 用户输入"推进剧情"          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { STPromptManager, createPromptManagerFromOpenAI } from "../prompt";
import { STMacroEvaluator } from "../st-macro-evaluator";
import { PostProcessingMode } from "../st-preset-types";
import type { MacroEnv, STCombinedPreset, STOpenAIPreset } from "../st-preset-types";

/** 测试输出文件路径 */
const OUTPUT_FILE = path.join(process.cwd(), "lib/core/__tests__/prompt-assembly-output.json");

/** 角色卡数据结构 */
interface CharacterCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  data?: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    character_book?: {
      entries: Array<{
        keys: string[];
        content: string;
        enabled: boolean;
        position?: number;
        comment?: string;
      }>;
    };
  };
}

/** 预设消息结构 */
interface PresetMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 测试输出结构 */
interface TestOutput {
  testName: string;
  timestamp: string;
  inputs: {
    characterCardName: string;
    presetName: string;
    userInput: string;
  };
  outputs: {
    messageCount: number;
    messages: PresetMessage[];
  };
  assertions: {
    hasSystemMessage: boolean;
    hasUserMessage: boolean;
    messageCountValid: boolean;
  };
}

interface PromptAssemblyFixture {
  userInput: string;
  characterCard: CharacterCard;
  preset: STOpenAIPreset;
}

function readPhase4Fixture<T>(name: string): T {
  const filePath = path.join(
    process.cwd(),
    "lib/core/__tests__/fixtures/phase4",
    name,
  );
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

describe("消息拼装回归测试", () => {
  let characterCard: CharacterCard;
  let openaiPreset: STOpenAIPreset;
  let testOutput: TestOutput;

  let USER_INPUT = "推进剧情";

  beforeAll(() => {
    const fixture = readPhase4Fixture<PromptAssemblyFixture>("persona-macro.json");
    characterCard = fixture.characterCard;
    openaiPreset = fixture.preset;
    USER_INPUT = fixture.userInput;
  });

  describe("场景：Sgw3 + 明月秋青v3.94 + 推进剧情", () => {
    it("应该正确加载角色卡", () => {
      expect(characterCard).toBeDefined();
      expect(characterCard.name || characterCard.data?.name).toBeTruthy();
    });

    it("应该正确加载预设", () => {
      expect(openaiPreset).toBeDefined();
      expect(openaiPreset.prompts).toBeDefined();
      expect(Array.isArray(openaiPreset.prompts)).toBe(true);
    });

    it("应该通过 STPromptManager 正确构建消息", () => {
      const macroEvaluator = new STMacroEvaluator();
      const promptManager = createPromptManagerFromOpenAI(openaiPreset, undefined, macroEvaluator);

      const env: MacroEnv = {
        user: "用户",
        char: characterCard.name || characterCard.data?.name || "",
        description: characterCard.description || characterCard.data?.description || "",
        personality: characterCard.personality || characterCard.data?.personality || "",
        scenario: characterCard.scenario || characterCard.data?.scenario || "",
        persona: "",
        mesExamples: characterCard.mes_example || characterCard.data?.mes_example || "",
        wiBefore: "",
        wiAfter: "",
        chatHistory: "",
        lastUserMessage: USER_INPUT,
        userInput: USER_INPUT,
        number: 200,
        language: "zh",
      };

      const messages = promptManager.buildMessages(env);

      // 验证消息数组
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // 验证消息结构
      const hasSystemMessage = messages.some(m => m.role === "system");
      const hasUserMessage = messages.some(m => m.role === "user");
      const allContent = messages.map(m => m.content).join("\n");

      expect(hasSystemMessage).toBe(true);
      expect(allContent).toContain(USER_INPUT);
      expect(allContent).not.toContain("<context>");
      expect(allContent).not.toMatch(/\$\{[^}]+\}/);

      // 构建测试输出
      testOutput = {
        testName: "Sgw3 + 明月秋青v3.94 + 推进剧情",
        timestamp: new Date().toISOString(),
        inputs: {
          characterCardName: characterCard.name || characterCard.data?.name || "Unknown",
          presetName: "明月秋青v3.94",
          userInput: USER_INPUT,
        },
        outputs: {
          messageCount: messages.length,
          messages: messages as PresetMessage[],
        },
        assertions: {
          hasSystemMessage,
          hasUserMessage,
          messageCountValid: messages.length > 0,
        },
      };

      // 写入输出文件
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(testOutput, null, 2), "utf-8");
    });

    it("应该正确处理后处理模式选项", () => {
      const macroEvaluator = new STMacroEvaluator();
      const promptManager = createPromptManagerFromOpenAI(openaiPreset, undefined, macroEvaluator);

      const env: MacroEnv = {
        user: "用户",
        char: characterCard.name || characterCard.data?.name || "",
        description: characterCard.description || characterCard.data?.description || "",
        personality: characterCard.personality || characterCard.data?.personality || "",
        scenario: characterCard.scenario || characterCard.data?.scenario || "",
        persona: "",
        mesExamples: characterCard.mes_example || characterCard.data?.mes_example || "",
        wiBefore: "世界书前置内容",
        wiAfter: "世界书后置内容",
        chatHistory: "",
        lastUserMessage: USER_INPUT,
        userInput: USER_INPUT,
        number: 200,
        language: "zh",
      };

      // 测试默认模式（不做后处理）
      const messagesDefault = promptManager.buildMessages(env, {});
      expect(messagesDefault.length).toBeGreaterThan(0);

      // 测试 MERGE 模式（合并连续同角色消息）
      const messagesMerge = promptManager.buildMessages(env, {
        postProcessingMode: PostProcessingMode.MERGE,
        promptNames: {
          charName: "角色",
          userName: "用户",
          groupNames: [],
          startsWithGroupName: () => false,
        },
      });
      expect(messagesMerge.length).toBeGreaterThan(0);

      // MERGE 模式后的消息数应该 <= 默认模式的消息数
      expect(messagesMerge.length).toBeLessThanOrEqual(messagesDefault.length);
    });
  });

  describe("STPromptManager 核心功能", () => {
    it("应该正确获取排序后的 prompts", () => {
      const promptManager = createPromptManagerFromOpenAI(openaiPreset);
      const orderedPrompts = promptManager.getOrderedPrompts();

      expect(Array.isArray(orderedPrompts)).toBe(true);
      expect(orderedPrompts.length).toBeGreaterThan(0);
    });

    it("应该正确获取采样参数", () => {
      const promptManager = createPromptManagerFromOpenAI(openaiPreset);
      const params = promptManager.getSamplingParams();

      expect(params).toBeDefined();
      expect(typeof params.temperature).toBe("number");
      expect(typeof params.max_tokens).toBe("number");
    });

    it("应该正确处理 marker 类型的 prompt", () => {
      const macroEvaluator = new STMacroEvaluator();
      const promptManager = createPromptManagerFromOpenAI(openaiPreset, undefined, macroEvaluator);

      const env: MacroEnv = {
        user: "测试用户",
        char: "测试角色",
        description: "这是角色描述",
        personality: "这是角色性格",
        scenario: "这是场景",
        persona: "这是用户人设",
        mesExamples: "这是对话示例",
        wiBefore: "世界书前置",
        wiAfter: "世界书后置",
        chatHistory: "",
        number: 100,
        language: "zh",
      };

      const messages = promptManager.buildMessages(env);

      // 验证 marker 内容被正确替换
      const allContent = messages.map(m => m.content).join("\n");
      expect(allContent).toContain("这是角色描述");
    });
  });

  describe("边界情况", () => {
    it("空环境变量应该不会导致崩溃", () => {
      const promptManager = createPromptManagerFromOpenAI(openaiPreset);

      const emptyEnv: MacroEnv = {
        user: "",
        char: "",
        description: "",
        personality: "",
        scenario: "",
        persona: "",
        mesExamples: "",
        wiBefore: "",
        wiAfter: "",
        chatHistory: "",
        number: 0,
        language: "zh",
      };

      expect(() => promptManager.buildMessages(emptyEnv)).not.toThrow();
    });

    it("应该正确处理 chatHistoryMessages", () => {
      const macroEvaluator = new STMacroEvaluator();
      const promptManager = createPromptManagerFromOpenAI(openaiPreset, undefined, macroEvaluator);

      const env: MacroEnv = {
        user: "用户",
        char: "角色",
        description: "",
        personality: "",
        scenario: "",
        persona: "",
        mesExamples: "",
        wiBefore: "",
        wiAfter: "",
        chatHistory: "",
        chatHistoryMessages: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好！有什么可以帮助你的？" },
        ],
        number: 100,
        language: "zh",
      };

      const messages = promptManager.buildMessages(env);
      const allContent = messages.map(m => m.content).join("\n");

      // 验证聊天历史被包含
      expect(allContent).toContain("你好");
    });
  });
});
