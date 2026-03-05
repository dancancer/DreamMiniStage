import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext, PromptEntryState } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-prompt-1",
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

describe("P2 prompt-entry command gaps", () => {
  it("/getpromptentry 支持 simple/list/dict 三种返回形态", async () => {
    const promptEntries: PromptEntryState[] = [
      { identifier: "entry-a", name: "Alpha", enabled: true },
      { identifier: "entry-b", name: "Beta", enabled: false },
      { identifier: "entry-c", name: "Beta", enabled: true },
    ];
    const ctx = createContext({
      listPromptEntries: vi.fn().mockResolvedValue(promptEntries),
    });

    const simple = await executeSlashCommandScript("/getpromptentry identifier=entry-a", ctx);
    const list = await executeSlashCommandScript("/getpromptentries name=Beta return=list", ctx);
    const dict = await executeSlashCommandScript(
      "/getpromptentry identifier=entry-a identifier=entry-b return=dict",
      ctx,
    );

    expect(simple.isError).toBe(false);
    expect(list.isError).toBe(false);
    expect(dict.isError).toBe(false);
    expect(simple.pipe).toBe("true");
    expect(JSON.parse(list.pipe)).toEqual([false, true]);
    expect(JSON.parse(dict.pipe)).toEqual({ "entry-a": true, "entry-b": false });
  });

  it("/setpromptentry 支持 on/off/toggle 更新条目状态", async () => {
    const promptEntries: PromptEntryState[] = [
      { identifier: "entry-a", name: "Alpha", enabled: true },
      { identifier: "entry-b", name: "Beta", enabled: false },
      { identifier: "entry-c", name: "Beta", enabled: true },
    ];

    const setPromptEntriesEnabled = vi.fn(async (updates: Array<{ identifier: string; enabled: boolean }>) => {
      for (const update of updates) {
        const target = promptEntries.find((entry) => entry.identifier === update.identifier);
        if (target) {
          target.enabled = update.enabled;
        }
      }
    });

    const ctx = createContext({
      listPromptEntries: vi.fn(async () => promptEntries.map((entry) => ({ ...entry }))),
      setPromptEntriesEnabled,
    });

    const setOff = await executeSlashCommandScript("/setpromptentry identifier=entry-a off", ctx);
    const toggleByName = await executeSlashCommandScript("/setpromptentries name=Beta toggle", ctx);

    expect(setOff.isError).toBe(false);
    expect(toggleByName.isError).toBe(false);
    expect(setPromptEntriesEnabled).toHaveBeenNthCalledWith(1, [{ identifier: "entry-a", enabled: false }]);
    expect(setPromptEntriesEnabled).toHaveBeenNthCalledWith(2, [
      { identifier: "entry-b", enabled: true },
      { identifier: "entry-c", enabled: false },
    ]);
    expect(promptEntries).toEqual([
      { identifier: "entry-a", name: "Alpha", enabled: false },
      { identifier: "entry-b", name: "Beta", enabled: true },
      { identifier: "entry-c", name: "Beta", enabled: false },
    ]);
  });

  it("prompt-entry 命令在参数缺失或宿主缺失时 fail-fast", async () => {
    const entries: PromptEntryState[] = [
      { identifier: "entry-a", name: "Alpha", enabled: true },
    ];

    const noContext = createContext();
    const noSetter = createContext({
      listPromptEntries: vi.fn().mockResolvedValue(entries),
    });
    const complete = createContext({
      listPromptEntries: vi.fn().mockResolvedValue(entries),
      setPromptEntriesEnabled: vi.fn().mockResolvedValue(undefined),
    });

    const getUnavailable = await executeSlashCommandScript("/getpromptentry identifier=entry-a", noContext);
    const setUnavailable = await executeSlashCommandScript("/setpromptentry identifier=entry-a on", noSetter);
    const badReturn = await executeSlashCommandScript("/getpromptentry identifier=entry-a return=table", complete);
    const badState = await executeSlashCommandScript("/setpromptentry identifier=entry-a invalid", complete);
    const missingTarget = await executeSlashCommandScript("/getpromptentry", complete);

    expect(getUnavailable.isError).toBe(true);
    expect(setUnavailable.isError).toBe(true);
    expect(badReturn.isError).toBe(true);
    expect(badState.isError).toBe(true);
    expect(missingTarget.isError).toBe(true);

    expect(getUnavailable.errorMessage).toContain("not available");
    expect(setUnavailable.errorMessage).toContain("not available");
    expect(badReturn.errorMessage).toContain("invalid return type");
    expect(badState.errorMessage).toContain("invalid state");
    expect(missingTarget.errorMessage).toContain("requires identifier or name");
  });
});
