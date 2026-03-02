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

  it("/setglobalvar /addglobalvar /getglobalvar use scoped global store", async () => {
    const { ctx, local, global } = createScopedContext();

    const parsed = parseSlashCommands("/setglobalvar key=coins 3|/addglobalvar key=coins 7|/setvar coins 100|/getglobalvar coins");
    const result = await executeSlashCommands(parsed.commands, ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("10");
    expect(local.get("coins")).toBe("100");
    expect(global.get("coins")).toBe(10);
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
});
