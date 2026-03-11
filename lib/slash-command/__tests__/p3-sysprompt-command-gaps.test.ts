import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";
import { createDefaultPromptBehaviorState } from "@/lib/prompt-config/state";
import { usePromptConfigStore } from "@/lib/store/prompt-config-store";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-sysprompt-1",
    messages: [
      { id: "m-0", role: "user", content: "hello" },
      { id: "m-1", role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 sysprompt command gaps", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePromptConfigStore.setState(createDefaultPromptBehaviorState());
  });

  it("/sysprompt 命令簇共享单一路径状态与别名", async () => {
    const ctx = createContext();

    const initial = await executeSlashCommandScript("/sysprompt", ctx);
    const selected = await executeSlashCommandScript("/sysprompt Story Core", ctx);
    const readWhenEnabled = await executeSlashCommandScript("/sysprompt", ctx);
    const disableAlias = await executeSlashCommandScript("/sysprompt-disable", ctx);
    const hiddenWhenDisabled = await executeSlashCommandScript("/sysprompt", ctx);
    const forceGet = await executeSlashCommandScript("/sysprompt forceGet=true", ctx);
    const enableAlias = await executeSlashCommandScript("/sysprompt-enable", ctx);
    const state = await executeSlashCommandScript("/sysprompt-state", ctx);
    const toggleOff = await executeSlashCommandScript("/sysprompt-toggle false", ctx);

    expect(initial).toMatchObject({ isError: false, pipe: "" });
    expect(selected).toMatchObject({ isError: false, pipe: "Story Core" });
    expect(readWhenEnabled).toMatchObject({ isError: false, pipe: "Story Core" });
    expect(disableAlias).toMatchObject({ isError: false, pipe: "false" });
    expect(hiddenWhenDisabled).toMatchObject({ isError: false, pipe: "" });
    expect(forceGet).toMatchObject({ isError: false, pipe: "Story Core" });
    expect(enableAlias).toMatchObject({ isError: false, pipe: "true" });
    expect(state).toMatchObject({ isError: false, pipe: "true" });
    expect(toggleOff).toMatchObject({ isError: false, pipe: "false" });
    expect(usePromptConfigStore.getState().sysprompt.name).toBe("Story Core");
    expect(usePromptConfigStore.getState().sysprompt.enabled).toBe(false);
  });

  it("/sysname 会驱动 /sys 的系统旁白显示名", async () => {
    const onSendSystem = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ onSendSystem });

    const readDefault = await executeSlashCommandScript("/sysname", ctx);
    const updated = await executeSlashCommandScript("/sysname Storyteller", ctx);
    const sysResult = await executeSlashCommandScript("/sys Prelude", ctx);

    expect(readDefault).toMatchObject({ isError: false, pipe: "System" });
    expect(updated).toMatchObject({ isError: false, pipe: "Storyteller" });
    expect(sysResult).toMatchObject({ isError: false, pipe: "Prelude" });
    expect(onSendSystem).toHaveBeenCalledWith("Prelude", { name: "Storyteller" });
  });

  it("/sysgen 复用生成与系统消息单路径，并支持 trim/at/compact/return", async () => {
    const onSendSystem = vi.fn().mockResolvedValue(undefined);
    const generateQuiet = vi.fn().mockResolvedValue("Alpha sentence. dangling tail");
    const ctx = createContext({ onSendSystem, generateQuiet });

    await executeSlashCommandScript("/sysname Chronicler", ctx);
    const generated = await executeSlashCommandScript(
      "/sysgen trim=true at=-1 compact=true return=object Prompt body",
      ctx,
    );

    expect(generated.isError).toBe(false);
    expect(generateQuiet).toHaveBeenCalledWith("Prompt body");
    expect(onSendSystem).toHaveBeenCalledWith("Alpha sentence.", {
      at: -1,
      compact: true,
      name: "Chronicler",
    });
    expect(JSON.parse(generated.pipe)).toEqual({ text: "Alpha sentence.", at: -1 });
  });

  it("sysprompt/sysgen 对非法参数与缺少能力显式 fail-fast", async () => {
    const ctx = createContext();

    const badQuiet = await executeSlashCommandScript("/sysprompt quiet=maybe Story", ctx);
    const badState = await executeSlashCommandScript("/sysprompt-state maybe", ctx);
    const missingPrompt = await executeSlashCommandScript(
      "/sysgen",
      createContext({ generateQuiet: vi.fn().mockResolvedValue("ok") }),
    );
    const badTrim = await executeSlashCommandScript(
      "/sysgen trim=maybe prompt",
      createContext({ generateQuiet: vi.fn().mockResolvedValue("ok") }),
    );
    const missingGenerator = await executeSlashCommandScript("/sysgen prompt", ctx);

    expect(badQuiet.isError).toBe(true);
    expect(badState.isError).toBe(true);
    expect(missingPrompt.isError).toBe(true);
    expect(badTrim.isError).toBe(true);
    expect(missingGenerator.isError).toBe(true);
    expect(badQuiet.errorMessage).toContain("invalid quiet value");
    expect(badState.errorMessage).toContain("invalid state value");
    expect(missingPrompt.errorMessage).toContain("requires prompt");
    expect(badTrim.errorMessage).toContain("invalid trim value");
    expect(missingGenerator.errorMessage).toContain("not available");
  });
});
