import { describe, expect, it, vi } from "vitest";
import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createMessageContext(): ExecutionContext {
  const messages = [
    { id: "m1", role: "user", content: "hello" },
    { id: "m2", role: "assistant", content: "world", name: "bot" },
  ];

  return {
    characterId: "char-1",
    messages,
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    onSendSystem: vi.fn().mockResolvedValue(undefined),
    onImpersonate: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe("P2 message command aliases", () => {
  it("/setmessage 与 /setmes 复用编辑语义", async () => {
    const ctx = createMessageContext();

    const first = await executeSlashCommandScript("/setmessage 0 updated", ctx);
    const second = await executeSlashCommandScript("/setmes 1 changed", ctx);

    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(ctx.editMessage).toHaveBeenNthCalledWith(1, 0, "updated");
    expect(ctx.editMessage).toHaveBeenNthCalledWith(2, 1, "changed");
  });

  it("/messages 与 /mes 返回消息快照", async () => {
    const ctx = createMessageContext();

    const full = await executeSlashCommandScript("/messages", ctx);
    const single = await executeSlashCommandScript("/mes 0", ctx);

    expect(full.isError).toBe(false);
    expect(single.isError).toBe(false);

    const fullList = JSON.parse(full.pipe) as Array<{ id: string; index: number; content: string }>;
    const singleList = JSON.parse(single.pipe) as Array<{ id: string; index: number; content: string }>;

    expect(fullList).toHaveLength(2);
    expect(fullList[1].id).toBe("m2");
    expect(singleList).toEqual([
      { id: "m1", index: 0, role: "user", content: "hello" },
    ]);
  });

  it("/edit 与 /del 复用消息管理处理器", async () => {
    const ctx = createMessageContext();

    const editRes = await executeSlashCommandScript("/edit 0 patched", ctx);
    const delRes = await executeSlashCommandScript("/del 1", ctx);

    expect(editRes.isError).toBe(false);
    expect(delRes.isError).toBe(false);
    expect(ctx.editMessage).toHaveBeenCalledWith(0, "patched");
    expect(ctx.deleteMessage).toHaveBeenCalledWith(1);
  });

  it("/narrator 与 /imp 覆盖核心消息别名", async () => {
    const ctx = createMessageContext();

    const narratorRes = await executeSlashCommandScript("/narrator 注意旁白", ctx);
    const impRes = await executeSlashCommandScript("/imp imitate-user", ctx);

    expect(narratorRes.isError).toBe(false);
    expect(impRes.isError).toBe(false);
    expect(ctx.onSendSystem).toHaveBeenCalledWith("注意旁白");
    expect(ctx.onImpersonate).toHaveBeenCalledWith("imitate-user");
  });
});
