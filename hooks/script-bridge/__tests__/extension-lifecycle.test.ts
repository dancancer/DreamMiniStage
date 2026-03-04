/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               Extension Handlers Lifecycle Regression Tests               ║
 * ║                                                                           ║
 * ║  覆盖 registerFunctionTool/registerSlashCommand 的生命周期回归               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it, vi } from "vitest";
import {
  clearIframeFunctionTools,
  clearIframeSlashCommands,
  extensionHandlers,
  getRegisteredFunctionTools,
  handleFunctionToolResult,
  handleSlashCommandResult,
  invokeFunctionTool,
  registerIframeDispatcher,
  unregisterIframeDispatcher,
} from "../extension-handlers";
import type { ApiCallContext } from "../types";
import { createMinimalContext, executeSlashCommands } from "@/lib/slash-command/executor";
import { parseSlashCommands } from "@/lib/slash-command/parser";

function createApiContext(iframeId: string): ApiCallContext {
  return {
    iframeId,
    characterId: "char-test",
    dialogueId: "dialogue-test",
    chatId: "dialogue-test",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
  };
}

describe("extension handlers lifecycle", () => {
  it("covers register/invoke/clear/re-register for function tools", async () => {
    const iframeId = "iframe_function_lifecycle";
    const toolName = "tool_lifecycle_echo";
    const dispatchedPayloads: Array<Record<string, unknown>> = [];

    registerIframeDispatcher(iframeId, (_type, payload) => {
      dispatchedPayloads.push(payload as Record<string, unknown>);
    });

    const ctx = createApiContext(iframeId);
    const registered = extensionHandlers.registerFunctionTool([
      toolName,
      "lifecycle test tool",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx);

    expect(registered).toBe(true);
    expect(getRegisteredFunctionTools().some((tool) => tool.name === toolName)).toBe(true);

    const firstCallPromise = invokeFunctionTool(toolName, { msg: "hello" });
    const firstDispatch = dispatchedPayloads.at(-1);
    expect(firstDispatch).toBeDefined();
    handleFunctionToolResult(String(firstDispatch!.callbackId), { ok: true, round: 1 });
    await expect(firstCallPromise).resolves.toEqual({ ok: true, round: 1 });

    clearIframeFunctionTools(iframeId);
    await expect(invokeFunctionTool(toolName, {})).rejects.toThrow("Function tool not found");

    const reRegistered = extensionHandlers.registerFunctionTool([
      toolName,
      "lifecycle test tool v2",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx);
    expect(reRegistered).toBe(true);

    const secondCallPromise = invokeFunctionTool(toolName, { msg: "world" });
    const secondDispatch = dispatchedPayloads.at(-1);
    expect(secondDispatch).toBeDefined();
    handleFunctionToolResult(String(secondDispatch!.callbackId), { ok: true, round: 2 });
    await expect(secondCallPromise).resolves.toEqual({ ok: true, round: 2 });

    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
  });

  it("supports sync and async function tool callbacks", async () => {
    const iframeId = "iframe_function_callback_modes";
    const syncTool = "tool_sync_callback";
    const asyncTool = "tool_async_callback";

    registerIframeDispatcher(iframeId, (_type, payload) => {
      const { name, args, callbackId } = payload as {
        name: string;
        args: Record<string, unknown>;
        callbackId: string;
      };
      if (name === syncTool) {
        handleFunctionToolResult(callbackId, {
          mode: "sync",
          echo: args.input,
        });
        return;
      }
      if (name === asyncTool) {
        setTimeout(() => {
          handleFunctionToolResult(callbackId, {
            mode: "async",
            echo: args.input,
          });
        }, 5);
      }
    });

    const ctx = createApiContext(iframeId);
    expect(extensionHandlers.registerFunctionTool([
      syncTool,
      "sync callback",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx)).toBe(true);
    expect(extensionHandlers.registerFunctionTool([
      asyncTool,
      "async callback",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx)).toBe(true);

    await expect(invokeFunctionTool(syncTool, { input: "S" })).resolves.toEqual({
      mode: "sync",
      echo: "S",
    });
    await expect(invokeFunctionTool(asyncTool, { input: "A" })).resolves.toEqual({
      mode: "async",
      echo: "A",
    });

    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
  });

  it("fails fast when iframe callback reports error", async () => {
    const iframeId = "iframe_function_callback_error";
    const toolName = "tool_callback_error";

    registerIframeDispatcher(iframeId, (_type, payload) => {
      const { callbackId } = payload as { callbackId: string };
      handleFunctionToolResult(callbackId, undefined, "boom");
    });

    const ctx = createApiContext(iframeId);
    expect(extensionHandlers.registerFunctionTool([
      toolName,
      "error callback",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx)).toBe(true);

    await expect(invokeFunctionTool(toolName, { input: "x" })).rejects.toThrow("boom");

    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
  });

  it("times out when iframe never returns callback result", async () => {
    vi.useFakeTimers();
    const iframeId = "iframe_function_timeout";
    const toolName = "tool_callback_timeout";

    registerIframeDispatcher(iframeId, () => {
      // 故意不回传 callback 结果，触发超时分支
    });

    const ctx = createApiContext(iframeId);
    expect(extensionHandlers.registerFunctionTool([
      toolName,
      "timeout callback",
      { type: "object", properties: {} },
      false,
      iframeId,
    ], ctx)).toBe(true);

    const pending = invokeFunctionTool(toolName, { input: "wait" });
    const assertion = expect(pending).rejects.toThrow("Function tool timeout");
    await vi.advanceTimersByTimeAsync(30001);
    await assertion;

    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
    vi.useRealTimers();
  });

  it("covers register/call/clear/re-register for slash commands", async () => {
    const iframeId = "iframe_slash_lifecycle";
    const commandName = "lifecyclecmdxyz";
    const firstCallback = vi.fn().mockResolvedValue("v1");
    const secondCallback = vi.fn().mockResolvedValue("v2");

    const firstRegister = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback: firstCallback,
      },
    ], createApiContext(iframeId));
    expect(firstRegister).toBe(true);

    const firstParsed = parseSlashCommands(`/${commandName} alpha`);
    const firstResult = await executeSlashCommands(firstParsed.commands, createMinimalContext());
    expect(firstResult.isError).toBe(false);
    expect(firstResult.pipe).toBe("v1");
    expect(firstCallback).toHaveBeenCalledTimes(1);

    clearIframeSlashCommands(iframeId);

    const secondRegister = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback: secondCallback,
      },
    ], createApiContext(iframeId));
    expect(secondRegister).toBe(true);

    const secondParsed = parseSlashCommands(`/${commandName} beta`);
    const secondResult = await executeSlashCommands(secondParsed.commands, createMinimalContext());
    expect(secondResult.isError).toBe(false);
    expect(secondResult.pipe).toBe("v2");
    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  it("bridges slash command callback through iframe dispatcher", async () => {
    const iframeId = "iframe_slash_bridge";
    const commandName = "bridgecmdxyz";

    registerIframeDispatcher(iframeId, (type, payload) => {
      if (type !== "SLASH_COMMAND_CALL") {
        return;
      }
      const callbackPayload = payload as {
        callbackId: string;
        args: string;
        unnamedArgs: string[];
        namedArgs: Record<string, string>;
        namedArgumentList: Array<{ name: string; value: string; isRequired: boolean }>;
        unnamedArgumentList: Array<{ value: string; isRequired: boolean }>;
      };
      expect(callbackPayload.args).toBe("alpha beta");
      expect(callbackPayload.unnamedArgs).toEqual(["alpha", "beta"]);
      expect(callbackPayload.namedArgs).toEqual({ mode: "strict" });
      expect(callbackPayload.namedArgumentList).toEqual([
        expect.objectContaining({ name: "mode", value: "strict", isRequired: true }),
      ]);
      expect(callbackPayload.unnamedArgumentList).toEqual([
        expect.objectContaining({ value: "alpha", isRequired: true }),
        expect.objectContaining({ value: "beta", isRequired: false }),
      ]);
      handleSlashCommandResult(callbackPayload.callbackId, `iframe:${callbackPayload.args}`);
    });

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        hasCallback: true,
        iframeId,
        namedArgumentList: [
          {
            name: "mode",
            isRequired: true,
          },
        ],
        unnamedArgumentList: [
          {
            isRequired: true,
          },
          {
            isRequired: false,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} mode=strict alpha beta`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("iframe:alpha beta");

    clearIframeSlashCommands(iframeId);
    unregisterIframeDispatcher(iframeId);
  });

  it("fails fast when slash command misses required named argument", async () => {
    const iframeId = "iframe_slash_required_named";
    const commandName = "requirednamedcmd";

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback: vi.fn().mockResolvedValue("ok"),
        namedArgumentList: [
          {
            name: "mode",
            isRequired: true,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} alpha`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(true);
    expect(result.errorMessage ?? "").toContain("missing required named argument(s): mode");

    clearIframeSlashCommands(iframeId);
  });

  it("fails fast when slash command receives unsupported named argument", async () => {
    const iframeId = "iframe_slash_unknown_named";
    const commandName = "unknownnamedcmd";

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback: vi.fn().mockResolvedValue("ok"),
        namedArgumentList: [
          {
            name: "mode",
            isRequired: false,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} wrong=1 alpha`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(true);
    expect(result.errorMessage ?? "").toContain("unsupported named argument(s): wrong");

    clearIframeSlashCommands(iframeId);
  });

  it("fails fast when slash command receives too many unnamed arguments", async () => {
    const iframeId = "iframe_slash_unnamed_overflow";
    const commandName = "unnamedoverflowcmd";

    const callback = vi.fn().mockResolvedValue("ok");
    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        unnamedArgumentList: [
          {
            isRequired: true,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} alpha beta`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(true);
    expect(result.errorMessage ?? "").toContain("too many unnamed arguments");
    expect(callback).not.toHaveBeenCalled();

    clearIframeSlashCommands(iframeId);
  });

  it("passes structured argument lists into local slash callback context", async () => {
    const iframeId = "iframe_slash_structured_context";
    const commandName = "structuredcontextcmd";
    const callback = vi.fn().mockResolvedValue("ok");

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        namedArgumentList: [
          {
            name: "style",
            isRequired: true,
          },
        ],
        unnamedArgumentList: [
          {
            description: "content",
            isRequired: true,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} style=compact hello`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");
    expect(callback).toHaveBeenCalledTimes(1);

    const invocation = callback.mock.calls[0] as [
      string,
      Record<string, string>,
      {
        namedArgumentList?: Array<{ name: string; value: string; isRequired: boolean }>;
        unnamedArgumentList?: Array<{ value: string; description?: string; isRequired: boolean }>;
      },
    ];
    expect(invocation[0]).toBe("hello");
    expect(invocation[1]).toEqual({ style: "compact" });
    expect(invocation[2].namedArgumentList).toEqual([
      expect.objectContaining({ name: "style", value: "compact", isRequired: true }),
    ]);
    expect(invocation[2].unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "hello", description: "content", isRequired: true }),
    ]);

    clearIframeSlashCommands(iframeId);
  });

  it("aggregates acceptsMultiple named args and keeps assignment order", async () => {
    const iframeId = "iframe_slash_accepts_multiple";
    const commandName = "acceptsmultiplecmd";
    const callback = vi.fn().mockResolvedValue("ok");

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        namedArgumentList: [
          {
            name: "tag",
            acceptsMultiple: true,
            isRequired: true,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} tag=alpha tag=\"beta value\" tag='gamma'`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");

    const invocation = callback.mock.calls[0] as [
      string,
      Record<string, unknown>,
      {
        namedArgumentList?: Array<{ name: string; value: string; wasQuoted: boolean }>;
      },
    ];
    expect(invocation[1]).toEqual({
      tag: ["alpha", "beta value", "gamma"],
    });
    expect(invocation[2].namedArgumentList).toEqual([
      expect.objectContaining({ name: "tag", value: "alpha", wasQuoted: false }),
      expect.objectContaining({ name: "tag", value: "beta value", wasQuoted: true }),
      expect.objectContaining({ name: "tag", value: "gamma", wasQuoted: true }),
    ]);

    clearIframeSlashCommands(iframeId);
  });

  it("injects default values for missing named and unnamed arguments", async () => {
    const iframeId = "iframe_slash_defaults";
    const commandName = "defaultinjectcmd";
    const callback = vi.fn().mockResolvedValue("ok");

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        namedArgumentList: [
          {
            name: "mode",
            defaultValue: "strict",
          },
        ],
        unnamedArgumentList: [
          {
            isRequired: true,
            defaultValue: "hello",
          },
          {
            defaultValue: "world",
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName}`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");

    const invocation = callback.mock.calls[0] as [
      string,
      Record<string, unknown>,
      {
        namedArgumentList?: Array<{ name: string; value: string; isDefaultValue: boolean }>;
        unnamedArgumentList?: Array<{ value: string; isDefaultValue: boolean }>;
      },
    ];
    expect(invocation[0]).toBe("hello world");
    expect(invocation[1]).toEqual({
      mode: "strict",
    });
    expect(invocation[2].namedArgumentList).toEqual([
      expect.objectContaining({ name: "mode", value: "strict", isDefaultValue: true }),
    ]);
    expect(invocation[2].unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "hello", isDefaultValue: true }),
      expect.objectContaining({ value: "world", isDefaultValue: true }),
    ]);

    clearIframeSlashCommands(iframeId);
  });

  it("keeps raw quoted unnamed args when rawQuotes is enabled and supports raw=false override", async () => {
    const iframeId = "iframe_slash_raw_quotes";
    const commandName = "rawquotescmd";
    const callback = vi.fn(async (args: string) => args);

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        rawQuotes: true,
        unnamedArgumentList: [
          {
            isRequired: true,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const rawParsed = parseSlashCommands(`/${commandName} "hello world"`);
    const rawResult = await executeSlashCommands(rawParsed.commands, createMinimalContext());
    expect(rawResult.isError).toBe(false);
    expect(rawResult.pipe).toBe("\"hello world\"");

    const normalizedParsed = parseSlashCommands(`/${commandName} raw=false "hello world"`);
    const normalizedResult = await executeSlashCommands(normalizedParsed.commands, createMinimalContext());
    expect(normalizedResult.isError).toBe(false);
    expect(normalizedResult.pipe).toBe("hello world");

    const firstInvocation = callback.mock.calls[0] as [
      string,
      Record<string, unknown>,
      {
        unnamedArgumentList?: Array<{ value: string; rawValue: string; wasQuoted: boolean }>;
      },
    ];
    expect(firstInvocation[2].unnamedArgumentList).toEqual([
      expect.objectContaining({
        value: "\"hello world\"",
        rawValue: "\"hello world\"",
        wasQuoted: true,
      }),
    ]);

    const secondInvocation = callback.mock.calls[1] as [
      string,
      Record<string, unknown>,
      {
        unnamedArgumentList?: Array<{ value: string; rawValue: string; wasQuoted: boolean }>;
      },
    ];
    expect(secondInvocation[2].unnamedArgumentList).toEqual([
      expect.objectContaining({
        value: "hello world",
        rawValue: "\"hello world\"",
        wasQuoted: true,
      }),
    ]);

    clearIframeSlashCommands(iframeId);
  });

  it("keeps last named arg value when acceptsMultiple is disabled while preserving full list", async () => {
    const iframeId = "iframe_slash_repeated_named";
    const commandName = "repeatednamedcmd";
    const callback = vi.fn().mockResolvedValue("ok");

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        callback,
        namedArgumentList: [
          {
            name: "mode",
            acceptsMultiple: false,
          },
        ],
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} mode=first mode=second`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");

    const invocation = callback.mock.calls[0] as [
      string,
      Record<string, unknown>,
      {
        namedArgumentList?: Array<{ name: string; value: string }>;
      },
    ];
    expect(invocation[1]).toEqual({ mode: "second" });
    expect(invocation[2].namedArgumentList).toEqual([
      expect.objectContaining({ name: "mode", value: "first" }),
      expect.objectContaining({ name: "mode", value: "second" }),
    ]);

    clearIframeSlashCommands(iframeId);
  });

  it("fails fast when registerSlashCommand has no callback path", () => {
    const result = extensionHandlers.registerSlashCommand([
      {
        name: "invalidslashcallback",
      },
    ], createApiContext("iframe_invalid_slash_callback"));

    expect(result).toBe(false);
  });
});
