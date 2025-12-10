/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Slash Command Core Kernel Tests                      ║
 * ║                                                                           ║
 * ║  覆盖解析/作用域/执行器的基础行为                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
import { parseKernelScript } from "../core/parser";
import { parseSlashCommands } from "../parser";
import { ScopeChain } from "../core/scope";
import { executeScript } from "../core/executor";
import { executeSlashCommands } from "../executor";
import type { CommandDescriptor, CommandResolver } from "../core/types";
import type { ExecutionContext } from "../types";

const minimalCtx: ExecutionContext = {
  messages: [],
  onSend: async (_text?: string) => {},
  onTrigger: async (_member?: string) => {},
  getVariable: () => undefined,
  setVariable: () => {},
  deleteVariable: () => {},
};

const registry = new Map<string, CommandDescriptor>([
  ["echo", { name: "echo", handler: (args, _named, _ctx, pipe) => args[0] ?? pipe }],
  [
    "set",
    {
      name: "set",
      handler: (args, named, _ctx, pipe, scope) => {
        if (Object.keys(named).length > 0) {
          for (const [key, value] of Object.entries(named)) scope.set(key, value);
          return pipe;
        }
        if (args.length >= 2) {
          scope.set(args[0], args.slice(1).join(" "));
          return scope.get(args[0]) as string;
        }
        if (args.length === 2) {
          scope.set(args[0], args[1]);
          return args[1];
        }
        return pipe;
      },
    },
  ],
  [
    "get",
    {
      name: "get",
      handler: (args, _named, _ctx, pipe, scope) => {
        if (!args[0]) return pipe;
        const value = scope.get(args[0]);
        return value === undefined ? "" : String(value);
      },
    },
  ],
  [
    "dec",
    {
      name: "dec",
      handler: (args, _named, _ctx, pipe, scope) => {
        const key = args[0];
        if (!key) return pipe;
        const current = Number(scope.get(key) ?? 0);
        const next = current > 0 ? current - 1 : 0;
        scope.set(key, next);
        return String(next);
      },
    },
  ],
]);

const resolveCommand: CommandResolver = (name) => registry.get(name);

describe("parser — nested blocks and pipes", () => {
  it("should keep pipes inside blocks without splitting top-level", () => {
    const parsed = parseKernelScript("/if cond {: /echo a|/echo b :}|/echo c");
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const ifNode = parsed.script[0];
    if (ifNode.type !== "if") throw new Error("expected if node");
    expect(ifNode.thenBlock).toHaveLength(2);
  });

  it("should parse else blocks when provided", () => {
    const parsed = parseKernelScript("/if cond {: /echo yes :} {: /echo no :}");
    expect(parsed.isError).toBe(false);
    const node = parsed.script[0];
    if (node.type !== "if") throw new Error("expected if node");
    expect(node.thenBlock).toHaveLength(1);
    expect(node.elseBlock).toHaveLength(1);
  });
});

describe("scope chain — shadowing and cleanup", () => {
  it("supports push/pop and value shadowing", () => {
    const scope = new ScopeChain();
    scope.set("x", "1");
    expect(scope.get("x")).toBe("1");

    scope.push();
    scope.setLocal("x", "2");
    expect(scope.get("x")).toBe("2");

    scope.pop();
    expect(scope.get("x")).toBe("1");
    scope.delete("x");
    expect(scope.get("x")).toBeUndefined();
  });
});

describe("executor — control flow and signals", () => {
  it("executes while loop until condition falsy", async () => {
    const parsed = parseKernelScript("/set loop=3|/while loop {: /dec loop :}|/get loop");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.signal).toBeUndefined();
    expect(result.pipe).toBe("0");
  });

  it("propagates return signals out of loops", async () => {
    const parsed = parseKernelScript("/times 3 {: /return stop :}|/echo tail");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.signal?.kind).toBe("return");
    expect(result.signal?.value).toBe("stop");
    expect(result.pipe).toBe("stop");
  });

  it("runs then branch when condition truthy", async () => {
    const parsed = parseKernelScript("/if ok {: /echo yes :} {: /echo no :}|/echo tail");
    expect(parsed.isError).toBe(false);

    const spy = vi.spyOn(registry.get("echo")!, "handler");
    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.pipe).toBe("tail");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("supports /let and /var setting scoped values and using pipe", async () => {
    const parsed = parseKernelScript("/echo val|/let foo|/if foo {: /echo hit :} {: /echo miss :}");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.pipe).toBe("hit");
  });

  it("creates block scope for {: :} and keeps outer binding intact", async () => {
    const parsed = parseKernelScript("/let x=1|/if yes {: /let x=2|/get x :}|/get x");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    // inner block sees x=2, outer remains x=1; final pipe from last /get is outer value
    expect(result.pipe).toBe("1");
  });

  it("propagates /return from command handler and stops execution", async () => {
    const parsed = parseKernelScript("/echo a|/return b|/echo c");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.signal?.kind).toBe("return");
    expect(result.signal?.value).toBe("b");
    expect(result.pipe).toBe("b");
  });

  it("compat path maps /return to control signal (executeSlashCommands)", async () => {
    const parsed = parseSlashCommands("/echo a|/return b|/echo c");
    expect(parsed.isError).toBe(false);

    const result = await executeSlashCommands(parsed.commands, minimalCtx);
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("b");
  });

  it("break exits loop block scope", async () => {
    const parsed = parseKernelScript("/set loop=3|/while loop {: /break :}|/echo tail");
    expect(parsed.isError).toBe(false);

    const result = await executeScript(parsed.script, {
      resolveCommand,
      context: minimalCtx,
    });

    expect(result.pipe).toBe("tail");
  });
});
