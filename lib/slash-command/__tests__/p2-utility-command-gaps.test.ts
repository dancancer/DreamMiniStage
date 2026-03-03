import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-util-1",
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 utility command gaps", () => {
  it("/run 可执行变量脚本并注入 named args", async () => {
    const runSlashCommand = vi.fn().mockResolvedValue("ok");
    const getVariable = vi.fn().mockImplementation((key: string) => {
      if (key === "macro") {
        return "/echo hello {{arg::name}}";
      }
      return undefined;
    });
    const ctx = createContext({ runSlashCommand, getVariable });

    const result = await executeSlashCommandScript("/run macro name=Linus", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");
    expect(runSlashCommand).toHaveBeenCalledWith("/echo hello Linus");
  });

  it("/run 支持直接执行 slash script", async () => {
    const runSlashCommand = vi.fn().mockImplementation(async (script: string) => {
      const nested = await executeSlashCommandScript(script, createContext());
      if (nested.isError) {
        throw new Error(nested.errorMessage || "nested run failed");
      }
      return nested.pipe;
    });
    const ctx = createContext({ runSlashCommand });

    const result = await executeSlashCommandScript("/run /echo hello-world", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("hello-world");
  });

  it("/run 在宿主不支持与目标不可执行时显式 fail-fast", async () => {
    const noRunnerCtx = createContext({
      getVariable: vi.fn().mockReturnValue("/echo hi"),
    });
    const invalidTargetCtx = createContext({
      runSlashCommand: vi.fn().mockResolvedValue("ok"),
      getVariable: vi.fn().mockReturnValue(42),
    });

    const noRunner = await executeSlashCommandScript("/run macro", noRunnerCtx);
    const invalidTarget = await executeSlashCommandScript("/run macro", invalidTargetCtx);

    expect(noRunner.isError).toBe(true);
    expect(noRunner.errorMessage).toContain("not available");
    expect(invalidTarget.isError).toBe(true);
    expect(invalidTarget.errorMessage).toContain("not executable");
  });

  it("/trimtokens 优先使用 tokenizer 回调", async () => {
    const countTokens = vi.fn().mockResolvedValue(8);
    const sliceByTokens = vi.fn().mockResolvedValue("tail");
    const ctx = createContext({ countTokens, sliceByTokens });

    const result = await executeSlashCommandScript(
      "/trimtokens limit=3 direction=end abcdefgh",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("tail");
    expect(countTokens).toHaveBeenCalledWith("abcdefgh");
    expect(sliceByTokens).toHaveBeenCalledWith("abcdefgh", 3, "end");
  });

  it("/trimtokens 在缺少 tokenizer 时按字符比例降级", async () => {
    const ctx = createContext();

    const fromArgs = await executeSlashCommandScript(
      "/trimtokens limit=2 direction=start abcdefghij",
      ctx,
    );
    const fromPipe = await executeSlashCommandScript("/echo abcdefghij|/trimtokens 2", ctx);

    expect(fromArgs.isError).toBe(false);
    expect(fromPipe.isError).toBe(false);
    expect(fromArgs.pipe).toBe("abcdef");
    expect(fromPipe.pipe).toBe("efghij");
  });

  it("/trimtokens 对非法参数做 fail-fast", async () => {
    const badLimit = await executeSlashCommandScript("/trimtokens limit=nope hello", createContext());
    const badDirection = await executeSlashCommandScript(
      "/trimtokens limit=2 direction=middle hello",
      createContext(),
    );
    const badTokenCount = await executeSlashCommandScript(
      "/trimtokens limit=2 hello",
      createContext({ countTokens: vi.fn().mockResolvedValue(Number.NaN) }),
    );

    expect(badLimit.isError).toBe(true);
    expect(badDirection.isError).toBe(true);
    expect(badTokenCount.isError).toBe(true);
    expect(badLimit.errorMessage).toContain("invalid limit");
    expect(badDirection.errorMessage).toContain("invalid direction");
    expect(badTokenCount.errorMessage).toContain("invalid token count");
  });

  it("/reload-page 可调用宿主回调并返回空字符串", async () => {
    const reloadPage = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ reloadPage });

    const result = await executeSlashCommandScript("/reload-page", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("/reload-page 在宿主不支持时显式 fail-fast", async () => {
    const result = await executeSlashCommandScript("/reload-page", createContext());

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("not available");
  });
});
