/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      P2 Variable Scope Commands Tests                      ║
 * ║                                                                           ║
 * ║  覆盖 addvar/globalvar 与 chat/global 别名命令                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";

import { executeSlashCommands } from "../executor";
import { parseSlashCommands } from "../parser";
import type { ExecutionContext, VariableScope } from "../types";

function createScopedContext(): { ctx: ExecutionContext; local: Map<string, unknown>; global: Map<string, unknown> } {
  const local = new Map<string, unknown>();
  const global = new Map<string, unknown>();

  const getScoped = (scope: VariableScope, key: string): unknown => {
    if (scope === "global") return global.get(key);
    return local.get(key);
  };

  const setScoped = (scope: VariableScope, key: string, value: unknown): void => {
    if (scope === "global") {
      global.set(key, value);
      return;
    }
    local.set(key, value);
  };

  const delScoped = (scope: VariableScope, key: string): void => {
    if (scope === "global") {
      global.delete(key);
      return;
    }
    local.delete(key);
  };

  const ctx: ExecutionContext = {
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: (key) => local.get(key),
    setVariable: (key, value) => local.set(key, value),
    deleteVariable: (key) => local.delete(key),
    getScopedVariable: getScoped,
    setScopedVariable: setScoped,
    deleteScopedVariable: delScoped,
    listVariables: () => Array.from(local.keys()),
    listScopedVariables: (scope) => Array.from(scope === "global" ? global.keys() : local.keys()),
  };

  return { ctx, local, global };
}

describe("P2 scoped variable commands", () => {
  it("/addvar supports numeric accumulation and string append", async () => {
    const { ctx } = createScopedContext();

    const numberParsed = parseSlashCommands("/setvar score 2|/addvar key=score 8|/getvar score");
    const numberResult = await executeSlashCommands(numberParsed.commands, ctx);
    expect(numberResult.isError).toBe(false);
    expect(numberResult.pipe).toBe("10");

    const textParsed = parseSlashCommands("/setvar mood hi|/addvar mood !|/getvar mood");
    const textResult = await executeSlashCommands(textParsed.commands, ctx);
    expect(textResult.isError).toBe(false);
    expect(textResult.pipe).toBe("hi!");
  });

  it("/addvar appends value when current variable is a JSON array", async () => {
    const { ctx, local } = createScopedContext();
    local.set("tags", JSON.stringify(["alpha"]));

    const parsed = parseSlashCommands("/addvar key=tags beta");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("alpha,beta");
    expect(local.get("tags")).toEqual(["alpha", "beta"]);
  });

  it("/addvar 支持 index 路径内的数值累加与数组追加", async () => {
    const { ctx, local } = createScopedContext();
    local.set("stats", "{\"player\":{\"hp\":10,\"tags\":[\"alpha\"]}}");

    const hpParsed = parseSlashCommands("/addvar key=stats index=player.hp 5|/getvar key=stats index=player.hp");
    const hpResult = await executeSlashCommands(hpParsed.commands, ctx);
    expect(hpResult.isError).toBe(false);
    expect(hpResult.pipe).toBe("15");

    const tagsParsed = parseSlashCommands("/addvar key=stats index=player.tags beta|/getvar key=stats index=player.tags");
    const tagsResult = await executeSlashCommands(tagsParsed.commands, ctx);
    expect(tagsResult.isError).toBe(false);
    expect(tagsResult.pipe).toBe("[\"alpha\",\"beta\"]");
  });

  it("/setglobalvar /addglobalvar /getglobalvar use scoped global store", async () => {
    const { ctx, local, global } = createScopedContext();

    const parsed = parseSlashCommands("/setglobalvar key=coins 3|/addglobalvar key=coins 7|/setvar coins 100|/getglobalvar coins");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("10");
    expect(local.get("coins")).toBe("100");
    expect(global.get("coins")).toBe(10);
  });

  it("/addglobalvar 支持 index 路径内数值累加", async () => {
    const { ctx, global } = createScopedContext();
    global.set("profile", "{\"balance\":{\"coin\":2}}");

    const parsed = parseSlashCommands("/addglobalvar key=profile index=balance.coin 3|/getglobalvar key=profile index=balance.coin");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("5");
    expect(global.get("profile")).toBe("{\"balance\":{\"coin\":5}}");
  });

  it("global increment/decrement and chat aliases keep compatibility", async () => {
    const { ctx } = createScopedContext();

    const parsed = parseSlashCommands("/setchatvar tone calm|/setglobalvar level 5|/incglobalvar level|/decglobalvar level|/flushglobalvar level|/getchatvar tone|/getglobalvar level");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");

    const checkLocal = await executeSlashCommands(parseSlashCommands("/getchatvar tone").commands, ctx);
    expect(checkLocal.pipe).toBe("calm");
  });

  it("set/getglobalvar 支持 index 与 as 语义（对象/数组写入）", async () => {
    const { ctx, global } = createScopedContext();

    const objectParsed = parseSlashCommands("/setglobalvar key=profile index=name as=string Linus|/getglobalvar key=profile index=name");
    const objectResult = await executeSlashCommands(objectParsed.commands, ctx);
    expect(objectResult.isError).toBe(false);
    expect(objectResult.pipe).toBe("Linus");
    expect(global.get("profile")).toBe("{\"name\":\"Linus\"}");

    const arrayParsed = parseSlashCommands("/setglobalvar key=ages index=1 as=number 21|/getglobalvar key=ages index=1");
    const arrayResult = await executeSlashCommands(arrayParsed.commands, ctx);
    expect(arrayResult.isError).toBe(false);
    expect(arrayResult.pipe).toBe("21");
    expect(global.get("ages")).toBe("[null,21]");
  });

  it("getglobalvar index 读取对象时返回 JSON 文本", async () => {
    const { ctx, global } = createScopedContext();
    global.set("stats", "{\"meta\":{\"hp\":88}}");

    const parsed = parseSlashCommands("/getglobalvar key=stats index=meta");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("{\"hp\":88}");
  });

  it("set/getglobalvar index 在容器类型不匹配时显式失败", async () => {
    const { ctx, global } = createScopedContext();
    global.set("profile", "{\"name\":\"Linus\"}");

    const setParsed = parseSlashCommands("/setglobalvar key=profile index=0 as=number 1");
    const setResult = await executeSlashCommands(setParsed.commands, ctx);
    expect(setResult.isError).toBe(true);
    expect(setResult.errorMessage).toContain("JSON array");

    const getParsed = parseSlashCommands("/getglobalvar key=profile index=0");
    const getResult = await executeSlashCommands(getParsed.commands, ctx);
    expect(getResult.isError).toBe(true);
    expect(getResult.errorMessage).toContain("JSON array");
  });

  it("set/getvar 支持 index 与 as 语义（chat 别名共用本地作用域）", async () => {
    const { ctx, local } = createScopedContext();

    const objectParsed = parseSlashCommands("/setvar key=profile index=name as=string Linus|/getchatvar key=profile index=name");
    const objectResult = await executeSlashCommands(objectParsed.commands, ctx);
    expect(objectResult.isError).toBe(false);
    expect(objectResult.pipe).toBe("Linus");
    expect(local.get("profile")).toBe("{\"name\":\"Linus\"}");

    const arrayParsed = parseSlashCommands("/setchatvar key=ages index=1 as=number 21|/getvar key=ages index=1");
    const arrayResult = await executeSlashCommands(arrayParsed.commands, ctx);
    expect(arrayResult.isError).toBe(false);
    expect(arrayResult.pipe).toBe("21");
    expect(local.get("ages")).toBe("[null,21]");
  });

  it("set/getvar index 在容器类型不匹配时显式失败", async () => {
    const { ctx, local } = createScopedContext();
    local.set("profile", "{\"name\":\"Linus\"}");

    const setParsed = parseSlashCommands("/setvar key=profile index=0 as=number 1");
    const setResult = await executeSlashCommands(setParsed.commands, ctx);
    expect(setResult.isError).toBe(true);
    expect(setResult.errorMessage).toContain("Local variable");
    expect(setResult.errorMessage).toContain("JSON array");

    const getParsed = parseSlashCommands("/getchatvar key=profile index=0");
    const getResult = await executeSlashCommands(getParsed.commands, ctx);
    expect(getResult.isError).toBe(true);
    expect(getResult.errorMessage).toContain("Local variable");
    expect(getResult.errorMessage).toContain("JSON array");
  });

  it("setvar 支持单个 key=value 简写并保留字符串原样", async () => {
    const { ctx } = createScopedContext();
    const parsed = parseSlashCommands("/setvar foo=00|/getvar foo");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("00");
  });

  it("setvar 对旧式多 named-args 批量写入做 fail-fast", async () => {
    const { ctx } = createScopedContext();
    const parsed = parseSlashCommands("/setvar name=Bob age=30");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("does not support named argument");
  });

  it("addvar/addglobalvar 对不支持 named-args 做 fail-fast", async () => {
    const { ctx } = createScopedContext();

    const localParsed = parseSlashCommands("/addvar name=score 1");
    const localResult = await executeSlashCommands(localParsed.commands, ctx);
    expect(localResult.isError).toBe(true);
    expect(localResult.errorMessage).toContain("does not support named argument");

    const globalParsed = parseSlashCommands("/addglobalvar name=score 1");
    const globalResult = await executeSlashCommands(globalParsed.commands, ctx);
    expect(globalResult.isError).toBe(true);
    expect(globalResult.errorMessage).toContain("does not support named argument");
  });
});
