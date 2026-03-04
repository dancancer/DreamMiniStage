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
      };
      handleSlashCommandResult(callbackPayload.callbackId, `iframe:${callbackPayload.args}`);
    });

    const registered = extensionHandlers.registerSlashCommand([
      {
        name: commandName,
        hasCallback: true,
        iframeId,
      },
    ], createApiContext(iframeId));
    expect(registered).toBe(true);

    const parsed = parseSlashCommands(`/${commandName} alpha beta`);
    const result = await executeSlashCommands(parsed.commands, createMinimalContext());
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("iframe:alpha beta");

    clearIframeSlashCommands(iframeId);
    unregisterIframeDispatcher(iframeId);
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
