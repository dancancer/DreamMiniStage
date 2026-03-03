import { describe, expect, it, vi } from "vitest";
import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createCharacterContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-1",
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    onSendSystem: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P2 character/message high-frequency gaps", () => {
  it("/comment 复用系统消息通道", async () => {
    const ctx = createCharacterContext();
    const result = await executeSlashCommandScript("/comment 这是备注", ctx);

    expect(result.isError).toBe(false);
    expect(ctx.onSendSystem).toHaveBeenCalledWith("这是备注");
  });

  it("/char 在无参数时返回当前角色", async () => {
    const ctx = createCharacterContext({
      getCurrentCharacter: vi.fn().mockResolvedValue({ id: "char-1", name: "Alice" }),
    });

    const result = await executeSlashCommandScript("/char", ctx);
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe(JSON.stringify({ id: "char-1", name: "Alice" }));
  });

  it("/character 在有参数时执行切换", async () => {
    const switchCharacter = vi.fn().mockResolvedValue(undefined);
    const ctx = createCharacterContext({ switchCharacter });

    const result = await executeSlashCommandScript("/character Bob", ctx);
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("Bob");
    expect(switchCharacter).toHaveBeenCalledWith("Bob");
  });

  it("/go 复用 character 切换语义", async () => {
    const switchCharacter = vi.fn().mockResolvedValue(undefined);
    const ctx = createCharacterContext({ switchCharacter });

    const result = await executeSlashCommandScript("/go Charlie", ctx);
    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("Charlie");
    expect(switchCharacter).toHaveBeenCalledWith("Charlie");
  });

  it("/character 在回调返回结构化结果时透传 JSON", async () => {
    const switchCharacter = vi.fn().mockResolvedValue({
      target: "Bob",
      characterId: "char-2",
      characterName: "Bob",
      sessionId: "session-2",
      sessionName: "Bob - 03/02 23:30 [from Alice]",
    });
    const ctx = createCharacterContext({ switchCharacter });

    const result = await executeSlashCommandScript("/character Bob", ctx);

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.pipe)).toEqual({
      target: "Bob",
      characterId: "char-2",
      characterName: "Bob",
      sessionId: "session-2",
      sessionName: "Bob - 03/02 23:30 [from Alice]",
    });
  });

  it("/char-find 与 /findchar 返回匹配角色", async () => {
    const listCharacters = vi.fn().mockResolvedValue([
      { id: "char-1", name: "Alice" },
      { id: "char-2", name: "Bob" },
    ]);
    const ctx = createCharacterContext({ listCharacters });

    const first = await executeSlashCommandScript("/char-find ali", ctx);
    const second = await executeSlashCommandScript("/findchar char-2", ctx);

    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(JSON.parse(first.pipe)).toEqual([{ id: "char-1", name: "Alice" }]);
    expect(JSON.parse(second.pipe)).toEqual([{ id: "char-2", name: "Bob" }]);
  });

  it("/char 切换在缺失回调时 fail-fast", async () => {
    const ctx = createCharacterContext();
    const result = await executeSlashCommandScript("/char someone", ctx);

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("/char switch is not available");
  });
});
