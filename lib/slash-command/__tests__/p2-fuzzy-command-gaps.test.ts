import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-fuzzy-1",
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 fuzzy command gaps", () => {
  it("/fuzzy mode=first 返回首个匹配项", async () => {
    const ctx = createContext();

    const result = await executeSlashCommandScript(
      "/fuzzy list=[\"left\",\"up\",\"right\"] threshold=0.4 mode=first he looks up",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("up");
  });

  it("/fuzzy mode=best 返回最低分候选", async () => {
    const ctx = createContext();

    const result = await executeSlashCommandScript(
      "/fuzzy list=[\"right\",\"up\",\"left\"] threshold=0.5 mode=best rigth",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("right");
  });

  it("/fuzzy 在阈值未命中时返回空字符串", async () => {
    const ctx = createContext();

    const result = await executeSlashCommandScript(
      "/fuzzy list=[\"down\",\"left\"] threshold=0.2 mode=best up",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
  });

  it("/fuzzy 对参数错误做 fail-fast", async () => {
    const ctx = createContext();

    const missingList = await executeSlashCommandScript("/fuzzy hello", ctx);
    const badList = await executeSlashCommandScript("/fuzzy list=oops hello", ctx);
    const badThreshold = await executeSlashCommandScript(
      "/fuzzy list=[\"up\"] threshold=1.2 hello",
      ctx,
    );
    const badMode = await executeSlashCommandScript(
      "/fuzzy list=[\"up\"] mode=nearest hello",
      ctx,
    );
    const missingSearch = await executeSlashCommandScript(
      "/fuzzy list=[\"up\"]",
      ctx,
    );

    expect(missingList.isError).toBe(true);
    expect(missingList.errorMessage).toContain("requires list");

    expect(badList.isError).toBe(true);
    expect(badList.errorMessage).toContain("must be a valid JSON array");

    expect(badThreshold.isError).toBe(true);
    expect(badThreshold.errorMessage).toContain("between 0 and 1");

    expect(badMode.isError).toBe(true);
    expect(badMode.errorMessage).toContain("unsupported mode");

    expect(missingSearch.isError).toBe(true);
    expect(missingSearch.errorMessage).toContain("requires search text");
  });
});
