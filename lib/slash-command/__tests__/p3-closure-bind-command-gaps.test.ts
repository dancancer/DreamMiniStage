import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-closure-${contextSeed}`,
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

describe("P3 closure/bind command gaps", () => {
  it("/closure-serialize 与 /closure-deserialize 支持闭包脚本持久化回放", async () => {
    const ctx = createContext();

    const serialized = await executeSlashCommandScript(
      "/closure-serialize {: /echo closure works :}",
      ctx,
    );
    const roundTrip = await executeSlashCommandScript(
      "/closure-serialize {: /echo closure works :}|/closure-deserialize",
      ctx,
    );

    expect(serialized.isError).toBe(false);
    expect(JSON.parse(serialized.pipe)).toMatchObject({
      format: "dreammini-closure-v1",
      script: "/echo closure works",
    });
    expect(roundTrip).toMatchObject({ isError: false, pipe: "/echo closure works" });
  });

  it("/closure-deserialize 支持 block/raw payload 与序列化 JSON payload", async () => {
    const ctx = createContext();

    const fromBlock = await executeSlashCommandScript(
      "/closure-deserialize {: /echo from-block :}",
      ctx,
    );
    const fromJson = await executeSlashCommandScript(
      "/closure-serialize /echo from-json|/closure-deserialize",
      ctx,
    );

    expect(fromBlock).toMatchObject({ isError: false, pipe: "/echo from-block" });
    expect(fromJson).toMatchObject({ isError: false, pipe: "/echo from-json" });
  });

  it("/closure-* 在缺参或非法序列化输入时显式 fail-fast", async () => {
    const ctx = createContext();

    const missingSerialize = await executeSlashCommandScript("/closure-serialize", ctx);
    const missingDeserialize = await executeSlashCommandScript("/closure-deserialize", ctx);
    const invalidPayload = await executeSlashCommandScript(
      "/echo {\"format\":\"bad\",\"script\":123}|/closure-deserialize",
      ctx,
    );

    expect(missingSerialize.isError).toBe(true);
    expect(missingDeserialize.isError).toBe(true);
    expect(invalidPayload.isError).toBe(true);

    expect(missingSerialize.errorMessage).toContain("requires closure script");
    expect(missingDeserialize.errorMessage).toContain("requires serialized payload");
    expect(invalidPayload.errorMessage).toContain("invalid serialized payload");
  });

  it("/lock 与 /bind 可透传 persona lock 状态切换", async () => {
    const setPersonaLock = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const ctx = createContext({ setPersonaLock });

    const defaultToggle = await executeSlashCommandScript("/lock", ctx);
    const bindOff = await executeSlashCommandScript("/bind type=character off", ctx);
    const lockOn = await executeSlashCommandScript("/lock type=default state=on", ctx);

    expect(defaultToggle).toMatchObject({ isError: false, pipe: "true" });
    expect(bindOff).toMatchObject({ isError: false, pipe: "false" });
    expect(lockOn).toMatchObject({ isError: false, pipe: "true" });

    expect(setPersonaLock).toHaveBeenNthCalledWith(1, "toggle", { type: "chat" });
    expect(setPersonaLock).toHaveBeenNthCalledWith(2, "off", { type: "character" });
    expect(setPersonaLock).toHaveBeenNthCalledWith(3, "on", { type: "default" });
  });

  it("/lock|/bind 在宿主缺失、参数非法或返回类型错误时显式 fail-fast", async () => {
    const noHost = createContext();
    const noHostResult = await executeSlashCommandScript("/bind", noHost);

    const badTypeCtx = createContext({
      setPersonaLock: vi.fn().mockResolvedValue(true),
    });
    const badType = await executeSlashCommandScript("/lock type=session on", badTypeCtx);
    const badState = await executeSlashCommandScript("/lock state=maybe", badTypeCtx);

    const badReturnCtx = createContext({
      setPersonaLock: vi.fn().mockResolvedValue("yes" as unknown as boolean),
    });
    const badReturn = await executeSlashCommandScript("/lock", badReturnCtx);

    expect(noHostResult.isError).toBe(true);
    expect(badType.isError).toBe(true);
    expect(badState.isError).toBe(true);
    expect(badReturn.isError).toBe(true);

    expect(noHostResult.errorMessage).toContain("not available");
    expect(badType.errorMessage).toContain("invalid type");
    expect(badState.errorMessage).toContain("invalid state");
    expect(badReturn.errorMessage).toContain("non-boolean");
  });
});
