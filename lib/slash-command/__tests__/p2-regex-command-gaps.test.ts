import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-regex-1",
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 regex command gaps", () => {
  it("/regex-preset 支持读取与切换", async () => {
    const getRegexPreset = vi.fn().mockResolvedValue("preset-a");
    const setRegexPreset = vi.fn().mockResolvedValue("preset-b");
    const ctx = createContext({ getRegexPreset, setRegexPreset });

    const current = await executeSlashCommandScript("/regex-preset", ctx);
    const switched = await executeSlashCommandScript("/regex-preset preset-b", ctx);

    expect(current.isError).toBe(false);
    expect(switched.isError).toBe(false);
    expect(current.pipe).toBe("preset-a");
    expect(switched.pipe).toBe("preset-b");
    expect(setRegexPreset).toHaveBeenCalledWith("preset-b");
  });

  it("/regex-preset 在目标不存在时显式 fail-fast", async () => {
    const ctx = createContext({
      getRegexPreset: vi.fn().mockResolvedValue("preset-a"),
      setRegexPreset: vi.fn().mockResolvedValue(null),
    });

    const result = await executeSlashCommandScript("/regex-preset missing", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("not found");
  });

  it("/regex-toggle 支持 toggle/on/off 三种状态", async () => {
    const getRegexScript = vi
      .fn()
      .mockResolvedValueOnce({ name: "MyScript", enabled: true })
      .mockResolvedValueOnce({ name: "MyScript", enabled: false })
      .mockResolvedValueOnce({ name: "MyScript", enabled: true });
    const setRegexScriptEnabled = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ getRegexScript, setRegexScriptEnabled });

    const toggled = await executeSlashCommandScript("/regex-toggle MyScript", ctx);
    const turnedOn = await executeSlashCommandScript("/regex-toggle state=on MyScript", ctx);
    const turnedOff = await executeSlashCommandScript("/regex-toggle state=off MyScript", ctx);

    expect(toggled.isError).toBe(false);
    expect(turnedOn.isError).toBe(false);
    expect(turnedOff.isError).toBe(false);
    expect(toggled.pipe).toBe("MyScript");
    expect(turnedOn.pipe).toBe("MyScript");
    expect(turnedOff.pipe).toBe("MyScript");
    expect(setRegexScriptEnabled).toHaveBeenNthCalledWith(1, "MyScript", false);
    expect(setRegexScriptEnabled).toHaveBeenNthCalledWith(2, "MyScript", true);
    expect(setRegexScriptEnabled).toHaveBeenNthCalledWith(3, "MyScript", false);
  });

  it("/regex-toggle 在脚本不存在时显式 fail-fast", async () => {
    const ctx = createContext({
      getRegexScript: vi.fn().mockResolvedValue(undefined),
      setRegexScriptEnabled: vi.fn().mockResolvedValue(undefined),
    });

    const result = await executeSlashCommandScript("/regex-toggle MissingScript", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("script not found");
  });

  it("regex 新命令在宿主不支持时显式 fail-fast", async () => {
    const ctx = createContext();

    const presetGet = await executeSlashCommandScript("/regex-preset", ctx);
    const presetSet = await executeSlashCommandScript("/regex-preset preset-a", ctx);
    const toggle = await executeSlashCommandScript("/regex-toggle script-a", ctx);

    expect(presetGet.isError).toBe(true);
    expect(presetSet.isError).toBe(true);
    expect(toggle.isError).toBe(true);
    expect(presetGet.errorMessage).toContain("not available");
    expect(presetSet.errorMessage).toContain("not available");
    expect(toggle.errorMessage).toContain("not available");
  });
});
