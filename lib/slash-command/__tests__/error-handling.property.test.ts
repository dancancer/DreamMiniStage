/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Error Handling Property Tests                           ║
 * ║                                                                           ║
 * ║  **Feature: sillytavern-compat, Property 3: Error Handling**              ║
 * ║  **Validates: Requirements 1.3, 1.5**                                     ║
 * ║                                                                           ║
 * ║  验证错误处理的核心不变量：                                                  ║
 * ║  *For any* invalid command string (malformed syntax, unknown command      ║
 * ║  name, or execution failure), the result should have isError: true        ║
 * ║  and errorMessage should be a non-empty string describing the failure.   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseSlashCommands } from "../parser";
import { executeSlashCommands, createMinimalContext } from "../executor";
import { getRegisteredCommands } from "../registry";

// ============================================================================
//                              生成器定义
// ============================================================================

/**
 * 生成不存在的命令名（排除已注册命令）
 */
const unknownCommandNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/)
  .filter(name => {
    const registered = getRegisteredCommands();
    return !registered.includes(name.toLowerCase());
  });

/**
 * 生成格式错误的命令字符串（不以 / 开头）
 */
const malformedCommandArb = fc.oneof(
  // 不以 / 开头的字符串
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,20}$/),
  // 只有空格
  fc.constant("   "),
  // 只有 / 没有命令名
  fc.constant("/"),
  // / 后面直接跟空格
  fc.constant("/ send"),
);

/**
 * 生成安全的字符串值
 */
const safeStringArb = fc.stringMatching(/^[a-zA-Z0-9_]+$/)
  .filter(s => s.length > 0 && s.length <= 20);

// ============================================================================
//                              属性测试
// ============================================================================

describe("Property 3: Error Handling for Invalid Commands", () => {
  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 空命令字符串应该返回错误
   */
  it("*For any* empty or whitespace-only input, parsing SHALL return isError: true with non-empty errorMessage", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(""),
          fc.integer({ min: 1, max: 10 }).map(n => " ".repeat(n)),
        ),
        async (input) => {
          const result = parseSlashCommands(input);
          
          expect(result.isError).toBe(true);
          expect(result.errorMessage).toBeDefined();
          expect(result.errorMessage!.length).toBeGreaterThan(0);
          expect(result.commands).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 不以 / 开头的命令应该返回解析错误
   */
  it("*For any* command not starting with /, parsing SHALL return isError: true", async () => {
    await fc.assert(
      fc.asyncProperty(malformedCommandArb, async (input) => {
        const result = parseSlashCommands(input);
        
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toBeDefined();
        expect(result.errorMessage!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 未知命令应该在执行时返回错误
   */
  it("*For any* unknown command name, execution SHALL return isError: true with descriptive errorMessage", async () => {
    await fc.assert(
      fc.asyncProperty(unknownCommandNameArb, async (cmdName) => {
        const commandStr = `/${cmdName}`;
        const parsed = parseSlashCommands(commandStr);
        
        // 解析应该成功（语法正确）
        expect(parsed.isError).toBe(false);
        expect(parsed.commands).toHaveLength(1);
        
        // 执行应该失败（命令不存在）
        const ctx = createMinimalContext();
        const result = await executeSlashCommands(parsed.commands, ctx);
        
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toBeDefined();
        expect(result.errorMessage!.length).toBeGreaterThan(0);
        expect(result.errorMessage).toContain(cmdName);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 管道中的未知命令应该中断执行并返回错误
   */
  it("*For any* pipe sequence containing an unknown command, execution SHALL fail at that command", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeStringArb,
        unknownCommandNameArb,
        async (value, unknownCmd) => {
          // /echo value|/unknownCmd|/pass
          const commandStr = `/echo ${value}|/${unknownCmd}|/pass`;
          const parsed = parseSlashCommands(commandStr);
          
          expect(parsed.isError).toBe(false);
          expect(parsed.commands).toHaveLength(3);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(true);
          expect(result.errorMessage).toBeDefined();
          expect(result.errorMessage!.length).toBeGreaterThan(0);
          expect(result.errorMessage).toContain(unknownCmd);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 管道中间的格式错误命令应该返回解析错误
   */
  it("*For any* pipe sequence with malformed command in middle, parsing SHALL fail", async () => {
    await fc.assert(
      fc.asyncProperty(safeStringArb, async (value) => {
        // /echo value|notacommand|/pass - 中间的命令没有 /
        const commandStr = `/echo ${value}|notacommand|/pass`;
        const result = parseSlashCommands(commandStr);
        
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toBeDefined();
        expect(result.errorMessage!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 命令执行抛出异常时应该返回错误
   */
  it("*For any* command that throws, execution SHALL return isError: true with error message", async () => {
    await fc.assert(
      fc.asyncProperty(safeStringArb, async (errorMsg) => {
        const ctx = createMinimalContext({
          // 让 onSend 抛出异常
          onSend: async () => {
            throw new Error(errorMsg);
          },
        });
        
        const commandStr = "/send test";
        const parsed = parseSlashCommands(commandStr);
        
        expect(parsed.isError).toBe(false);
        
        const result = await executeSlashCommands(parsed.commands, ctx);
        
        expect(result.isError).toBe(true);
        expect(result.errorMessage).toBeDefined();
        expect(result.errorMessage!.length).toBeGreaterThan(0);
        expect(result.errorMessage).toContain(errorMsg);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 3: Error Handling**
   * **Validates: Requirements 1.3, 1.5**
   * 
   * 错误结果的 pipe 字段应该保持上一个成功命令的值
   */
  it("*For any* sequence where error occurs after successful commands, pipe SHALL contain last successful value", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeStringArb,
        unknownCommandNameArb,
        async (value, unknownCmd) => {
          // /echo value|/unknownCmd - 第一个成功，第二个失败
          const commandStr = `/echo ${value}|/${unknownCmd}`;
          const parsed = parseSlashCommands(commandStr);
          
          expect(parsed.isError).toBe(false);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(true);
          // pipe 应该保持 /echo 的输出值
          expect(result.pipe).toBe(value);
        },
      ),
      { numRuns: 100 },
    );
  });
});
