import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-branch-ui-${contextSeed}`,
    messages: [
      { id: `m-${contextSeed}-0`, role: "user", content: "hello" },
      { id: `m-${contextSeed}-1`, role: "assistant", content: "world" },
      { id: `m-${contextSeed}-2`, role: "assistant", content: "tail" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 branch/ui command gaps", () => {
  it("/branch-create 创建分支后进入分支会话，并与 checkpoint 读链路对齐", async () => {
    const ctx = createContext();

    const created = await executeSlashCommandScript("/branch-create 1", ctx);
    const linked = await executeSlashCommandScript("/checkpoint-get 1", ctx);
    const parent = await executeSlashCommandScript("/checkpoint-parent", ctx);
    const exit = await executeSlashCommandScript("/checkpoint-exit", ctx);

    expect(created.isError).toBe(false);
    expect(linked.isError).toBe(false);
    expect(parent.isError).toBe(false);
    expect(exit.isError).toBe(false);
    expect(created.pipe).toBe("branch-1");
    expect(linked.pipe).toBe("branch-1");
    expect(parent.pipe).toBe(ctx.characterId);
    expect(exit.pipe).toBe(ctx.characterId);
  });

  it("/branch-create 在缺省 mesId 时默认使用最后一条消息，并对非法参数 fail-fast", async () => {
    const ctx = createContext();

    const created = await executeSlashCommandScript("/branch-create", ctx);
    const linked = await executeSlashCommandScript("/checkpoint-get 2", ctx);
    const bad = await executeSlashCommandScript("/branch-create mes=abc", ctx);

    expect(created.isError).toBe(false);
    expect(linked.isError).toBe(false);
    expect(created.pipe).toBe("branch-1");
    expect(linked.pipe).toBe("branch-1");

    expect(bad.isError).toBe(true);
    expect(bad.errorMessage).toContain("invalid message index");
  });

  it("UI 命令在宿主回调注入时可执行", async () => {
    const togglePanels = vi.fn().mockResolvedValue(undefined);
    const resetPanels = vi.fn().mockResolvedValue(undefined);
    const toggleVisualNovelMode = vi.fn().mockResolvedValue(undefined);
    const setBackground = vi.fn().mockImplementation(async (name?: string) => name || "bg-default.jpg");
    const lockBackground = vi.fn().mockResolvedValue(undefined);
    const unlockBackground = vi.fn().mockResolvedValue(undefined);
    const autoBackground = vi.fn().mockResolvedValue(undefined);
    const setTheme = vi.fn().mockImplementation(async (name?: string) => name || "theme-default");
    const setMovingUiPreset = vi.fn().mockImplementation(async (name: string) => name);
    const setCssVariable = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      togglePanels,
      resetPanels,
      toggleVisualNovelMode,
      setBackground,
      lockBackground,
      unlockBackground,
      autoBackground,
      setTheme,
      setMovingUiPreset,
      setCssVariable,
    });

    const panels = await executeSlashCommandScript("/panels", ctx);
    const reset = await executeSlashCommandScript("/resetpanels", ctx);
    const vn = await executeSlashCommandScript("/vn", ctx);
    const bgSet = await executeSlashCommandScript("/bg beach.jpg", ctx);
    const bgGet = await executeSlashCommandScript("/bg", ctx);
    const lockBg = await executeSlashCommandScript("/lockbg", ctx);
    const lockBgAlias = await executeSlashCommandScript("/bglock", ctx);
    const unlockBg = await executeSlashCommandScript("/unlockbg", ctx);
    const unlockBgAlias = await executeSlashCommandScript("/bgunlock", ctx);
    const autoBg = await executeSlashCommandScript("/autobg", ctx);
    const autoBgAlias = await executeSlashCommandScript("/bgauto", ctx);
    const themeSet = await executeSlashCommandScript("/theme Cappuccino", ctx);
    const movingUi = await executeSlashCommandScript("/movingui compact", ctx);
    const cssVar = await executeSlashCommandScript(
      "/css-var varname=--SmartThemeBodyColor to=chat #ff0000",
      ctx,
    );

    expect(panels.isError).toBe(false);
    expect(reset.isError).toBe(false);
    expect(vn.isError).toBe(false);
    expect(bgSet.isError).toBe(false);
    expect(bgGet.isError).toBe(false);
    expect(lockBg.isError).toBe(false);
    expect(lockBgAlias.isError).toBe(false);
    expect(unlockBg.isError).toBe(false);
    expect(unlockBgAlias.isError).toBe(false);
    expect(autoBg.isError).toBe(false);
    expect(autoBgAlias.isError).toBe(false);
    expect(themeSet.isError).toBe(false);
    expect(movingUi.isError).toBe(false);
    expect(cssVar.isError).toBe(false);

    expect(bgSet.pipe).toBe("beach.jpg");
    expect(bgGet.pipe).toBe("bg-default.jpg");
    expect(themeSet.pipe).toBe("Cappuccino");
    expect(movingUi.pipe).toBe("compact");

    expect(togglePanels).toHaveBeenCalledTimes(1);
    expect(resetPanels).toHaveBeenCalledTimes(1);
    expect(toggleVisualNovelMode).toHaveBeenCalledTimes(1);
    expect(setBackground).toHaveBeenNthCalledWith(1, "beach.jpg");
    expect(setBackground).toHaveBeenNthCalledWith(2, undefined);
    expect(lockBackground).toHaveBeenCalledTimes(2);
    expect(unlockBackground).toHaveBeenCalledTimes(2);
    expect(autoBackground).toHaveBeenCalledTimes(2);
    expect(setTheme).toHaveBeenCalledWith("Cappuccino");
    expect(setMovingUiPreset).toHaveBeenCalledWith("compact");
    expect(setCssVariable).toHaveBeenCalledWith({
      varName: "--SmartThemeBodyColor",
      value: "#ff0000",
      target: "chat",
    });
  });

  it("UI 命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const panels = await executeSlashCommandScript("/panels", ctx);
    const bg = await executeSlashCommandScript("/bg beach.jpg", ctx);
    const lockBg = await executeSlashCommandScript("/lockbg", ctx);
    const unlockBg = await executeSlashCommandScript("/unlockbg", ctx);
    const autoBg = await executeSlashCommandScript("/autobg", ctx);
    const theme = await executeSlashCommandScript("/theme dark", ctx);
    const movingUi = await executeSlashCommandScript("/movingui compact", ctx);
    const cssVar = await executeSlashCommandScript("/css-var varname=--foo bar", ctx);
    const vn = await executeSlashCommandScript("/vn", ctx);
    const reset = await executeSlashCommandScript("/resetpanels", ctx);

    expect(panels.isError).toBe(true);
    expect(bg.isError).toBe(true);
    expect(lockBg.isError).toBe(true);
    expect(unlockBg.isError).toBe(true);
    expect(autoBg.isError).toBe(true);
    expect(theme.isError).toBe(true);
    expect(movingUi.isError).toBe(true);
    expect(cssVar.isError).toBe(true);
    expect(vn.isError).toBe(true);
    expect(reset.isError).toBe(true);

    expect(panels.errorMessage).toContain("not available");
    expect(bg.errorMessage).toContain("not available");
    expect(lockBg.errorMessage).toContain("not available");
    expect(unlockBg.errorMessage).toContain("not available");
    expect(autoBg.errorMessage).toContain("not available");
    expect(theme.errorMessage).toContain("not available");
    expect(movingUi.errorMessage).toContain("not available");
    expect(cssVar.errorMessage).toContain("not available");
    expect(vn.errorMessage).toContain("not available");
    expect(reset.errorMessage).toContain("not available");
  });

  it("/css-var 对参数错误显式 fail-fast", async () => {
    const setCssVariable = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ setCssVariable });

    const missingVarName = await executeSlashCommandScript("/css-var #fff", ctx);
    const badVarName = await executeSlashCommandScript("/css-var varname=color #fff", ctx);
    const missingValue = await executeSlashCommandScript("/css-var varname=--color", ctx);

    expect(missingVarName.isError).toBe(true);
    expect(badVarName.isError).toBe(true);
    expect(missingValue.isError).toBe(true);
    expect(missingVarName.errorMessage).toContain("requires varname");
    expect(badVarName.errorMessage).toContain("must start with");
    expect(missingValue.errorMessage).toContain("requires a value");
  });

  it("/? 与 /help 返回最小帮助文本", async () => {
    const ctx = createContext();

    const fromQuestion = await executeSlashCommandScript("/?", ctx);
    const fromHelp = await executeSlashCommandScript("/help", ctx);

    expect(fromQuestion.isError).toBe(false);
    expect(fromHelp.isError).toBe(false);
    expect(fromQuestion.pipe).toContain("/branch-create");
    expect(fromHelp.pipe).toContain("/setvar");
  });
});
