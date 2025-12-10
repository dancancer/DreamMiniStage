/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Pipe Propagation Property Tests                         ║
 * ║                                                                           ║
 * ║  **Feature: sillytavern-compat, Property 2: Pipe Propagation**            ║
 * ║  **Validates: Requirements 1.2**                                          ║
 * ║                                                                           ║
 * ║  验证管道传递的核心不变量：                                                  ║
 * ║  *For any* sequence of piped commands /cmd1|/cmd2|/cmd3,                  ║
 * ║  the output of command N should be available as input to command N+1,    ║
 * ║  and the final result should contain the output of the last command.     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseSlashCommands } from "../parser";
import { executeSlashCommands, createMinimalContext } from "../executor";

// ============================================================================
//                              生成器定义
// ============================================================================

/**
 * 生成安全的字符串值（不含管道符和引号，避免解析歧义）
 */
const safeStringArb = fc.stringMatching(/^[a-zA-Z0-9_]+$/)
  .filter(s => s.length > 0 && s.length <= 20);

/**
 * 生成 /echo 命令（纯函数，输出 = 输入参数）
 */
const echoCommandArb = safeStringArb.map(text => ({
  raw: `/echo ${text}`,
  expectedOutput: text,
}));

/**
 * 生成 /pass 命令（透传 pipe 值）
 */
const passCommandArb = fc.constant({
  raw: "/pass",
  expectedOutput: null as string | null, // 输出 = 输入 pipe
});

/**
 * 生成 /setvar + /getvar 组合（设置变量后获取）
 */
const setGetVarCommandArb = fc.tuple(safeStringArb, safeStringArb).map(([key, value]) => ({
  raw: `/setvar ${key}=${value}|/getvar ${key}`,
  expectedOutput: value,
}));

// ============================================================================
//                              属性测试
// ============================================================================

describe("Property 2: Pipe Propagation in Command Sequences", () => {
  /**
   * **Feature: sillytavern-compat, Property 2: Pipe Propagation**
   * **Validates: Requirements 1.2**
   * 
   * 核心属性：/echo 命令的输出应该传递给下一个 /pass 命令
   */
  it("*For any* /echo value followed by /pass, the final pipe SHALL equal the echo value", async () => {
    await fc.assert(
      fc.asyncProperty(safeStringArb, async (value) => {
        const commandStr = `/echo ${value}|/pass`;
        const parsed = parseSlashCommands(commandStr);
        
        expect(parsed.isError).toBe(false);
        expect(parsed.commands).toHaveLength(2);
        
        const ctx = createMinimalContext();
        const result = await executeSlashCommands(parsed.commands, ctx);
        
        expect(result.isError).toBe(false);
        expect(result.pipe).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 2: Pipe Propagation**
   * **Validates: Requirements 1.2**
   * 
   * 链式 /pass 命令应该保持 pipe 值不变
   */
  it("*For any* initial value and N pass commands, the final pipe SHALL equal the initial value", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeStringArb,
        fc.integer({ min: 1, max: 5 }),
        async (initialValue, passCount) => {
          const passes = Array(passCount).fill("/pass").join("|");
          const commandStr = `/echo ${initialValue}|${passes}`;
          
          const parsed = parseSlashCommands(commandStr);
          expect(parsed.isError).toBe(false);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(false);
          expect(result.pipe).toBe(initialValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 2: Pipe Propagation**
   * **Validates: Requirements 1.2**
   * 
   * /setvar 设置的值应该能通过 /getvar 获取
   */
  it("*For any* key-value pair, /setvar followed by /getvar SHALL return the set value", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeStringArb,
        safeStringArb,
        async (key, value) => {
          const commandStr = `/setvar ${key}=${value}|/getvar ${key}`;
          
          const parsed = parseSlashCommands(commandStr);
          expect(parsed.isError).toBe(false);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(false);
          expect(result.pipe).toBe(value);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 2: Pipe Propagation**
   * **Validates: Requirements 1.2**
   * 
   * 最后一个 /echo 命令的输出应该是最终 pipe 值
   */
  it("*For any* sequence ending with /echo, the final pipe SHALL equal the last echo value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(safeStringArb, { minLength: 1, maxLength: 5 }),
        async (values) => {
          // 构建 /echo v1|/echo v2|...|/echo vN
          const commandStr = values.map(v => `/echo ${v}`).join("|");
          
          const parsed = parseSlashCommands(commandStr);
          expect(parsed.isError).toBe(false);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(false);
          // 最后一个 echo 的值应该是最终输出
          expect(result.pipe).toBe(values[values.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: sillytavern-compat, Property 2: Pipe Propagation**
   * **Validates: Requirements 1.2**
   * 
   * 变量可以通过 pipe 传递给 /setvar
   */
  it("*For any* value, /echo value|/setvar key SHALL store the echoed value", async () => {
    await fc.assert(
      fc.asyncProperty(
        safeStringArb,
        safeStringArb,
        async (key, value) => {
          // /echo value|/setvar key (使用 pipe 作为值)|/getvar key
          const commandStr = `/echo ${value}|/setvar ${key}|/getvar ${key}`;
          
          const parsed = parseSlashCommands(commandStr);
          expect(parsed.isError).toBe(false);
          
          const ctx = createMinimalContext();
          const result = await executeSlashCommands(parsed.commands, ctx);
          
          expect(result.isError).toBe(false);
          expect(result.pipe).toBe(value);
        },
      ),
      { numRuns: 100 },
    );
  });
});
