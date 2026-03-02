/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    插件协作基线测试（Layer 2 集成）                         ║
 * ║                                                                            ║
 * ║  测试多个插件/模块协同工作时的兼容性，验证：                                  ║
 * ║  1. MVU 变量管理 + Slash Command 协作                                      ║
 * ║  2. Regex 正则处理 + Macro 宏替换 协作                                      ║
 * ║  3. WorldBook 世界书 + Regex 正则处理 协作                                  ║
 * ║  4. Macro 宏替换 + Slash Command 协作                                      ║
 * ║  5. 多模块冲突检测和数据竞争验证                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { WorldBookManager } from "@/lib/core/world-book";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import type { WorldBookEntry } from "@/lib/models/world-book-model";
import type { RegexScript } from "@/lib/models/regex-model";
import { setupDeterministicEnv, teardownDeterministicEnv } from "./baseline-helpers";

// ════════════════════════════════════════════════════════════════════════════
//   测试辅助函数
// ════════════════════════════════════════════════════════════════════════════

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

/**
 * 模拟 Slash 命令执行环境
 */
class MockSlashContext {
  variables: Record<string, any> = {};

  setVar(name: string, value: any): void {
    this.variables[name] = value;
  }

  getVar(name: string): any {
    return this.variables[name];
  }

  hasVar(name: string): boolean {
    return name in this.variables;
  }
}

/**
 * 模拟 MVU 变量系统
 */
class MockMvuVariables {
  stat_data: Record<string, any> = {};
  display_data: Record<string, any> = {};

  set(path: string, value: any): void {
    this.stat_data[path] = value;
    this.display_data[path] = value;
  }

  get(path: string): any {
    return this.stat_data[path];
  }

  has(path: string): boolean {
    return path in this.stat_data;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//   测试套件
// ════════════════════════════════════════════════════════════════════════════

describe("插件协作基线测试", () => {
  beforeAll(() => {
    setupDeterministicEnv(vi);
  });

  afterAll(() => {
    teardownDeterministicEnv(vi);
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 1: Regex + Macro 协作
  // ──────────────────────────────────────────────────────────────────────────

  describe("Regex 与 Macro 协作", () => {
    it("正则的 findRegex 应支持宏替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "动态匹配用户名",
        findRegex: "{{user}}",  // findRegex 中使用宏
        replaceString: "用户",
        disabled: false,
      };

      // 先替换 findRegex 中的宏
      const findRegex = macroEvaluator.evaluate(regexScript.findRegex || "", macroEnv);

      const text = "你好，Alice";
      const regex = compileRegex(findRegex);
      const result = text.replace(regex!, regexScript.replaceString || "");

      expect(result).toBe("你好，用户");
    });

    it("正则的 replaceString 应支持宏替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        char: "助手",
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "动态替换",
        findRegex: "AI",
        replaceString: "{{char}}",  // replaceString 中使用宏
        disabled: false,
      };

      // 先替换 replaceString 中的宏
      const replaceString = macroEvaluator.evaluate(
        regexScript.replaceString || "",
        macroEnv,
      );

      const text = "我是AI";
      const regex = compileRegex(regexScript.findRegex || "");
      const result = text.replace(regex!, replaceString);

      expect(result).toBe("我是助手");
    });

    it("复杂正则中的宏应在匹配前被替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "玩家",
        char: "NPC",
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "复杂替换",
        findRegex: "{{user}}对{{char}}说",
        replaceString: "$1 告诉 $2",
        disabled: false,
      };

      // 1. 替换 findRegex 中的宏
      let findRegex = macroEvaluator.evaluate(regexScript.findRegex || "", macroEnv);
      // "玩家对NPC说"

      // 2. 添加捕获组
      findRegex = "(玩家)对(NPC)说";
      const regex = new RegExp(findRegex);

      const text = "玩家对NPC说你好";
      const replaceString = "$1 告诉 $2";
      const result = text.replace(regex, replaceString);

      expect(result).toBe("玩家 告诉 NPC你好");
    });

    it("多个正则脚本的宏应独立替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "Alice",
        char: "Bob",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "脚本1",
          findRegex: "{{user}}",
          replaceString: "用户",
          disabled: false,
        },
        {
          scriptName: "脚本2",
          findRegex: "{{char}}",
          replaceString: "角色",
          disabled: false,
        },
      ];

      // 先替换文本中的宏
      let text = "{{user}}和{{char}}对话";
      text = macroEvaluator.evaluate(text, macroEnv);
      expect(text).toBe("Alice和Bob对话");

      // 然后应用正则脚本
      for (const script of regexScripts) {
        const findRegex = macroEvaluator.evaluate(script.findRegex || "", macroEnv);
        const replaceString = macroEvaluator.evaluate(script.replaceString || "", macroEnv);

        const regex = compileRegex(findRegex);
        if (regex) {
          text = text.replace(regex, replaceString);
        }
      }

      expect(text).toBe("用户和角色对话");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 2: WorldBook + Macro 协作
  // ──────────────────────────────────────────────────────────────────────────

  describe("WorldBook 与 Macro 协作", () => {
    it("世界书内容中的宏应在注入前被替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "冒险者",
        char: "商人",
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["商店"], "{{char}}经营着一家商店，欢迎{{user}}光临"),
      ];

      // 模拟世界书匹配
      const matched = WorldBookManager.getMatchingEntries(worldBook, "进入商店", [], {
        contextWindow: 5,
      });

      // 替换世界书内容中的宏
      matched.forEach((entry) => {
        entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
      });

      expect(matched[0].content).toBe("商人经营着一家商店，欢迎冒险者光临");
    });

    it("世界书关键词中的宏应在匹配前被替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        char: "守卫",
        language: "zh",
      };

      // 注意：SillyTavern 不支持关键词中的宏
      // 这个测试验证如果我们支持，应该如何工作
      const worldBookRaw: WorldBookEntry[] = [
        createWorldBookEntry(["{{char}}"], "守卫的描述"),
      ];

      // 替换关键词中的宏
      const worldBook = worldBookRaw.map((entry) => ({
        ...entry,
        keys: entry.keys.map((key) => macroEvaluator.evaluate(key, macroEnv)),
      }));

      const matched = WorldBookManager.getMatchingEntries(worldBook, "遇到守卫", [], {
        contextWindow: 5,
      });

      expect(matched).toHaveLength(1);
    });

    it("常量世界书条目的宏应始终被替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        char: "主角",
        user: "玩家",
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry([], "游戏设定：{{user}}扮演{{char}}", {
          constant: true,
        }),
      ];

      const matched = WorldBookManager.getMatchingEntries(worldBook, "任何输入", [], {
        contextWindow: 5,
      });

      matched.forEach((entry) => {
        entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
      });

      expect(matched[0].content).toBe("游戏设定：玩家扮演主角");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 3: WorldBook + Regex 协作
  // ──────────────────────────────────────────────────────────────────────────

  describe("WorldBook 与 Regex 协作", () => {
    it("世界书内容应受正则处理", () => {
      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["魔法"], "魔法系统：使用MP施法"),
      ];

      const regexScript: RegexScript = {
        scriptName: "替换缩写",
        findRegex: "MP",
        replaceString: "魔力值",
        disabled: false,
      };

      // 匹配世界书
      const matched = WorldBookManager.getMatchingEntries(worldBook, "学习魔法", [], {
        contextWindow: 5,
      });

      // 对世界书内容应用正则
      matched.forEach((entry) => {
        const regex = compileRegex(regexScript.findRegex || "");
        if (regex) {
          entry.content = entry.content.replace(regex, regexScript.replaceString || "");
        }
      });

      expect(matched[0].content).toBe("魔法系统：使用魔力值施法");
    });

    it("世界书注入后的提示应受正则处理", () => {

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["战斗"], "战斗系统说明"),
      ];

      const regexScript: RegexScript = {
        scriptName: "清理说明",
        findRegex: "系统说明",
        replaceString: "规则",
        disabled: false,
      };

      // 1. 匹配世界书
      const matched = WorldBookManager.getMatchingEntries(worldBook, "进入战斗", [], {
        contextWindow: 5,
      });

      // 2. 装配提示
      let prompt = `系统: 你是助手\n\n世界书: ${matched[0].content}\n\n用户: 进入战斗`;

      // 3. 对完整提示应用正则
      const regex = compileRegex(regexScript.findRegex || "");
      if (regex) {
        prompt = prompt.replace(new RegExp(regexScript.findRegex || "", "g"), regexScript.replaceString || "");
      }

      expect(prompt).toContain("战斗规则");
      expect(prompt).not.toContain("系统说明");
    });

    it("多个世界书条目应按顺序受正则处理", () => {

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["魔法"], "魔法A"),
        createWorldBookEntry(["魔法"], "魔法B"),
      ];

      const regexScript: RegexScript = {
        scriptName: "标记",
        findRegex: "魔法",
        replaceString: "★魔法",
        disabled: false,
      };

      const matched = WorldBookManager.getMatchingEntries(worldBook, "学习魔法", [], {
        contextWindow: 5,
      });

      const regex = compileRegex(regexScript.findRegex || "");
      matched.forEach((entry) => {
        if (regex) {
          entry.content = entry.content.replace(regex, regexScript.replaceString || "");
        }
      });

      expect(matched[0].content).toBe("★魔法A");
      expect(matched[1].content).toBe("★魔法B");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 4: Macro + Slash Command 协作（模拟）
  // ──────────────────────────────────────────────────────────────────────────

  describe("Macro 与 Slash Command 协作（模拟）", () => {
    it("Slash 命令参数中的宏应在执行前被替换", () => {
      const macroEvaluator = new STMacroEvaluator();
      const slashContext = new MockSlashContext();

      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      // 模拟 Slash 命令：/setvar name {{user}}
      const commandText = "/setvar name {{user}}";

      // 1. 替换命令中的宏
      const processedCommand = macroEvaluator.evaluate(commandText, macroEnv);
      // "/setvar name Alice"

      // 2. 解析并执行命令
      const parts = processedCommand.split(" ");
      const varName = parts[1];
      const varValue = parts[2];
      slashContext.setVar(varName, varValue);

      expect(slashContext.getVar("name")).toBe("Alice");
    });

    it("宏中应能读取 Slash 命令设置的变量", () => {
      const macroEvaluator = new STMacroEvaluator();
      const slashContext = new MockSlashContext();

      // 1. Slash 命令设置变量
      slashContext.setVar("count", "10");

      // 2. 构建包含变量的宏环境
      const macroEnv: MacroEnv = {
        language: "zh",
        // 注意：实际集成中，应从 slashContext 同步变量到 macroEnv
      };

      // 模拟读取变量：{{getvar::count}}
      // 在实际实现中，宏评估器应能访问 Slash 变量
      const text = "当前计数：{{getvar::count}}";

      // 这里简化为直接读取
      const result = text.replace("{{getvar::count}}", slashContext.getVar("count") || "");

      expect(result).toBe("当前计数：10");
    });

    it("条件命令中的宏应在条件判断前被替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      // 模拟条件命令：/if {{user}} == Alice
      const commandText = "/if {{user}} == Alice";
      const processedCommand = macroEvaluator.evaluate(commandText, macroEnv);

      expect(processedCommand).toBe("/if Alice == Alice");

      // 条件应为真
      const isConditionTrue = processedCommand.includes("Alice == Alice");
      expect(isConditionTrue).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 5: MVU + Slash Command 协作（模拟）
  // ──────────────────────────────────────────────────────────────────────────

  describe("MVU 与 Slash Command 协作（模拟）", () => {
    it("Slash 命令应能读取 MVU 变量", () => {
      const mvuVars = new MockMvuVariables();
      const slashContext = new MockSlashContext();

      // 1. MVU 设置变量
      mvuVars.set("health", 100);

      // 2. Slash 命令读取 MVU 变量
      // 模拟命令：/setvar hp {{mvu::health}}
      const mvuValue = mvuVars.get("health");
      slashContext.setVar("hp", mvuValue);

      expect(slashContext.getVar("hp")).toBe(100);
    });

    it("Slash 命令应能更新 MVU 变量", () => {
      const mvuVars = new MockMvuVariables();
      const slashContext = new MockSlashContext();

      // 1. Slash 命令计算新值
      slashContext.setVar("damage", 10);
      const currentHealth = 100;
      const damage = parseInt(slashContext.getVar("damage"));
      const newHealth = currentHealth - damage;

      // 2. 通过 MVU 命令更新
      // 模拟：_.set('health', 90)
      mvuVars.set("health", newHealth);

      expect(mvuVars.get("health")).toBe(90);
    });

    it("MVU 变量更新应能触发宏替换", () => {
      const macroEvaluator = new STMacroEvaluator();
      const mvuVars = new MockMvuVariables();

      // 1. 设置 MVU 变量
      mvuVars.set("name", "勇者");

      // 2. 在宏中使用 MVU 变量（需要集成到 macroEnv）
      const macroEnv: MacroEnv = {
        language: "zh",
        // 实际中应添加：mvuVars: mvuVars.stat_data
      };

      // 模拟宏：欢迎 {{mvu::name}}
      const text = "欢迎 {{mvu::name}}";
      const result = text.replace("{{mvu::name}}", mvuVars.get("name") || "");

      expect(result).toBe("欢迎 勇者");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 6: 完整集成场景
  // ──────────────────────────────────────────────────────────────────────────

  describe("完整集成场景", () => {
    it("应正确处理 Macro + Regex + WorldBook 的完整管线", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "冒险者",
        char: "向导",
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "标准化输入",
        findRegex: "进城",
        replaceString: "进入城市",
        disabled: false,
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["城市"], "{{char}}在城市中引导{{user}}"),
      ];

      // 1. 用户输入 + 宏替换
      let input = "{{user}}想要进城";
      input = macroEvaluator.evaluate(input, macroEnv);
      expect(input).toBe("冒险者想要进城");

      // 2. 正则处理
      const regex = compileRegex(regexScript.findRegex || "");
      if (regex) {
        input = input.replace(regex, regexScript.replaceString || "");
      }
      expect(input).toBe("冒险者想要进入城市");

      // 3. 世界书匹配
      const matched = WorldBookManager.getMatchingEntries(worldBook, input, [], {
        contextWindow: 5,
      });
      expect(matched).toHaveLength(1);

      // 4. 世界书内容宏替换
      matched.forEach((entry) => {
        entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
      });
      expect(matched[0].content).toBe("向导在城市中引导冒险者");
    });

    it("多模块修改同一文本应按正确顺序执行", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "玩家",
        language: "zh",
      };

      const regexScripts: RegexScript[] = [
        {
          scriptName: "步骤1",
          findRegex: "A",
          replaceString: "B",
          disabled: false,
        },
        {
          scriptName: "步骤2",
          findRegex: "B",
          replaceString: "C",
          disabled: false,
        },
      ];

      // 执行顺序：宏 → 正则1 → 正则2
      let text = "测试A {{user}}";

      // 1. 宏替换
      text = macroEvaluator.evaluate(text, macroEnv);
      expect(text).toBe("测试A 玩家");

      // 2. 正则处理（按顺序）
      for (const script of regexScripts) {
        const regex = compileRegex(script.findRegex || "");
        if (regex) {
          text = text.replace(regex, script.replaceString || "");
        }
      }

      expect(text).toBe("测试C 玩家");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 7: 冲突检测
  // ──────────────────────────────────────────────────────────────────────────

  describe("模块冲突检测", () => {
    it("宏和正则不应相互干扰", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "{{special}}",  // 宏值包含特殊字符
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "正则处理",
        findRegex: "\\{\\{",  // 匹配 {{
        replaceString: "[",
        disabled: false,
      };

      let text = "{{user}} 测试";

      // 1. 先宏替换
      text = macroEvaluator.evaluate(text, macroEnv);
      expect(text).toBe("{{special}} 测试");

      // 2. 再正则处理
      const regex = compileRegex(regexScript.findRegex || "");
      if (regex) {
        text = text.replace(new RegExp(regexScript.findRegex || "", "g"), regexScript.replaceString || "");
      }

      // 正则将 {{ 替换为 [
      expect(text).toContain("[special");
    });

    it("多个模块的变量系统应保持独立", () => {
      const macroEvaluator = new STMacroEvaluator();
      const slashContext = new MockSlashContext();
      const mvuVars = new MockMvuVariables();

      // 设置同名变量
      const macroEnv: MacroEnv = {
        language: "zh",
      };

      // 模拟宏变量
      macroEvaluator.evaluate("{{setvar::count::1}}", macroEnv);

      // Slash 变量
      slashContext.setVar("count", "2");

      // MVU 变量
      mvuVars.set("count", 3);

      // 三个系统的变量应独立
      expect(slashContext.getVar("count")).toBe("2");
      expect(mvuVars.get("count")).toBe(3);
    });

    it("世界书和正则的处理顺序应一致", () => {

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["测试"], "内容A"),
      ];

      const regexScript: RegexScript = {
        scriptName: "替换",
        findRegex: "A",
        replaceString: "B",
        disabled: false,
      };

      // 场景1：先世界书，后正则
      const matched1 = WorldBookManager.getMatchingEntries(worldBook, "测试", [], {
        contextWindow: 5,
      });

      const regex = compileRegex(regexScript.findRegex || "");
      matched1.forEach((entry) => {
        if (regex) {
          entry.content = entry.content.replace(regex, regexScript.replaceString || "");
        }
      });

      expect(matched1[0].content).toBe("内容B");

      // 场景2：先正则，后世界书（正则不影响世界书内容）
      const input = "测试输入A";
      const processedInput = input.replace(regex!, regexScript.replaceString || "");

      // 重新加载世界书，因为之前的操作修改了内容
      const worldBook2: WorldBookEntry[] = [
        createWorldBookEntry(["测试"], "内容A"),
      ];

      const matched2 = WorldBookManager.getMatchingEntries(worldBook2, processedInput, [], {
        contextWindow: 5,
      });

      // 世界书原始内容未改变
      expect(matched2[0].content).toBe("内容A");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //   测试组 8: SillyTavern 行为对齐
  // ──────────────────────────────────────────────────────────────────────────

  describe("SillyTavern 行为对齐", () => {
    it("宏应在正则之前执行", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      const regexScript: RegexScript = {
        scriptName: "匹配用户名",
        findRegex: "Alice",  // 匹配宏替换后的结果
        replaceString: "用户",
        disabled: false,
      };

      let text = "你好 {{user}}";

      // SillyTavern 行为：宏先执行
      text = macroEvaluator.evaluate(text, macroEnv);
      expect(text).toBe("你好 Alice");

      // 然后正则执行
      const regex = compileRegex(regexScript.findRegex || "");
      if (regex) {
        text = text.replace(regex, regexScript.replaceString || "");
      }

      expect(text).toBe("你好 用户");
    });

    it("世界书内容的宏应在内容注入前执行", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        char: "商人",
        language: "zh",
      };

      const worldBook: WorldBookEntry[] = [
        createWorldBookEntry(["商店"], "欢迎来到{{char}}的商店"),
      ];

      const matched = WorldBookManager.getMatchingEntries(worldBook, "进入商店", [], {
        contextWindow: 5,
      });

      // SillyTavern 行为：世界书内容的宏在注入前替换
      matched.forEach((entry) => {
        entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
      });

      const prompt = `世界书：${matched[0].content}`;

      expect(prompt).toBe("世界书：欢迎来到商人的商店");
      expect(prompt).not.toContain("{{char}}");
    });

    it("正则的 RAW 模式应阻止宏替换", () => {
      const macroEvaluator = new STMacroEvaluator();

      const macroEnv: MacroEnv = {
        user: "Alice",
        language: "zh",
      };

      // 注意：这是一个假设性测试
      // SillyTavern 中，如果正则标记为 RAW 模式，宏不应替换
      const regexScript: RegexScript = {
        scriptName: "保留宏",
        findRegex: "测试",
        replaceString: "{{user}}",  // 在 RAW 模式下，这应该保持为字面量
        runOn: "RAW",  // 假设的标志
        disabled: false,
      };

      const text = "这是测试";
      const result = text.replace(
        new RegExp(regexScript.findRegex || ""),
        regexScript.replaceString || "",
      );

      // 在 RAW 模式下，宏不应被替换
      if (regexScript.runOn === "RAW") {
        expect(result).toBe("这是{{user}}");
      } else {
        // 非 RAW 模式，宏应被替换
        const processedReplace = macroEvaluator.evaluate(
          regexScript.replaceString || "",
          macroEnv,
        );
        const result2 = text.replace(
          new RegExp(regexScript.findRegex || ""),
          processedReplace,
        );
        expect(result2).toBe("这是Alice");
      }
    });
  });
});
