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
});
