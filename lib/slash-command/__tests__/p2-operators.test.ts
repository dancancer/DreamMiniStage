/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        P2 Utility Commands Tests                           ║
 * ║                                                                           ║
 * ║  覆盖基础数学/字符串/数组命令行为                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { parseSlashCommands } from "../parser";
import { executeSlashCommands, createMinimalContext } from "../executor";

describe("P2 utility commands", () => {
  it("/add uses pipe as前置操作数并求和", async () => {
    const parsed = parseSlashCommands("/echo 5|/add 3");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("8");
  });

  it("/sub 按顺序相减并返回字符串", async () => {
    const parsed = parseSlashCommands("/sub 10 2 3");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("5");
  });

  it("/len 默认使用 pipe 或参数文本长度", async () => {
    const parsed = parseSlashCommands("/len hello world");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);
    expect(result.pipe).toBe("11");

    const parsedPipe = parseSlashCommands("/echo 12345|/len");
    const resultPipe = await executeSlashCommands(parsedPipe.commands, ctx);
    expect(resultPipe.pipe).toBe("5");
  });

  it("/trim 去除首尾空白", async () => {
    const parsed = parseSlashCommands("/echo \"  hi  \"|/trim");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("hi");
  });

  it("/push 维护数组变量并返回 JSON 字符串", async () => {
    const parsed = parseSlashCommands("/push list apple|/push list banana");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(ctx.getVariable("list")).toEqual(["apple", "banana"]);
    expect(result.pipe).toBe(JSON.stringify(["apple", "banana"]));
  });

  it("/push 无显式值时使用 pipe", async () => {
    const parsed = parseSlashCommands("/echo grape|/push basket");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(ctx.getVariable("basket")).toEqual(["grape"]);
  });

  it("/add 无效数字时返回错误", async () => {
    const parsed = parseSlashCommands("/add foo");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("Invalid number");
  });
});
