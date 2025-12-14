/* ═══════════════════════════════════════════════════════════════════════════
   正则调试器单元测试
   
   测试目标：
   - 验证调试器能正确记录执行步骤
   - 验证匹配信息的准确性
   - 验证文本转换链路的完整性
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import { debug } from "@/lib/core/regex-debugger";
import { RegexScript, SubstituteRegexMode, RegexPlacement } from "@/lib/models/regex-script-model";

describe("RegexDebugger", () => {
  /* ─────────────────────────────────────────────────────────────────────────
     测试 1：基本功能 - 单个脚本执行
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该记录单个脚本的执行步骤", () => {
    const script: RegexScript = {
      scriptKey: "test1",
      scriptName: "测试脚本1",
      findRegex: "/Hello/g",
      replaceString: "Hi",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].scriptName).toBe("测试脚本1");
    expect(result.steps[0].matched).toBe(true);
    expect(result.steps[0].matches).toEqual(["Hello"]);
    expect(result.steps[0].beforeText).toBe("Hello World");
    expect(result.steps[0].afterText).toBe("Hi World");
    expect(result.outputText).toBe("Hi World");
    expect(result.appliedScripts).toBe(1);
    expect(result.totalMatches).toBe(1);
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 2：多脚本链式执行
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该按顺序执行多个脚本并记录每一步", () => {
    const scripts: RegexScript[] = [
      {
        scriptKey: "step1",
        scriptName: "步骤1",
        findRegex: "/Hello/g",
        replaceString: "Hi",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      },
      {
        scriptKey: "step2",
        scriptName: "步骤2",
        findRegex: "/World/g",
        replaceString: "Universe",
        trimStrings: [],
        placement: [RegexPlacement.AI_OUTPUT],
      },
    ];
    
    const result = debug("Hello World", scripts);
    
    expect(result.steps).toHaveLength(2);
    
    // 第一步
    expect(result.steps[0].beforeText).toBe("Hello World");
    expect(result.steps[0].afterText).toBe("Hi World");
    
    // 第二步（输入是第一步的输出）
    expect(result.steps[1].beforeText).toBe("Hi World");
    expect(result.steps[1].afterText).toBe("Hi Universe");
    
    // 最终输出
    expect(result.outputText).toBe("Hi Universe");
    expect(result.appliedScripts).toBe(2);
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 3：无匹配情况
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该正确处理无匹配的脚本", () => {
    const script: RegexScript = {
      scriptKey: "nomatch",
      scriptName: "无匹配脚本",
      findRegex: "/Goodbye/g",
      replaceString: "Farewell",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].matched).toBe(false);
    expect(result.steps[0].matches).toEqual([]);
    expect(result.steps[0].beforeText).toBe("Hello World");
    expect(result.steps[0].afterText).toBe("Hello World");
    expect(result.outputText).toBe("Hello World");
    expect(result.appliedScripts).toBe(0);
    expect(result.totalMatches).toBe(0);
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 4：宏替换
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该在调试中应用宏替换", () => {
    const script: RegexScript = {
      scriptKey: "macro",
      scriptName: "宏替换脚本",
      findRegex: "{{user}}",
      replaceString: "{{char}}",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
      substituteRegex: SubstituteRegexMode.RAW,
    };
    
    const result = debug("Hello Alice", [script], {
      user: "Alice",
      char: "Bob",
    });
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].findRegex).toBe("Alice"); // 宏已替换
    expect(result.steps[0].matched).toBe(true);
    expect(result.outputText).toBe("Hello Bob");
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 5：TrimStrings 过滤
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该在替换后应用 TrimStrings", () => {
    const script: RegexScript = {
      scriptKey: "trim",
      scriptName: "裁剪脚本",
      findRegex: "/Hello/g",
      replaceString: "Hi!!!",
      trimStrings: ["!"],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].afterText).toBe("Hi World"); // !!! 被裁剪
    expect(result.outputText).toBe("Hi World");
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 6：正则编译失败
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该正确处理正则编译失败的情况", () => {
    const script: RegexScript = {
      scriptKey: "invalid",
      scriptName: "无效正则",
      findRegex: "/[/", // 无效的正则
      replaceString: "replacement",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].skipped).toBe(true);
    expect(result.steps[0].skipReason).toBeDefined();
    expect(result.steps[0].matched).toBe(false);
    expect(result.steps[0].beforeText).toBe("Hello World");
    expect(result.steps[0].afterText).toBe("Hello World");
    expect(result.outputText).toBe("Hello World");
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 7：捕获组替换
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该正确处理捕获组替换", () => {
    const script: RegexScript = {
      scriptKey: "capture",
      scriptName: "捕获组脚本",
      findRegex: "/(\\w+) (\\w+)/g",
      replaceString: "$2 $1",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].matched).toBe(true);
    expect(result.steps[0].afterText).toBe("World Hello");
    expect(result.outputText).toBe("World Hello");
  });
  
  /* ─────────────────────────────────────────────────────────────────────────
     测试 8：多次匹配
     ───────────────────────────────────────────────────────────────────────── */
  
  it("应该记录所有匹配项", () => {
    const script: RegexScript = {
      scriptKey: "multi",
      scriptName: "多匹配脚本",
      findRegex: "/o/g",
      replaceString: "0",
      trimStrings: [],
      placement: [RegexPlacement.AI_OUTPUT],
    };
    
    const result = debug("Hello World", [script]);
    
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].matched).toBe(true);
    expect(result.steps[0].matches).toEqual(["o", "o"]);
    expect(result.steps[0].afterText).toBe("Hell0 W0rld");
    expect(result.totalMatches).toBe(2);
  });
});
