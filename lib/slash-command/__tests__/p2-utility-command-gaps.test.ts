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

  it("/delay 与别名可按毫秒延迟并返回空字符串", async () => {
    const delay = await executeSlashCommandScript("/delay 0", createContext());
    const wait = await executeSlashCommandScript("/wait 0", createContext());
    const sleep = await executeSlashCommandScript("/sleep 0", createContext());

    expect(delay.isError).toBe(false);
    expect(wait.isError).toBe(false);
    expect(sleep.isError).toBe(false);
    expect(delay.pipe).toBe("");
    expect(wait.pipe).toBe("");
    expect(sleep.pipe).toBe("");
  });

  it("/delay 对非法时长显式 fail-fast", async () => {
    const invalid = await executeSlashCommandScript("/delay nope", createContext());
    const negative = await executeSlashCommandScript("/delay -1", createContext());

    expect(invalid.isError).toBe(true);
    expect(negative.isError).toBe(true);
    expect(invalid.errorMessage).toContain("invalid milliseconds");
    expect(negative.errorMessage).toContain("invalid milliseconds");
  });

  it("/generate-stop 可调用宿主回调并返回 true/false", async () => {
    const stopGeneration = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const ctx = createContext({ stopGeneration });

    const first = await executeSlashCommandScript("/generate-stop", ctx);
    const second = await executeSlashCommandScript("/generate-stop", ctx);

    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(first.pipe).toBe("true");
    expect(second.pipe).toBe("false");
    expect(stopGeneration).toHaveBeenCalledTimes(2);
  });

  it("/generate-stop 在宿主缺失或返回类型异常时显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/generate-stop", createContext());
    const invalid = await executeSlashCommandScript(
      "/generate-stop",
      createContext({
        stopGeneration: vi.fn().mockResolvedValue("yes") as unknown as NonNullable<ExecutionContext["stopGeneration"]>,
      }),
    );

    expect(missing.isError).toBe(true);
    expect(invalid.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(invalid.errorMessage).toContain("non-boolean");
  });

  it("/genraw 可透传参数到宿主生成回调", async () => {
    const generateRaw = vi.fn().mockResolvedValue("raw-output");
    const ctx = createContext({ generateRaw });

    const result = await executeSlashCommandScript(
      "/genraw as=char lock=true instruct=off trim=off length=128 stop=[\"\\n\"] system=SYS prefill=PREF hi raw",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("raw-output");
    expect(generateRaw).toHaveBeenCalledWith("hi raw", {
      lock: true,
      instruct: false,
      as: "char",
      systemPrompt: "SYS",
      prefillPrompt: "PREF",
      responseLength: 128,
      trimNames: false,
      stopSequences: ["\n"],
    });
  });

  it("/genraw 在宿主缺失与参数非法时显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/genraw hello", createContext());
    const invalidAs = await executeSlashCommandScript(
      "/genraw as=user hello",
      createContext({ generateRaw: vi.fn().mockResolvedValue("x") }),
    );
    const invalidStop = await executeSlashCommandScript(
      "/genraw stop=oops hello",
      createContext({ generateRaw: vi.fn().mockResolvedValue("x") }),
    );

    expect(missing.isError).toBe(true);
    expect(invalidAs.isError).toBe(true);
    expect(invalidStop.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(invalidAs.errorMessage).toContain("invalid as value");
    expect(invalidStop.errorMessage).toContain("invalid stop value");
  });

  it("/list-gallery 支持 char/group 过滤并返回 JSON 列表", async () => {
    const listGallery = vi.fn().mockResolvedValue(["a.png", "b.png"]);
    const ctx = createContext({ listGallery });

    const canonical = await executeSlashCommandScript("/list-gallery char=Alice", ctx);
    const alias = await executeSlashCommandScript("/lg group=Group-A", ctx);

    expect(canonical.isError).toBe(false);
    expect(alias.isError).toBe(false);
    expect(canonical.pipe).toBe("[\"a.png\",\"b.png\"]");
    expect(alias.pipe).toBe("[\"a.png\",\"b.png\"]");
    expect(listGallery).toHaveBeenNthCalledWith(1, { character: "Alice", group: undefined });
    expect(listGallery).toHaveBeenNthCalledWith(2, { character: undefined, group: "Group-A" });
  });

  it("/list-gallery 在宿主缺失或返回非法结果时显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/list-gallery", createContext());
    const invalid = await executeSlashCommandScript(
      "/list-gallery",
      createContext({
        listGallery: vi.fn().mockResolvedValue("oops") as unknown as NonNullable<ExecutionContext["listGallery"]>,
      }),
    );

    expect(missing.isError).toBe(true);
    expect(invalid.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(invalid.errorMessage).toContain("non-array");
  });

  it("/listchatvar 作为 /listvar 别名返回变量键列表", async () => {
    const listVariables = vi.fn().mockReturnValue(["foo", "bar"]);
    const ctx = createContext({ listVariables });

    const result = await executeSlashCommandScript("/listchatvar", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("[\"foo\",\"bar\"]");
    expect(listVariables).toHaveBeenCalledTimes(1);
  });
});
