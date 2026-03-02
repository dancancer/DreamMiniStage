/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               正则处理系统基线测试（SillyTavern 对标）                      ║
 * ║                                                                            ║
 * ║  测试当前项目的正则处理引擎与 SillyTavern extensions/regex/engine.js      ║
 * ║  的行为一致性。                                                             ║
 * ║                                                                            ║
 * ║  覆盖范围：                                                                 ║
 * ║  1. 基础正则替换（匹配、捕获组、替换）                                      ║
 * ║  2. Placement 过滤（USER_INPUT, AI_OUTPUT, etc.）                          ║
 * ║  3. 宏替换集成（substituteRegex 模式）                                      ║
 * ║  4. 标志位过滤（markdownOnly, promptOnly）                                 ║
 * ║  5. 深度约束（minDepth, maxDepth）                                         ║
 * ║  6. 正则编译和回退策略                                                      ║
 * ║  7. 边界情况和错误处理                                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { RegexPlacement, shouldExecuteScript } from "@/lib/core/regex-processor";
import type { RegexScript } from "@/lib/models/regex-script-model";
import { SubstituteRegexMode } from "@/lib/models/regex-script-model";
import { substitute } from "@/lib/core/macro-substitutor";
import { setupDeterministicEnv, teardownDeterministicEnv } from "./baseline-helpers";

// ════════════════════════════════════════════════════════════════════════════
//   测试辅助函数：简化的正则处理器
// ════════════════════════════════════════════════════════════════════════════

/**
 * 简化的正则处理器，用于基线测试
 * 不依赖存储层，直接对脚本数组进行处理
 */
function processTextWithScripts(
  text: string,
  scripts: RegexScript[],
  options: {
    placement?: RegexPlacement;
    isMarkdown?: boolean;
    isPrompt?: boolean;
    depth?: number;
    macroParams?: Record<string, string>;
  } = {},
): { replacedText: string; appliedScripts: string[] } {
  let result = text;
  const appliedScripts: string[] = [];

  for (const script of scripts) {
    // 检查脚本是否应该执行
    const shouldExecute = shouldExecuteScript(script, {
      ownerId: "test",
      ...options,
    });

    if (!shouldExecute) {
      continue;
    }

    // 编译正则
    let pattern = script.findRegex;

    // 应用宏替换
    if (script.substituteRegex && options.macroParams) {
      if (script.substituteRegex === SubstituteRegexMode.RAW) {
        pattern = substitute(pattern, options.macroParams, SubstituteRegexMode.RAW);
      } else if (script.substituteRegex === SubstituteRegexMode.ESCAPED) {
        pattern = substitute(pattern, options.macroParams, SubstituteRegexMode.ESCAPED);
      }
    }

    // 移除 /pattern/flags 格式
    const regexMatch = pattern.match(/^\/(.*)\/([gimsuy]*)$/);
    let regex: RegExp;

    try {
      if (regexMatch) {
        regex = new RegExp(regexMatch[1], regexMatch[2] || "g");
      } else {
        // 直接作为模式编译
        try {
          regex = new RegExp(pattern, "g");
        } catch {
          // 回退到字面量
          regex = new RegExp(pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g");
        }
      }
    } catch {
      continue;
    }

    // 执行替换
    let replaceStr = script.replaceString ?? "";

    // 应用宏替换到 replaceString
    if (options.macroParams) {
      replaceStr = substitute(replaceStr, options.macroParams, SubstituteRegexMode.RAW);
    }

    // 执行正则替换
    const newResult = result.replace(regex, (...args) => {
      const captures = args.slice(1, -2);

      // 替换 $1, $2, ... 为捕获组
      const replaced = replaceStr.replace(/\$(\d+)/g, (_, n) => {
        const index = parseInt(n) - 1;
        return captures[index] ?? `$${n}`;
      });

      return replaced;
    });

    if (newResult !== result) {
      appliedScripts.push(script.scriptName || script.scriptKey);
      result = newResult;
    }
  }

  return { replacedText: result, appliedScripts };
}

// ════════════════════════════════════════════════════════════════════════════
//   测试套件
// ════════════════════════════════════════════════════════════════════════════

describe("正则处理系统基线测试", () => {
  beforeAll(() => {
    setupDeterministicEnv(vi);
  });

  afterAll(() => {
    teardownDeterministicEnv(vi);
  });

  // 测试组 1：基础正则替换
  describe("基础正则替换", () => {
    it("应正确执行简单的字符串替换", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "test1",
        scriptName: "简单替换",
        findRegex: "hello",
        replaceString: "你好",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("hello world", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("你好 world");
      expect(result.appliedScripts).toHaveLength(1);
    });

    it("应支持全局匹配（多次替换）", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "test2",
        scriptName: "全局替换",
        findRegex: "a",
        replaceString: "A",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("banana", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("bAnAnA");
    });

    it("应支持正则表达式模式匹配", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "test3",
        scriptName: "模式匹配",
        findRegex: "/\\d+/g",
        replaceString: "[数字]",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("我有123个苹果和456个橙子", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("我有[数字]个苹果和[数字]个橙子");
    });

    it("应支持捕获组和 $1, $2 引用", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "test4",
        scriptName: "捕获组",
        findRegex: "/(\\w+)\\s+(\\w+)/g",
        replaceString: "$2 $1",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("hello world", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("world hello");
    });

    it("应支持大小写不敏感匹配（/i 标志）", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "test5",
        scriptName: "大小写不敏感",
        findRegex: "/HELLO/gi",
        replaceString: "你好",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("Hello hello HELLO", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("你好 你好 你好");
    });
  });

  // 测试组 2：Placement 过滤
  describe("Placement 过滤", () => {
    it("脚本应只在指定的 placement 中执行", () => {
      const script: RegexScript = {
        scriptKey: "placement1",
        scriptName: "仅 AI 输出",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      };

      // AI_OUTPUT 场景：应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
      })).toBe(true);

      // USER_INPUT 场景：不应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.USER_INPUT,
      })).toBe(false);
    });

    it("脚本应支持多个 placement", () => {
      const script: RegexScript = {
        scriptKey: "placement2",
        scriptName: "多 placement",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.USER_INPUT, RegexPlacement.AI_OUTPUT],
      };

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.USER_INPUT,
      })).toBe(true);

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
      })).toBe(true);

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.SLASH_COMMAND,
      })).toBe(false);
    });

    it("空 placement 数组应在所有场景执行", () => {
      const script: RegexScript = {
        scriptKey: "placement3",
        scriptName: "无限制",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [],
      };

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.USER_INPUT,
      })).toBe(true);

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
      })).toBe(true);
    });
  });

  // 测试组 3：宏替换集成
  describe("宏替换集成", () => {
    it("应支持在 replaceString 中使用宏", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "macro1",
        scriptName: "替换字符串中的宏",
        findRegex: "你好",
        replaceString: "{{user}}说你好",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("你好，世界", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
        macroParams: { user: "张三" },
      });

      expect(result.replacedText).toBe("张三说你好，世界");
    });

    it("应支持 SubstituteRegexMode.RAW 模式（findRegex 中的宏不转义）", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "macro2",
        scriptName: "RAW 模式宏",
        findRegex: "{{pattern}}",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        substituteRegex: SubstituteRegexMode.RAW,
      }];

      const result = processTextWithScripts("数字123和456", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
        macroParams: { pattern: "\\d+" }, // 数字模式
      });

      expect(result.replacedText).toBe("数字替换和替换");
    });

    it("应支持 SubstituteRegexMode.ESCAPED 模式（findRegex 中的宏转义）", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "macro3",
        scriptName: "ESCAPED 模式宏",
        findRegex: "{{literal}}",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        substituteRegex: SubstituteRegexMode.ESCAPED,
      }];

      const result = processTextWithScripts("句子.结束", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
        macroParams: { literal: "." }, // 点号会被转义为 \.
      });

      expect(result.replacedText).toBe("句子替换结束");
    });
  });

  // 测试组 4：标志位过滤
  describe("标志位过滤", () => {
    it("markdownOnly 脚本应只在 Markdown 场景执行", () => {
      const script: RegexScript = {
        scriptKey: "flag1",
        scriptName: "仅 Markdown",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        markdownOnly: true,
      };

      // Markdown 场景：应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        isMarkdown: true,
      })).toBe(true);

      // 非 Markdown 场景：不应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        isMarkdown: false,
      })).toBe(false);
    });

    it("promptOnly 脚本应只在 Prompt 场景执行", () => {
      const script: RegexScript = {
        scriptKey: "flag2",
        scriptName: "仅 Prompt",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        promptOnly: true,
      };

      // Prompt 场景：应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        isPrompt: true,
      })).toBe(true);

      // 非 Prompt 场景：不应执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        isPrompt: false,
      })).toBe(false);
    });

    it("disabled 脚本应始终被跳过", () => {
      const script: RegexScript = {
        scriptKey: "flag3",
        scriptName: "禁用的脚本",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        disabled: true,
      };

      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
      })).toBe(false);
    });
  });

  // 测试组 5：深度约束
  describe("深度约束", () => {
    it("应尊重 minDepth 约束", () => {
      const script: RegexScript = {
        scriptKey: "depth1",
        scriptName: "最小深度",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        minDepth: 5,
      };

      // 深度 < minDepth：不执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        depth: 3,
      })).toBe(false);

      // 深度 >= minDepth：执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        depth: 5,
      })).toBe(true);
    });

    it("应尊重 maxDepth 约束", () => {
      const script: RegexScript = {
        scriptKey: "depth2",
        scriptName: "最大深度",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
        maxDepth: 10,
      };

      // 深度 <= maxDepth：执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        depth: 5,
      })).toBe(true);

      // 深度 > maxDepth：不执行
      expect(shouldExecuteScript(script, {
        ownerId: "test",
        placement: RegexPlacement.AI_OUTPUT,
        depth: 15,
      })).toBe(false);
    });
  });

  // 测试组 6：边界情况
  describe("边界情况和错误处理", () => {
    it("应处理空文本输入", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "edge1",
        scriptName: "空文本",
        findRegex: "test",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("");
      expect(result.appliedScripts).toHaveLength(0);
    });

    it("应处理无匹配的情况", () => {
      const scripts: RegexScript[] = [{
        scriptKey: "edge2",
        scriptName: "无匹配",
        findRegex: "xyz",
        replaceString: "替换",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      }];

      const result = processTextWithScripts("hello world", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      expect(result.replacedText).toBe("hello world");
      expect(result.appliedScripts).toHaveLength(0);
    });

    it("应按顺序执行多个脚本", () => {
      const scripts: RegexScript[] = [
        {
          scriptKey: "order1",
          scriptName: "第一步",
          findRegex: "A",
          replaceString: "B",
          trimStrings: [],
          placement: [RegexPlacement.AI_OUTPUT],
        },
        {
          scriptKey: "order2",
          scriptName: "第二步",
          findRegex: "B",
          replaceString: "C",
          trimStrings: [],
          placement: [RegexPlacement.AI_OUTPUT],
        },
      ];

      const result = processTextWithScripts("A", scripts, {
        placement: RegexPlacement.AI_OUTPUT,
      });

      // A -> B -> C
      expect(result.replacedText).toBe("C");
      expect(result.appliedScripts).toHaveLength(2);
    });
  });
});
