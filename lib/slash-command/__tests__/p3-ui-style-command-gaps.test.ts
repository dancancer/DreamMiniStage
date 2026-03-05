import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-ui-style-${contextSeed}`,
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

describe("P3 ui style + injection maintenance command gaps", () => {
  it("/bubble|/flat|/single + /bgcol + /buttons 可执行并透传参数", async () => {
    const setChatDisplayMode = vi.fn().mockResolvedValue(undefined);
    const setAverageBackgroundColor = vi
      .fn()
      .mockResolvedValueOnce("rgb(10, 20, 30)")
      .mockResolvedValueOnce("#112233");
    const showButtonsPopup = vi
      .fn()
      .mockResolvedValueOnce("Yes")
      .mockResolvedValueOnce(["A", "C"]);
    const ctx = createContext({
      setChatDisplayMode,
      setAverageBackgroundColor,
      showButtonsPopup,
    });

    const bubble = await executeSlashCommandScript("/bubble", ctx);
    const bubbles = await executeSlashCommandScript("/bubbles", ctx);
    const flat = await executeSlashCommandScript("/flat", ctx);
    const defaults = await executeSlashCommandScript("/default", ctx);
    const single = await executeSlashCommandScript("/single", ctx);
    const story = await executeSlashCommandScript("/story", ctx);
    const bgcolAuto = await executeSlashCommandScript("/bgcol", ctx);
    const bgcolWithColor = await executeSlashCommandScript("/bgcol #112233", ctx);
    const buttons = await executeSlashCommandScript("/buttons labels=[\"Yes\",\"No\"] Continue?", ctx);
    const buttonsMulti = await executeSlashCommandScript(
      "/buttons multiple=true labels=[\"A\",\"B\",\"C\"] Select tags",
      ctx,
    );

    expect(bubble).toMatchObject({ isError: false, pipe: "" });
    expect(bubbles).toMatchObject({ isError: false, pipe: "" });
    expect(flat).toMatchObject({ isError: false, pipe: "" });
    expect(defaults).toMatchObject({ isError: false, pipe: "" });
    expect(single).toMatchObject({ isError: false, pipe: "" });
    expect(story).toMatchObject({ isError: false, pipe: "" });
    expect(bgcolAuto).toMatchObject({ isError: false, pipe: "rgb(10, 20, 30)" });
    expect(bgcolWithColor).toMatchObject({ isError: false, pipe: "#112233" });
    expect(buttons).toMatchObject({ isError: false, pipe: "Yes" });
    expect(buttonsMulti).toMatchObject({ isError: false, pipe: "[\"A\",\"C\"]" });

    expect(setChatDisplayMode).toHaveBeenNthCalledWith(1, "bubble");
    expect(setChatDisplayMode).toHaveBeenNthCalledWith(2, "bubble");
    expect(setChatDisplayMode).toHaveBeenNthCalledWith(3, "default");
    expect(setChatDisplayMode).toHaveBeenNthCalledWith(4, "default");
    expect(setChatDisplayMode).toHaveBeenNthCalledWith(5, "document");
    expect(setChatDisplayMode).toHaveBeenNthCalledWith(6, "document");
    expect(setAverageBackgroundColor).toHaveBeenNthCalledWith(1, undefined);
    expect(setAverageBackgroundColor).toHaveBeenNthCalledWith(2, "#112233");
    expect(showButtonsPopup).toHaveBeenNthCalledWith(
      1,
      "Continue?",
      ["Yes", "No"],
      { multiple: false },
    );
    expect(showButtonsPopup).toHaveBeenNthCalledWith(
      2,
      "Select tags",
      ["A", "B", "C"],
      { multiple: true },
    );
  });

  it("/buttons 与 /bgcol 对参数错误或宿主返回异常显式 fail-fast", async () => {
    const showButtonsPopup = vi.fn().mockResolvedValue("");
    const setAverageBackgroundColor = vi.fn().mockResolvedValue(42);
    const ctx = createContext({
      showButtonsPopup,
      setAverageBackgroundColor,
    });

    const missingLabels = await executeSlashCommandScript("/buttons Choose now", ctx);
    const badLabels = await executeSlashCommandScript("/buttons labels={\"x\":1} Choose now", ctx);
    const badMultiple = await executeSlashCommandScript(
      "/buttons multiple=maybe labels=[\"Yes\"] Choose now",
      ctx,
    );
    const missingText = await executeSlashCommandScript("/buttons labels=[\"Yes\"]", ctx);
    const badBgcolReturn = await executeSlashCommandScript("/bgcol", ctx);

    expect(missingLabels.isError).toBe(true);
    expect(badLabels.isError).toBe(true);
    expect(badMultiple.isError).toBe(true);
    expect(missingText.isError).toBe(true);
    expect(badBgcolReturn.isError).toBe(true);

    expect(missingLabels.errorMessage).toContain("requires labels");
    expect(badLabels.errorMessage).toContain("labels");
    expect(badMultiple.errorMessage).toContain("invalid multiple value");
    expect(missingText.errorMessage).toContain("requires popup text");
    expect(badBgcolReturn.errorMessage).toContain("must return a string");
  });

  it("/flushinject|/flushinjects 支持按 id 与全量清理", async () => {
    const removePromptInjections = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    const ctx = createContext({ removePromptInjections });

    const one = await executeSlashCommandScript("/flushinject inject-1", ctx);
    const all = await executeSlashCommandScript("/flushinjects", ctx);

    expect(one).toMatchObject({ isError: false, pipe: "" });
    expect(all).toMatchObject({ isError: false, pipe: "" });
    expect(removePromptInjections).toHaveBeenNthCalledWith(1, "inject-1");
    expect(removePromptInjections).toHaveBeenNthCalledWith(2, undefined);
  });

  it("bgcol/bubble/buttons/flushinject 在宿主缺失时显式 fail-fast", async () => {
    const ctx = createContext();

    const bgcol = await executeSlashCommandScript("/bgcol", ctx);
    const bubble = await executeSlashCommandScript("/bubble", ctx);
    const buttons = await executeSlashCommandScript("/buttons labels=[\"Yes\"] Continue", ctx);
    const flushInject = await executeSlashCommandScript("/flushinject", ctx);

    expect(bgcol.isError).toBe(true);
    expect(bubble.isError).toBe(true);
    expect(buttons.isError).toBe(true);
    expect(flushInject.isError).toBe(true);
    expect(bgcol.errorMessage).toContain("not available");
    expect(bubble.errorMessage).toContain("not available");
    expect(buttons.errorMessage).toContain("not available");
    expect(flushInject.errorMessage).toContain("not available");
  });

  it("/flushinject 对宿主异常返回值显式 fail-fast", async () => {
    const removePromptInjections = vi.fn().mockResolvedValue(-1);
    const ctx = createContext({ removePromptInjections });

    const result = await executeSlashCommandScript("/flushinject", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid remove count");
  });
});
