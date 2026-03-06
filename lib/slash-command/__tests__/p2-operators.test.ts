/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        P2 Utility Commands Tests                           ║
 * ║                                                                           ║
 * ║  覆盖基础数学/字符串/数组命令行为                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
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

  it("/mul /div /mod 覆盖基础数学语义", async () => {
    const ctx = createMinimalContext();

    const mulParsed = parseSlashCommands("/echo 2|/mul 3 4");
    const mulResult = await executeSlashCommands(mulParsed.commands, ctx);
    expect(mulResult.isError).toBe(false);
    expect(mulResult.pipe).toBe("24");

    const divParsed = parseSlashCommands("/div 20 5");
    const divResult = await executeSlashCommands(divParsed.commands, ctx);
    expect(divResult.isError).toBe(false);
    expect(divResult.pipe).toBe("4");

    const modParsed = parseSlashCommands("/mod 20 6");
    const modResult = await executeSlashCommands(modParsed.commands, ctx);
    expect(modResult.isError).toBe(false);
    expect(modResult.pipe).toBe("2");
  });

  it("/pow /max /min 覆盖扩展数学语义", async () => {
    const ctx = createMinimalContext();

    const powParsed = parseSlashCommands("/pow 2 3");
    const powResult = await executeSlashCommands(powParsed.commands, ctx);
    expect(powResult.isError).toBe(false);
    expect(powResult.pipe).toBe("8");

    const maxParsed = parseSlashCommands("/echo 4|/max 9 1");
    const maxResult = await executeSlashCommands(maxParsed.commands, ctx);
    expect(maxResult.isError).toBe(false);
    expect(maxResult.pipe).toBe("9");

    const minParsed = parseSlashCommands("/min -2 5 3");
    const minResult = await executeSlashCommands(minParsed.commands, ctx);
    expect(minResult.isError).toBe(false);
    expect(minResult.pipe).toBe("-2");
  });

  it("/sin /cos /log /abs /sqrt /round 覆盖单参数数学语义", async () => {
    const ctx = createMinimalContext();

    const sinResult = await executeSlashCommands(parseSlashCommands("/sin 1.5707963267948966").commands, ctx);
    expect(sinResult.isError).toBe(false);
    expect(Number(sinResult.pipe)).toBeCloseTo(1, 10);

    const cosResult = await executeSlashCommands(parseSlashCommands("/echo 0|/cos").commands, ctx);
    expect(cosResult.isError).toBe(false);
    expect(Number(cosResult.pipe)).toBeCloseTo(1, 10);

    const logResult = await executeSlashCommands(parseSlashCommands("/log 1").commands, ctx);
    expect(logResult.isError).toBe(false);
    expect(logResult.pipe).toBe("0");

    const absResult = await executeSlashCommands(parseSlashCommands("/abs -7.5").commands, ctx);
    expect(absResult.isError).toBe(false);
    expect(absResult.pipe).toBe("7.5");

    const sqrtResult = await executeSlashCommands(parseSlashCommands("/sqrt 9").commands, ctx);
    expect(sqrtResult.isError).toBe(false);
    expect(sqrtResult.pipe).toBe("3");

    const roundResult = await executeSlashCommands(parseSlashCommands("/round 2.6").commands, ctx);
    expect(roundResult.isError).toBe(false);
    expect(roundResult.pipe).toBe("3");
  });

  it("/div 和 /mod 在除数为 0 时显式失败", async () => {
    const ctx = createMinimalContext();

    const divParsed = parseSlashCommands("/div 10 0");
    const divResult = await executeSlashCommands(divParsed.commands, ctx);
    expect(divResult.isError).toBe(true);
    expect(divResult.errorMessage).toContain("Division by zero");

    const modParsed = parseSlashCommands("/mod 10 0");
    const modResult = await executeSlashCommands(modParsed.commands, ctx);
    expect(modResult.isError).toBe(true);
    expect(modResult.errorMessage).toContain("Division by zero");
  });

  it("/rand 支持位置参数与 round 模式", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const ctx = createMinimalContext();

      const defaultParsed = parseSlashCommands("/rand");
      const defaultResult = await executeSlashCommands(defaultParsed.commands, ctx);
      expect(defaultResult.isError).toBe(false);
      expect(defaultResult.pipe).toBe("0.5");

      const rangedParsed = parseSlashCommands("/rand 10");
      const rangedResult = await executeSlashCommands(rangedParsed.commands, ctx);
      expect(rangedResult.isError).toBe(false);
      expect(rangedResult.pipe).toBe("5");

      const roundParsed = parseSlashCommands("/rand from=1 to=4 round=ceil");
      const roundResult = await executeSlashCommands(roundParsed.commands, ctx);
      expect(roundResult.isError).toBe(false);
      expect(roundResult.pipe).toBe("3");
    } finally {
      randomSpy.mockRestore();
    }
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

  it("/split 与 /join 可串联处理列表文本", async () => {
    const parsed = parseSlashCommands("/echo apple, banana, cherry|/split \", \"|/join -");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("apple-banana-cherry");
  });

  it("/replace 支持 literal / regex 以及 /re 别名", async () => {
    const ctx = createMinimalContext();

    const literalParsed = parseSlashCommands("/replace pattern=blue replacer=red \"blue house and blue car\"");
    const literalResult = await executeSlashCommands(literalParsed.commands, ctx);
    expect(literalResult.isError).toBe(false);
    expect(literalResult.pipe).toBe("red house and red car");

    const regexParsed = parseSlashCommands("/replace mode=regex pattern=/blue/gi replacer=red \"Blue house and blue car\"");
    const regexResult = await executeSlashCommands(regexParsed.commands, ctx);
    expect(regexResult.isError).toBe(false);
    expect(regexResult.pipe).toBe("red house and red car");

    const aliasParsed = parseSlashCommands("/echo blue blue|/re pattern=blue replacer=green");
    const aliasResult = await executeSlashCommands(aliasParsed.commands, ctx);
    expect(aliasResult.isError).toBe(false);
    expect(aliasResult.pipe).toBe("green green");
  });

  it("/match 对齐 ST 的 regex 返回语义", async () => {
    const ctx = createMinimalContext();

    const singleParsed = parseSlashCommands("/match pattern=\"color_(\\w+)\" \"color_green green lamp\"");
    const singleResult = await executeSlashCommands(singleParsed.commands, ctx);
    expect(singleResult.isError).toBe(false);
    expect(singleResult.pipe).toBe("[\"color_green\",\"green\"]");

    const globalParsed = parseSlashCommands("/match pattern=\"/color_(\\w+)/g\" \"color_green green lamp color_blue\"");
    const globalResult = await executeSlashCommands(globalParsed.commands, ctx);
    expect(globalResult.isError).toBe(false);
    expect(globalResult.pipe).toBe("[[\"color_green\",\"green\"],[\"color_blue\",\"blue\"]]");

    const singleMissParsed = parseSlashCommands("/match pattern=orange \"color_green\"");
    const singleMissResult = await executeSlashCommands(singleMissParsed.commands, ctx);
    expect(singleMissResult.isError).toBe(false);
    expect(singleMissResult.pipe).toBe("");

    const globalMissParsed = parseSlashCommands("/match pattern=\"/orange/g\" \"color_green\"");
    const globalMissResult = await executeSlashCommands(globalMissParsed.commands, ctx);
    expect(globalMissResult.isError).toBe(false);
    expect(globalMissResult.pipe).toBe("[]");
  });

  it("/test 返回 regex 命中布尔值", async () => {
    const ctx = createMinimalContext();

    const hitParsed = parseSlashCommands("/test pattern=\"/green/i\" \"Green lamp\"");
    const hitResult = await executeSlashCommands(hitParsed.commands, ctx);
    expect(hitResult.isError).toBe(false);
    expect(hitResult.pipe).toBe("true");

    const missParsed = parseSlashCommands("/echo blue sky|/test pattern=orange");
    const missResult = await executeSlashCommands(missParsed.commands, ctx);
    expect(missResult.isError).toBe(false);
    expect(missResult.pipe).toBe("false");
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

  it("/replace 非法模式时返回错误", async () => {
    const parsed = parseSlashCommands("/replace mode=bad pattern=x foo");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("Invalid replace mode");
  });

  it("/match 缺少 pattern 时返回错误", async () => {
    const parsed = parseSlashCommands("/match");
    const ctx = createMinimalContext();
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("pattern");
  });

  it("/log /sqrt 非法输入与缺参时返回错误", async () => {
    const ctx = createMinimalContext();

    const logResult = await executeSlashCommands(parseSlashCommands("/log 0").commands, ctx);
    expect(logResult.isError).toBe(true);
    expect(logResult.errorMessage).toContain("Log input must be greater than 0");

    const sqrtResult = await executeSlashCommands(parseSlashCommands("/sqrt -1").commands, ctx);
    expect(sqrtResult.isError).toBe(true);
    expect(sqrtResult.errorMessage).toContain("Sqrt input must be non-negative");

    const sinResult = await executeSlashCommands(parseSlashCommands("/sin").commands, ctx);
    expect(sinResult.isError).toBe(true);
    expect(sinResult.errorMessage).toContain("Missing number argument");
  });
});
