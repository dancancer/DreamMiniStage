/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   完整对话流程基线测试（Layer 2 集成）                      ║
 * ║                                                                            ║
 * ║  测试多模块协同工作时的完整对话流程，验证：                                  ║
 * ║  1. 输入处理管线（宏替换 → 正则处理 → 世界书匹配）                          ║
 * ║  2. 提示装配（系统提示 + 角色卡 + 世界书 + 历史消息）                       ║
 * ║  3. 响应处理管线（正则处理 → MVU 变量更新）                                 ║
 * ║  4. 多轮对话中的状态保持                                                    ║
 * ║  5. 与 SillyTavern 完整体验的对齐                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { WorldBookManager } from "@/lib/core/world-book";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import type { RegexScript } from "@/lib/models/regex-model";
import { setupDeterministicEnv, teardownDeterministicEnv } from "./baseline-helpers";

// ════════════════════════════════════════════════════════════════════════════
//   类型定义
// ════════════════════════════════════════════════════════════════════════════

/**
 * 对话流程执行结果
 */
interface DialogueFlowResult {
  processedInput: string;        // 处理后的用户输入
  matchedWorldBookEntries: WorldBookEntry[];  // 匹配的世界书条目
  assembledPrompt: string;        // 装配的提示
  simulatedResponse: string;      // 模拟的 AI 响应
  processedResponse: string;      // 处理后的 AI 响应
  updatedHistory: DialogueMessage[];  // 更新后的历史
}

/**
 * 对话流程配置
 */
interface DialogueFlowConfig {
  userInput: string;
  macroEnv: MacroEnv;
  worldBook: WorldBookEntry[];
  regexScripts: RegexScript[];
  history: DialogueMessage[];
  systemPrompt: string;
  characterCard: string;
}

// ════════════════════════════════════════════════════════════════════════════
//   测试辅助函数
// ════════════════════════════════════════════════════════════════════════════

/**
 * 执行完整的对话流程
 *
 * 流程：
 * 1. 用户输入 → 宏替换
 * 2. 宏替换后的输入 → 正则处理（USER_INPUT）
 * 3. 正则处理后的输入 → 世界书匹配
 * 4. 装配提示（系统提示 + 角色卡 + 世界书 + 历史 + 用户输入）
 * 5. 模拟 LLM 响应
 * 6. AI 响应 → 正则处理（AI_OUTPUT）
 * 7. 更新历史消息
 */
function executeDialogueFlow(config: DialogueFlowConfig): DialogueFlowResult {
  const {
    userInput,
    macroEnv,
    worldBook,
    regexScripts,
    history,
    systemPrompt,
    characterCard,
  } = config;

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 1: 用户输入 → 宏替换
  // ──────────────────────────────────────────────────────────────────────────
  const macroEvaluator = new STMacroEvaluator();
  let processedInput = macroEvaluator.evaluate(userInput, macroEnv);

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 2: 宏替换后的输入 → 正则处理（USER_INPUT）
  // ──────────────────────────────────────────────────────────────────────────
  const userInputScripts = regexScripts.filter((script) =>
    script.placement?.includes("USER_INPUT") || script.placement === undefined,
  );

  for (const script of userInputScripts) {
    if (script.disabled) continue;

    // 应用 findRegex（先替换宏）
    const findRegex = macroEvaluator.evaluate(script.findRegex || "", macroEnv);
    const replaceString = macroEvaluator.evaluate(script.replaceString || "", macroEnv);

    const regex = compileRegex(findRegex);
    if (regex) {
      processedInput = processedInput.replace(regex, replaceString);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 3: 正则处理后的输入 → 世界书匹配
  // ──────────────────────────────────────────────────────────────────────────
  const matchedWorldBookEntries = WorldBookManager.getMatchingEntries(
    worldBook,
    processedInput,
    history,
    { contextWindow: 10 },
  );

  // 处理世界书内容中的宏
  matchedWorldBookEntries.forEach((entry) => {
    entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 4: 装配提示
  // ──────────────────────────────────────────────────────────────────────────
  const worldBookContents = matchedWorldBookEntries
    .map((entry) => entry.content)
    .join("\n\n");

  const historyText = history
    .map((msg) => `${msg.role === "user" ? "用户" : "助手"}: ${msg.content}`)
    .join("\n");

  // 对系统提示和角色卡应用宏替换
  const processedSystemPrompt = macroEvaluator.evaluate(systemPrompt, macroEnv);
  const processedCharacterCard = macroEvaluator.evaluate(characterCard, macroEnv);

  const assembledPrompt = [
    processedSystemPrompt,
    processedCharacterCard,
    worldBookContents,
    historyText,
    `用户: ${processedInput}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 5: 模拟 LLM 响应
  // ──────────────────────────────────────────────────────────────────────────
  // 在真实场景中，这里会调用 LLM
  // 在测试中，我们返回一个确定性的模拟响应
  const simulatedResponse = `[模拟响应] 针对输入"${processedInput}"的回复`;

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 6: AI 响应 → 正则处理（AI_OUTPUT）
  // ──────────────────────────────────────────────────────────────────────────
  let processedResponse = simulatedResponse;
  const aiOutputScripts = regexScripts.filter((script) =>
    script.placement?.includes("AI_OUTPUT"),
  );

  for (const script of aiOutputScripts) {
    if (script.disabled) continue;

    const findRegex = macroEvaluator.evaluate(script.findRegex || "", macroEnv);
    const replaceString = macroEvaluator.evaluate(script.replaceString || "", macroEnv);

    const regex = compileRegex(findRegex);
    if (regex) {
      processedResponse = processedResponse.replace(regex, replaceString);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 步骤 7: 更新历史消息
  // ──────────────────────────────────────────────────────────────────────────
  const updatedHistory: DialogueMessage[] = [
    ...history,
    {
      role: "user",
      content: processedInput,
      timestamp: Date.now(),
    } as DialogueMessage,
    {
      role: "assistant",
      content: processedResponse,
      timestamp: Date.now() + 1,
    } as DialogueMessage,
  ];

  return {
    processedInput,
    matchedWorldBookEntries,
    assembledPrompt,
    simulatedResponse,
    processedResponse,
    updatedHistory,
  };
}

/**
 * 创建简化的对话消息
 */
function createMessage(role: "user" | "assistant", content: string): DialogueMessage {
  return {
    role,
    content,
    timestamp: Date.now(),
  } as DialogueMessage;
}

/**
 * 编译正则表达式（支持 /pattern/flags 格式）
 */
function compileRegex(pattern: string): RegExp | null {
  try {
    // 移除 /pattern/flags 格式
    const regexMatch = pattern.match(/^\/(.*)\/([gimsuy]*)$/);

    if (regexMatch) {
      return new RegExp(regexMatch[1], regexMatch[2] || "g");
    } else {
      // 直接作为模式编译
      try {
        return new RegExp(pattern, "g");
      } catch {
        // 回退到字面量匹配
        return new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g");
      }
    }
  } catch {
    return null;
  }
}

/**
 * 创建简化的世界书条目
 */
function createWorldBookEntry(
  keys: string[],
  content: string,
  options: Partial<WorldBookEntry> = {},
): WorldBookEntry {
  return {
    keys,
    content,
    selective: true,
    constant: false,
    position: 4,
    enabled: true,
    ...options,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//   测试套件
// ════════════════════════════════════════════════════════════════════════════

describe("完整对话流程基线测试", () => {
  beforeAll(() => {
    setupDeterministicEnv(vi);
  });

  afterAll(() => {
    teardownDeterministicEnv(vi);
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 1: 单轮对话完整流程
  // ──────────────────────────────────────────────────────────────────────────

  describe("单轮对话完整流程", () => {
    it("应正确执行 宏替换 → 正则处理 → 世界书 → 提示装配 的管线", () => {
      const macroEnv: MacroEnv = {
        user: "Alice",
        char: "Bob",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "去除多余空格",
          findRegex: "\\s+",
          replaceString: " ",
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["魔法"], "魔法系统：使用魔力施法"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "你好，{{user}}想学习   魔法",
        macroEnv,
        worldBook,
        regexScripts,
        history: [],
        systemPrompt: "你是一个友好的助手",
        characterCard: "角色：{{char}}",
      };

      const result = executeDialogueFlow(config);

      // 验证宏替换
      expect(result.processedInput).toContain("Alice");

      // 验证正则处理（去除多余空格）
      expect(result.processedInput).toBe("你好，Alice想学习 魔法");

      // 验证世界书匹配
      expect(result.matchedWorldBookEntries).toHaveLength(1);
      expect(result.matchedWorldBookEntries[0].content).toBe("魔法系统：使用魔力施法");

      // 验证提示装配
      expect(result.assembledPrompt).toContain("你是一个友好的助手");
      expect(result.assembledPrompt).toContain("角色：Bob");
      expect(result.assembledPrompt).toContain("魔法系统：使用魔力施法");
      expect(result.assembledPrompt).toContain("用户: 你好，Alice想学习 魔法");

      // 验证历史更新
      expect(result.updatedHistory).toHaveLength(2);
      expect(result.updatedHistory[0].role).toBe("user");
      expect(result.updatedHistory[1].role).toBe("assistant");
    });

    it("应在世界书内容中正确应用宏替换", () => {
      const macroEnv: MacroEnv = {
        user: "玩家",
        char: "导师",
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["魔法"], "{{char}}教导{{user}}如何使用魔法"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "学习魔法",
        macroEnv,
        worldBook,
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 验证世界书内容中的宏被替换
      expect(result.matchedWorldBookEntries[0].content).toBe("导师教导玩家如何使用魔法");
      expect(result.assembledPrompt).toContain("导师教导玩家如何使用魔法");
    });

    it("应在正则的 replaceString 中正确应用宏替换", () => {
      const macroEnv: MacroEnv = {
        user: "Alice",
        char: "Bob",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "替换为用户名",
          findRegex: "某人",
          replaceString: "{{user}}",
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "某人想聊天",
        macroEnv,
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      expect(result.processedInput).toBe("Alice想聊天");
    });

    it("应正确应用 AI_OUTPUT placement 的正则", () => {
      const macroEnv: MacroEnv = {
        char: "助手",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "清理响应",
          findRegex: "\\[模拟响应\\] ",
          replaceString: "",
          placement: ["AI_OUTPUT"],
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "你好",
        macroEnv,
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 模拟响应原本包含 "[模拟响应]"
      expect(result.simulatedResponse).toContain("[模拟响应]");

      // 处理后的响应应去除 "[模拟响应]"
      expect(result.processedResponse).not.toContain("[模拟响应]");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 2: 多轮对话状态保持
  // ──────────────────────────────────────────────────────────────────────────

  describe("多轮对话状态保持", () => {
    it("历史消息应正确累积", () => {
      const macroEnv: MacroEnv = {
        user: "用户",
        char: "角色",
        language: "zh",
      };

      const config: DialogueFlowConfig = {
        userInput: "第一轮输入",
        macroEnv,
        worldBook: [],
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      // 第一轮
      const result1 = executeDialogueFlow(config);
      expect(result1.updatedHistory).toHaveLength(2);

      // 第二轮（使用第一轮的历史）
      const result2 = executeDialogueFlow({
        ...config,
        userInput: "第二轮输入",
        history: result1.updatedHistory,
      });
      expect(result2.updatedHistory).toHaveLength(4);

      // 验证历史顺序
      expect(result2.updatedHistory[0].content).toContain("第一轮输入");
      expect(result2.updatedHistory[1].role).toBe("assistant");
      expect(result2.updatedHistory[2].content).toContain("第二轮输入");
      expect(result2.updatedHistory[3].role).toBe("assistant");
    });

    it("世界书匹配应考虑历史消息", () => {
      const macroEnv: MacroEnv = {
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["城堡"], "城堡描述：高耸的塔楼"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "我们到了",
        macroEnv,
        worldBook,
        regexScripts: [],
        history: [
          createMessage("user", "我们去城堡"),
          createMessage("assistant", "好的，出发"),
        ],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 虽然当前输入没有"城堡"，但历史中有，应匹配
      expect(result.matchedWorldBookEntries).toHaveLength(1);
      expect(result.matchedWorldBookEntries[0].content).toContain("城堡描述");
    });

    it("多轮对话中提示应包含完整历史", () => {
      const macroEnv: MacroEnv = {
        language: "zh",
      };

      const config: DialogueFlowConfig = {
        userInput: "继续",
        macroEnv,
        worldBook: [],
        regexScripts: [],
        history: [
          createMessage("user", "第一句话"),
          createMessage("assistant", "第一回复"),
          createMessage("user", "第二句话"),
          createMessage("assistant", "第二回复"),
        ],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 提示应包含所有历史
      expect(result.assembledPrompt).toContain("第一句话");
      expect(result.assembledPrompt).toContain("第一回复");
      expect(result.assembledPrompt).toContain("第二句话");
      expect(result.assembledPrompt).toContain("第二回复");
      expect(result.assembledPrompt).toContain("继续");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 3: 处理管线协作
  // ──────────────────────────────────────────────────────────────────────────

  describe("处理管线协作", () => {
    it("宏替换 → 正则处理 管线应正确工作", () => {
      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "全部小写",
          findRegex: "ALICE",
          replaceString: "alice",
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "我是{{user}}",  // 宏替换 → "我是Alice"
        macroEnv,
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 宏替换先执行，然后正则处理
      // 但由于宏替换后是 "Alice" 不是 "ALICE"，正则不匹配
      expect(result.processedInput).toBe("我是Alice");
    });

    it("正则处理中的 replaceString 应支持宏", () => {
      const macroEnv: MacroEnv = {
        user: "替换者",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "动态替换",
          findRegex: "XX",
          replaceString: "{{user}}",  // replaceString 中使用宏
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "你好XX",
        macroEnv,
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      expect(result.processedInput).toBe("你好替换者");
    });

    it("世界书 → 宏替换 → 提示装配 管线应正确工作", () => {
      const macroEnv: MacroEnv = {
        user: "冒险者",
        char: "NPC",
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["城市"], "{{char}}在城市中遇到了{{user}}"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "进入城市",
        macroEnv,
        worldBook,
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 世界书内容中的宏应被替换
      expect(result.assembledPrompt).toContain("NPC在城市中遇到了冒险者");
    });

    it("完整管线：宏 → 正则 → 世界书 → 宏 → 装配", () => {
      const macroEnv: MacroEnv = {
        user: "玩家",
        char: "守卫",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "标准化关键词",
          findRegex: "进城",
          replaceString: "进入城门",
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["城门"], "{{char}}守卫着城门，询问{{user}}的身份"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "我想进城",  // 1. 宏替换（无宏）
        macroEnv,
        worldBook,
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 2. 正则处理："进城" → "进入城门"
      expect(result.processedInput).toBe("我想进入城门");

      // 3. 世界书匹配："城门" → 激活条目
      expect(result.matchedWorldBookEntries).toHaveLength(1);

      // 4. 世界书内容宏替换
      expect(result.matchedWorldBookEntries[0].content).toBe("守卫守卫着城门，询问玩家的身份");

      // 5. 提示装配
      expect(result.assembledPrompt).toContain("守卫守卫着城门，询问玩家的身份");
      expect(result.assembledPrompt).toContain("我想进入城门");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 4: 边界情况和错误处理
  // ──────────────────────────────────────────────────────────────────────────

  describe("边界情况和错误处理", () => {
    it("应处理空的世界书", () => {
      const config: DialogueFlowConfig = {
        userInput: "你好",
        macroEnv: { language: "zh" },
        worldBook: [],
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      expect(result.matchedWorldBookEntries).toHaveLength(0);
      expect(result.processedInput).toBe("你好");
    });

    it("应处理空的正则脚本数组", () => {
      const config: DialogueFlowConfig = {
        userInput: "你好",
        macroEnv: { language: "zh" },
        worldBook: [],
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      expect(result.processedInput).toBe("你好");
    });

    it("应跳过 disabled 的正则脚本", () => {
      const regexScripts: RegexScript[] = [
        {
          scriptName: "禁用的脚本",
          findRegex: "你好",
          replaceString: "您好",
          placement: ["USER_INPUT"],
          disabled: true,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "你好",
        macroEnv: { language: "zh" },
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 脚本被禁用，输入不应改变
      expect(result.processedInput).toBe("你好");
    });

    it("应处理无效的正则表达式", () => {
      const regexScripts: RegexScript[] = [
        {
          scriptName: "无效正则",
          findRegex: "[[[invalid",  // 无效的正则
          replaceString: "替换",
          placement: ["USER_INPUT"],
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "你好",
        macroEnv: { language: "zh" },
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 无效的正则应被跳过，输入不应改变
      expect(result.processedInput).toBe("你好");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 5: SillyTavern 行为对齐
  // ──────────────────────────────────────────────────────────────────────────

  describe("SillyTavern 行为对齐", () => {
    it("placement 为 undefined 的正则应应用于所有阶段", () => {
      const regexScripts: RegexScript[] = [
        {
          scriptName: "全局脚本",
          findRegex: "测试",
          replaceString: "验证",
          placement: undefined,  // 未指定 placement
          disabled: false,
        },
      ];

      const config: DialogueFlowConfig = {
        userInput: "这是测试",
        macroEnv: { language: "zh" },
        worldBook: [],
        regexScripts,
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // SillyTavern 行为：placement 未指定时，应用于 USER_INPUT
      expect(result.processedInput).toBe("这是验证");
    });

    it("常量世界书条目应始终被包含", () => {
      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry([], "这是常量设定", {
          constant: true,
          keys: [],
        }),
      ];

      const config: DialogueFlowConfig = {
        userInput: "随便说点什么",
        macroEnv: { language: "zh" },
        worldBook,
        regexScripts: [],
        history: [],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      expect(result.matchedWorldBookEntries).toHaveLength(1);
      expect(result.assembledPrompt).toContain("这是常量设定");
    });

    it("世界书应在历史消息窗口内搜索关键词", () => {
      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["古老"], "古老的传说"),
      ];

      const config: DialogueFlowConfig = {
        userInput: "继续讲故事",
        macroEnv: { language: "zh" },
        worldBook,
        regexScripts: [],
        history: [
          createMessage("user", "给我讲一个古老的故事"),
          createMessage("assistant", "好的"),
        ],
        systemPrompt: "",
        characterCard: "",
      };

      const result = executeDialogueFlow(config);

      // 关键词"古老"在历史中，应匹配
      expect(result.matchedWorldBookEntries).toHaveLength(1);
    });
  });
});
