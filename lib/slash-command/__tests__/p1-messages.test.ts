/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        P1 Message Commands Tests                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, vi } from "vitest";
import { parseSlashCommands } from "../parser";
import { executeSlashCommands } from "../executor";
import type { ExecutionContext } from "../types";

function createCtx(partial?: Partial<ExecutionContext>): ExecutionContext {
  const vars = new Map<string, unknown>();
  return {
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: (k) => vars.get(k),
    setVariable: (k, v) => vars.set(k, v),
    deleteVariable: (k) => vars.delete(k),
    ...partial,
  };
}

describe("P1 message commands", () => {
  it("/sendas prefers onSendAs, falls back to onSend prefix", async () => {
    const onSendAs = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ onSendAs });
    const parsed = parseSlashCommands("/sendas narrator Hello world");
    const result = await executeSlashCommands(parsed.commands, ctx);
    expect(result.isError).toBe(false);
    expect(onSendAs).toHaveBeenCalledWith("narrator", "Hello world");
    expect(ctx.onSend).not.toHaveBeenCalled();

    const ctxFallback = createCtx();
    const parsed2 = parseSlashCommands("/sendas hero Hi");
    await executeSlashCommands(parsed2.commands, ctxFallback);
    expect(ctxFallback.onSend).toHaveBeenCalledWith("[hero] Hi");
  });

  it("/sys uses onSendSystem or prefixes SYS", async () => {
    const onSendSystem = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ onSendSystem });
    const parsed = parseSlashCommands("/sys Alert");
    await executeSlashCommands(parsed.commands, ctx);
    expect(onSendSystem).toHaveBeenCalledWith("Alert");

    const ctxFallback = createCtx();
    const parsed2 = parseSlashCommands("/sys Notice");
    await executeSlashCommands(parsed2.commands, ctxFallback);
    expect(ctxFallback.onSend).toHaveBeenCalledWith("[SYS] Notice");
  });

  it("/impersonate uses onImpersonate else send + trigger", async () => {
    const onImpersonate = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ onImpersonate });
    const parsed = parseSlashCommands("/impersonate mimic");
    await executeSlashCommands(parsed.commands, ctx);
    expect(onImpersonate).toHaveBeenCalledWith("mimic");

    const ctxFallback = createCtx();
    const parsed2 = parseSlashCommands("/impersonate echo");
    await executeSlashCommands(parsed2.commands, ctxFallback);
    expect(ctxFallback.onSend).toHaveBeenCalledWith("[impersonate] echo");
    expect(ctxFallback.onTrigger).toHaveBeenCalled();
  });

  it("/continue uses onContinue else onTrigger", async () => {
    const onContinue = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ onContinue });
    const parsed = parseSlashCommands("/continue");
    await executeSlashCommands(parsed.commands, ctx);
    expect(onContinue).toHaveBeenCalled();

    const ctxFallback = createCtx();
    const parsed2 = parseSlashCommands("/continue");
    await executeSlashCommands(parsed2.commands, ctxFallback);
    expect(ctxFallback.onTrigger).toHaveBeenCalled();
  });

  it("/swipe calls onSwipe when provided, otherwise no-op", async () => {
    const onSwipe = vi.fn().mockResolvedValue(undefined);
    const ctx = createCtx({ onSwipe });
    const parsed = parseSlashCommands("/swipe 2");
    const result = await executeSlashCommands(parsed.commands, ctx);
    expect(result.isError).toBe(false);
    expect(onSwipe).toHaveBeenCalledWith("2");

    const ctxFallback = createCtx();
    const parsed2 = parseSlashCommands("/swipe");
    const res2 = await executeSlashCommands(parsed2.commands, ctxFallback);
    expect(res2.isError).toBe(false);
  });
});
