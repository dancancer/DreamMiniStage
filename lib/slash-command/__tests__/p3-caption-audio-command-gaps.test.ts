import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-caption-audio-${contextSeed}`,
    messages: [
      { id: `m-${contextSeed}-0`, role: "user", content: "hello" },
      { id: `m-${contextSeed}-1`, role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 caption/beep command gaps", () => {
  it("/caption 支持 prompt/quiet/mesId/index 参数透传", async () => {
    const generateCaption = vi
      .fn()
      .mockResolvedValueOnce("A cat sitting by the window")
      .mockResolvedValueOnce("A sunny beach");
    const ctx = createContext({ generateCaption });

    const detailed = await executeSlashCommandScript(
      "/caption quiet=true mesId=12 index=2 describe this image",
      ctx,
    );
    const alias = await executeSlashCommandScript("/caption id=7", ctx);

    expect(detailed).toMatchObject({
      isError: false,
      pipe: "A cat sitting by the window",
    });
    expect(alias).toMatchObject({
      isError: false,
      pipe: "A sunny beach",
    });

    expect(generateCaption).toHaveBeenNthCalledWith(1, {
      prompt: "describe this image",
      quiet: true,
      mesId: 12,
      index: 2,
    });
    expect(generateCaption).toHaveBeenNthCalledWith(2, {
      prompt: undefined,
      quiet: false,
      mesId: 7,
      index: 0,
    });
  });

  it("/caption 支持从 pipe 读取 prompt", async () => {
    const generateCaption = vi.fn().mockResolvedValue("pipeline caption");
    const ctx = createContext({ generateCaption });

    const result = await executeSlashCommandScript("/echo a blue sky | /caption", ctx);

    expect(result).toMatchObject({ isError: false, pipe: "pipeline caption" });
    expect(generateCaption).toHaveBeenCalledWith({
      prompt: "a blue sky",
      quiet: false,
      mesId: undefined,
      index: 0,
    });
  });

  it("/beep 与 /ding 触发同一提示音回调", async () => {
    const playNotificationSound = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ playNotificationSound });

    const beep = await executeSlashCommandScript("/beep", ctx);
    const ding = await executeSlashCommandScript("/ding", ctx);

    expect(beep).toMatchObject({ isError: false, pipe: "" });
    expect(ding).toMatchObject({ isError: false, pipe: "" });
    expect(playNotificationSound).toHaveBeenCalledTimes(2);
  });

  it("caption/beep 在宿主缺失时显式 fail-fast", async () => {
    const noHostCtx = createContext();

    const caption = await executeSlashCommandScript("/caption prompt text", noHostCtx);
    const beep = await executeSlashCommandScript("/beep", noHostCtx);

    expect(caption.isError).toBe(true);
    expect(beep.isError).toBe(true);
    expect(caption.errorMessage).toContain("not available");
    expect(beep.errorMessage).toContain("not available");
  });

  it("/caption 对非法参数与异常返回值显式 fail-fast", async () => {
    const generateCaption = vi.fn().mockResolvedValue("ok");
    const ctx = createContext({ generateCaption });

    const badQuiet = await executeSlashCommandScript("/caption quiet=maybe test", ctx);
    const badMesId = await executeSlashCommandScript("/caption mesId=abc test", ctx);
    const badIndex = await executeSlashCommandScript("/caption index=-1 test", ctx);

    expect(badQuiet.isError).toBe(true);
    expect(badMesId.isError).toBe(true);
    expect(badIndex.isError).toBe(true);
    expect(badQuiet.errorMessage).toContain("invalid quiet");
    expect(badMesId.errorMessage).toContain("invalid mesId");
    expect(badIndex.errorMessage).toContain("invalid index");

    const badReturn = await executeSlashCommandScript(
      "/caption return-type-check",
      createContext({
        generateCaption: vi.fn().mockResolvedValue(123 as unknown as string),
      }),
    );

    expect(badReturn.isError).toBe(true);
    expect(badReturn.errorMessage).toContain("must return a string");
  });
});
