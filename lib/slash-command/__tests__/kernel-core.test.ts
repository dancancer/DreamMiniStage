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
import { getDebugMonitor } from "../core/debug";
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

  it("preserves repeated named assignment order and quote metadata", () => {
    const parsed = parseKernelScript("/echo mode=first mode=\"second value\" mode='third'");
    expect(parsed.isError).toBe(false);

    const node = parsed.script[0];
    if (node.type !== "command") throw new Error("expected command node");

    expect(node.namedArgs).toEqual({ mode: "third" });
    expect(node.namedArgumentList).toEqual([
      expect.objectContaining({ name: "mode", value: "first", wasQuoted: false }),
      expect.objectContaining({ name: "mode", value: "second value", wasQuoted: true }),
      expect.objectContaining({ name: "mode", value: "third", wasQuoted: true }),
    ]);
  });

  it("applies parser-flag to later segments and snapshots parserFlags/scopeDepth", () => {
    const parsed = parseKernelScript(
      "/parser-flag REPLACE_GETVAR on|/echo value={{getvar::foo}}|{: /echo value={{getglobalvar::bar}} :}",
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const root = parsed.script[0];
    if (root.type !== "command") throw new Error("expected root command");
    expect(root.scopeDepth).toBe(0);
    expect(root.parserFlags.REPLACE_GETVAR).toBe(true);
    expect(root.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "{{var::foo}}" }),
    ]);

    const block = parsed.script[1];
    if (block.type !== "block") throw new Error("expected block node");
    expect(block.body).toHaveLength(1);

    const nested = block.body[0];
    if (nested.type !== "command") throw new Error("expected nested command");
    expect(nested.scopeDepth).toBe(1);
    expect(nested.parserFlags.REPLACE_GETVAR).toBe(true);
    expect(nested.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "{{globalvar::bar}}" }),
    ]);
  });

  it("enforces quote closure when STRICT_ESCAPING is enabled", () => {
    const strictResult = parseKernelScript("/parser-flag STRICT_ESCAPING on|/echo \"unterminated");
    expect(strictResult.isError).toBe(true);

    const looseResult = parseKernelScript("/parser-flag STRICT_ESCAPING off|/echo \"unterminated");
    expect(looseResult.isError).toBe(false);
    expect(looseResult.script).toHaveLength(1);
  });

  it("keeps escaped quote + inner pipe stable across STRICT_ESCAPING toggles", () => {
    const parsed = parseKernelScript(
      "/parser-flag STRICT_ESCAPING on|/echo value=\"a\\\"|b\"|/parser-flag STRICT_ESCAPING off|/echo \"unterminated",
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const strictEcho = parsed.script[0];
    if (strictEcho.type !== "command") throw new Error("expected command node");
    expect(strictEcho.parserFlags.STRICT_ESCAPING).toBe(true);
    expect(strictEcho.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "a\\\"|b", wasQuoted: true }),
    ]);

    const looseEcho = parsed.script[1];
    if (looseEcho.type !== "command") throw new Error("expected command node");
    expect(looseEcho.parserFlags.STRICT_ESCAPING).toBe(false);
    expect(looseEcho.unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "\"unterminated", wasQuoted: false }),
    ]);
  });

  it("applies REPLACE_GETVAR after strict quote parsing with escaped quotes", () => {
    const parsed = parseKernelScript(
      "/parser-flag REPLACE_GETVAR on|/parser-flag STRICT_ESCAPING on|/echo value=\"{{getvar::foo}}\\\"tail\"",
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(1);

    const node = parsed.script[0];
    if (node.type !== "command") throw new Error("expected command node");
    expect(node.parserFlags.REPLACE_GETVAR).toBe(true);
    expect(node.parserFlags.STRICT_ESCAPING).toBe(true);
    expect(node.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "{{var::foo}}\\\"tail", wasQuoted: true }),
    ]);
  });

  it("keeps block delimiters inside quoted text while parsing nested blocks", () => {
    const parsed = parseKernelScript(
      "/if cond {: /echo \"literal :} marker\"|/echo 'literal {: marker' :}|/echo tail",
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const ifNode = parsed.script[0];
    if (ifNode.type !== "if") throw new Error("expected if node");
    expect(ifNode.condition).toBe("cond");
    expect(ifNode.thenBlock).toHaveLength(2);

    const firstInner = ifNode.thenBlock[0];
    if (firstInner.type !== "command") throw new Error("expected command node");
    expect(firstInner.unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "literal :} marker", wasQuoted: true }),
    ]);

    const secondInner = ifNode.thenBlock[1];
    if (secondInner.type !== "command") throw new Error("expected command node");
    expect(secondInner.unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "literal {: marker", wasQuoted: true }),
    ]);
  });

  it("keeps mixed-quote block literals stable under STRICT_ESCAPING", () => {
    const parsed = parseKernelScript(
      "/parser-flag STRICT_ESCAPING on|/if cond {: /echo value=\"outer 'inner' :} marker\"|/echo text='outer \"inner\" {: marker' :}|/echo done",
    );
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const ifNode = parsed.script[0];
    if (ifNode.type !== "if") throw new Error("expected if node");
    expect(ifNode.thenBlock).toHaveLength(2);

    const firstInner = ifNode.thenBlock[0];
    if (firstInner.type !== "command") throw new Error("expected command node");
    expect(firstInner.parserFlags.STRICT_ESCAPING).toBe(true);
    expect(firstInner.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "outer 'inner' :} marker", wasQuoted: true }),
    ]);

    const secondInner = ifNode.thenBlock[1];
    if (secondInner.type !== "command") throw new Error("expected command node");
    expect(secondInner.namedArgumentList).toEqual([
      expect.objectContaining({ name: "text", value: "outer \"inner\" {: marker", wasQuoted: true }),
    ]);
  });

  it("keeps multi-level block delimiters stable with escaped-quote payloads", () => {
    const parsed = parseKernelScript(String.raw`/parser-flag STRICT_ESCAPING on|/if outer {: /if inner {: /echo value="a\"b :} c"|/echo text='x {: y \\ z' :} :}|/echo tail`);
    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const outerIf = parsed.script[0];
    if (outerIf.type !== "if") throw new Error("expected outer if node");
    expect(outerIf.thenBlock).toHaveLength(1);

    const innerIf = outerIf.thenBlock[0];
    if (innerIf.type !== "if") throw new Error("expected inner if node");
    expect(innerIf.thenBlock).toHaveLength(2);

    const firstInner = innerIf.thenBlock[0];
    if (firstInner.type !== "command") throw new Error("expected command node");
    expect(firstInner.parserFlags.STRICT_ESCAPING).toBe(true);
    expect(firstInner.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "a\\\"b :} c", wasQuoted: true }),
    ]);

    const secondInner = innerIf.thenBlock[1];
    if (secondInner.type !== "command") throw new Error("expected command node");
    expect(secondInner.namedArgumentList).toEqual([
      expect.objectContaining({ name: "text", value: "x {: y \\\\ z", wasQuoted: true }),
    ]);
  });

  it("fails fast on even-backslash quote boundary in nested strict blocks", () => {
    const parsed = parseKernelScript(String.raw`/parser-flag STRICT_ESCAPING on|/if outer {: /if inner {: /echo value="a\\"b :} c" :} :}|/echo tail`);
    expect(parsed.isError).toBe(true);
    expect(parsed.errorMessage).toContain("Unclosed quote under STRICT_ESCAPING");
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

describe("compat parser metadata", () => {
  it("keeps repeated named args in list while namedArgs remains last-write", () => {
    const parsed = parseSlashCommands("/echo mode=first mode=\"second value\"");
    expect(parsed.isError).toBe(false);

    const command = parsed.commands[0];
    expect(command.namedArgs).toEqual({ mode: "second value" });
    expect(command.namedArgumentList).toEqual([
      expect.objectContaining({ name: "mode", value: "first", wasQuoted: false }),
      expect.objectContaining({ name: "mode", value: "second value", wasQuoted: true }),
    ]);
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

  it("emits breakpoint debug events when debug mode is enabled", async () => {
    const monitor = getDebugMonitor();
    monitor.enable();
    monitor.clearEvents();

    try {
      const parsed = parseKernelScript(
        "/echo start|/breakpoint|{: /breakpoint :}|/echo end",
        { debugEnabled: true },
      );
      expect(parsed.isError).toBe(false);

      const result = await executeScript(parsed.script, {
        resolveCommand,
        context: minimalCtx,
      });

      expect(result.pipe).toBe("end");
      const events = monitor.getRecentEvents(20).flatMap((event) => (
        event.type === "debug:breakpoint" ? [event] : []
      ));
      expect(events).toHaveLength(2);
      expect(events.map((event) => event.scopeDepth)).toEqual([0, 1]);
    } finally {
      monitor.disable();
      monitor.clearEvents();
    }
  });
});
