import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createCheckpointContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-checkpoint-${contextSeed}`,
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

describe("P2 checkpoint command gaps", () => {
  it("/checkpoint-create + /checkpoint-get + /checkpoint-list 打通基础链路", async () => {
    const ctx = createCheckpointContext();

    const created = await executeSlashCommandScript("/checkpoint-create mes=1 story-turn", ctx);
    const fetched = await executeSlashCommandScript("/checkpoint-get 1", ctx);
    const listed = await executeSlashCommandScript("/checkpoint-list", ctx);

    expect(created.isError).toBe(false);
    expect(fetched.isError).toBe(false);
    expect(listed.isError).toBe(false);
    expect(created.pipe).toBe("story-turn");
    expect(fetched.pipe).toBe("story-turn");
    expect(JSON.parse(listed.pipe)).toEqual([1]);
  });

  it("/checkpoint-create 在空名称下自动命名并保持唯一", async () => {
    const ctx = createCheckpointContext();

    const first = await executeSlashCommandScript("/checkpoint-create mes=0", ctx);
    const second = await executeSlashCommandScript("/checkpoint-create mes=2", ctx);
    const list = await executeSlashCommandScript("/checkpoint-list links=true", ctx);

    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(first.pipe).toBe("checkpoint-1");
    expect(second.pipe).toBe("checkpoint-2");
    expect(JSON.parse(list.pipe)).toEqual(["checkpoint-1", "checkpoint-2"]);
  });

  it("/checkpoint-go + /checkpoint-parent + /checkpoint-exit 形成会话语义闭环", async () => {
    const ctx = createCheckpointContext();
    await executeSlashCommandScript("/checkpoint-create mes=0 branch-a", ctx);

    const goResult = await executeSlashCommandScript("/checkpoint-go 0", ctx);
    const parentResult = await executeSlashCommandScript("/checkpoint-parent", ctx);
    const exitResult = await executeSlashCommandScript("/checkpoint-exit", ctx);
    const parentAfterExit = await executeSlashCommandScript("/checkpoint-parent", ctx);

    expect(goResult.isError).toBe(false);
    expect(parentResult.isError).toBe(false);
    expect(exitResult.isError).toBe(false);
    expect(goResult.pipe).toBe("branch-a");
    expect(parentResult.pipe).toBe(ctx.characterId);
    expect(exitResult.pipe).toBe(ctx.characterId);
    expect(parentAfterExit.pipe).toBe("");
  });

  it("/checkpoint-go 在消息未绑定 checkpoint 时返回空字符串", async () => {
    const ctx = createCheckpointContext();
    const result = await executeSlashCommandScript("/checkpoint-go 2", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
  });

  it("checkpoint 命令对非法 mesId 参数做 fail-fast", async () => {
    const ctx = createCheckpointContext();

    const invalidFormat = await executeSlashCommandScript("/checkpoint-get mes=abc", ctx);
    const outOfRange = await executeSlashCommandScript("/checkpoint-create mes=9 test", ctx);

    expect(invalidFormat.isError).toBe(true);
    expect(outOfRange.isError).toBe(true);
    expect(invalidFormat.errorMessage).toContain("invalid message index");
    expect(outOfRange.errorMessage).toContain("out of range");
  });

  it("checkpoint 命令在空消息上下文下显式失败", async () => {
    const ctx = createCheckpointContext({ messages: [] });
    const result = await executeSlashCommandScript("/checkpoint-create mes=0 test", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("requires at least one message");
  });
});
