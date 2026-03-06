import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-summary-1",
    dialogueId: "dialogue-summary-1",
    messages: [
      { id: "m-0", role: "user", content: "hello there" },
      { id: "m-1", role: "assistant", content: "general kenobi" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 summarize command gaps", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("/summarize 使用 generateRaw，并支持文本与当前聊天回退", async () => {
    const generateRaw = vi
      .fn()
      .mockResolvedValueOnce("text summary")
      .mockResolvedValueOnce("chat summary");
    const ctx = createContext({ generateRaw });

    const explicit = await executeSlashCommandScript(
      "/summarize prompt=\"Summarize sharply\" Important facts only",
      ctx,
    );
    const fallback = await executeSlashCommandScript("/summarize source=main quiet=true", ctx);

    expect(explicit).toMatchObject({ isError: false, pipe: "text summary" });
    expect(fallback).toMatchObject({ isError: false, pipe: "chat summary" });
    expect(generateRaw).toHaveBeenNthCalledWith(1, "Important facts only", {
      lock: false,
      instruct: true,
      as: "system",
      systemPrompt: "Summarize sharply",
      responseLength: 256,
      trimNames: true,
    });
    expect(generateRaw).toHaveBeenNthCalledWith(2, "user: hello there\nassistant: general kenobi", {
      lock: false,
      instruct: true,
      as: "system",
      systemPrompt: expect.stringContaining("Summarize the provided chat or text"),
      responseLength: 256,
      trimNames: true,
    });
  });

  it("/summarize 对缺少宿主、非法参数、异常返回显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/summarize text", createContext());
    const badSource = await executeSlashCommandScript(
      "/summarize source=extras text",
      createContext({ generateRaw: vi.fn().mockResolvedValue("ok") }),
    );
    const badQuiet = await executeSlashCommandScript(
      "/summarize quiet=maybe text",
      createContext({ generateRaw: vi.fn().mockResolvedValue("ok") }),
    );
    const badReturn = await executeSlashCommandScript(
      "/summarize text",
      createContext({ generateRaw: vi.fn().mockResolvedValue(123 as unknown as string) }),
    );

    expect(missing.isError).toBe(true);
    expect(badSource.isError).toBe(true);
    expect(badQuiet.isError).toBe(true);
    expect(badReturn.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(badSource.errorMessage).toContain("unsupported source");
    expect(badQuiet.errorMessage).toContain("invalid quiet value");
    expect(badReturn.errorMessage).toContain("non-string result");
  });
});
