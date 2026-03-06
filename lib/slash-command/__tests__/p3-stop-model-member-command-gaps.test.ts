import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-gap-1",
    messages: [
      { id: "m-0", role: "user", content: "hello", name: "User" },
      { id: "m-1", role: "assistant", content: "world", name: "Assistant" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    onSendSystem: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 stop/model/member command gaps", () => {
  it("/custom-stop-strings 支持读取和设置，并覆盖别名", async () => {
    const getStopStrings = vi.fn().mockResolvedValue(["alpha", "beta"]);
    const setStopStrings = vi
      .fn()
      .mockResolvedValueOnce(["left|right", "done"])
      .mockResolvedValueOnce([]);
    const ctx = createContext({ getStopStrings, setStopStrings });

    const readResult = await executeSlashCommandScript("/custom-stop-strings", ctx);
    const setResult = await executeSlashCommandScript(
      "/echo [\"left|right\",\"done\"]|/stop-strings",
      ctx,
    );
    const forceEmpty = await executeSlashCommandScript("/custom-stopping-strings force=true", ctx);

    expect(readResult.isError).toBe(false);
    expect(setResult.isError).toBe(false);
    expect(forceEmpty.isError).toBe(false);
    expect(readResult.pipe).toBe("[\"alpha\",\"beta\"]");
    expect(setResult.pipe).toBe("[\"left|right\",\"done\"]");
    expect(forceEmpty.pipe).toBe("[]");
    expect(getStopStrings).toHaveBeenCalledTimes(1);
    expect(setStopStrings).toHaveBeenNthCalledWith(1, ["left|right", "done"]);
    expect(setStopStrings).toHaveBeenNthCalledWith(2, []);
  });

  it("/custom-stop-strings 对非法参数显式 fail-fast", async () => {
    const ctx = createContext({
      getStopStrings: vi.fn().mockResolvedValue([]),
      setStopStrings: vi.fn().mockResolvedValue([]),
    });

    const invalidForce = await executeSlashCommandScript("/custom-stop-strings force=maybe", ctx);
    const invalidValue = await executeSlashCommandScript("/custom-stop-strings nope", ctx);

    expect(invalidForce.isError).toBe(true);
    expect(invalidValue.isError).toBe(true);
    expect(invalidForce.errorMessage).toContain("invalid force value");
    expect(invalidValue.errorMessage).toContain("invalid value");
  });

  it("/model 支持读取和设置 quiet，并校验回调返回值", async () => {
    const getModel = vi.fn().mockResolvedValue("gpt-4.1");
    const setModel = vi.fn().mockResolvedValue("gpt-4.1-mini");
    const ctx = createContext({ getModel, setModel });

    const readResult = await executeSlashCommandScript("/model", ctx);
    const setResult = await executeSlashCommandScript("/model quiet=true gpt-4.1-mini", ctx);

    expect(readResult.isError).toBe(false);
    expect(setResult.isError).toBe(false);
    expect(readResult.pipe).toBe("gpt-4.1");
    expect(setResult.pipe).toBe("gpt-4.1-mini");
    expect(getModel).toHaveBeenCalledTimes(1);
    expect(setModel).toHaveBeenCalledWith("gpt-4.1-mini", { quiet: true });
  });

  it("/model 对缺少回调与非法 quiet 显式 fail-fast", async () => {
    const missing = await executeSlashCommandScript("/model test", createContext());
    const invalidQuiet = await executeSlashCommandScript(
      "/model quiet=maybe test",
      createContext({ setModel: vi.fn().mockResolvedValue("test") }),
    );

    expect(missing.isError).toBe(true);
    expect(invalidQuiet.isError).toBe(true);
    expect(missing.errorMessage).toContain("not available");
    expect(invalidQuiet.errorMessage).toContain("invalid quiet value");
  });

  it("member 编排命令簇与别名可透传宿主回调", async () => {
    const removeGroupMember = vi.fn().mockResolvedValue("removed");
    const moveGroupMember = vi
      .fn()
      .mockResolvedValueOnce("up-ok")
      .mockResolvedValueOnce("down-ok");
    const peekGroupMember = vi.fn().mockResolvedValue("peek-ok");
    const ctx = createContext({ removeGroupMember, moveGroupMember, peekGroupMember });

    const upResult = await executeSlashCommandScript("/member-up Alice", ctx);
    const downAlias = await executeSlashCommandScript("/downmember Bob", ctx);
    const peekAlias = await executeSlashCommandScript("/peek Carol", ctx);
    const removeAlias = await executeSlashCommandScript("/memberremove Dave", ctx);

    expect(upResult.isError).toBe(false);
    expect(downAlias.isError).toBe(false);
    expect(peekAlias.isError).toBe(false);
    expect(removeAlias.isError).toBe(false);
    expect(upResult.pipe).toBe("up-ok");
    expect(downAlias.pipe).toBe("down-ok");
    expect(peekAlias.pipe).toBe("peek-ok");
    expect(removeAlias.pipe).toBe("removed");
    expect(moveGroupMember).toHaveBeenNthCalledWith(1, "Alice", "up");
    expect(moveGroupMember).toHaveBeenNthCalledWith(2, "Bob", "down");
    expect(peekGroupMember).toHaveBeenCalledWith("Carol");
    expect(removeGroupMember).toHaveBeenCalledWith("Dave");
  });

  it("member 编排命令在缺参或缺失回调时显式 fail-fast", async () => {
    const missingTarget = await executeSlashCommandScript(
      "/member-up",
      createContext({ moveGroupMember: vi.fn().mockResolvedValue(undefined) }),
    );
    const missingCallback = await executeSlashCommandScript("/member-remove Alice", createContext());

    expect(missingTarget.isError).toBe(true);
    expect(missingCallback.isError).toBe(true);
    expect(missingTarget.errorMessage).toContain("requires a member target");
    expect(missingCallback.errorMessage).toContain("not available");
  });

  it("/nar 与 /narrate 支持旁白回调闭环", async () => {
    const onSendSystem = vi.fn().mockResolvedValue(undefined);
    const narrateText = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ onSendSystem, narrateText });

    const narResult = await executeSlashCommandScript("/nar legacy narrator", ctx);
    const narrateResult = await executeSlashCommandScript("/narrate voice=Eve spoken text", ctx);
    const speakResult = await executeSlashCommandScript("/speak voice=Mallory louder words", ctx);
    const ttsResult = await executeSlashCommandScript("/tts voice=Bob piped line", ctx);

    expect(narResult.isError).toBe(false);
    expect(narrateResult.isError).toBe(false);
    expect(speakResult.isError).toBe(false);
    expect(ttsResult.isError).toBe(false);
    expect(narResult.pipe).toBe("legacy narrator");
    expect(narrateResult.pipe).toBe("");
    expect(speakResult.pipe).toBe("");
    expect(ttsResult.pipe).toBe("");
    expect(onSendSystem).toHaveBeenCalledWith("legacy narrator");
    expect(narrateText).toHaveBeenNthCalledWith(1, "spoken text", { voice: "Eve" });
    expect(narrateText).toHaveBeenNthCalledWith(2, "louder words", { voice: "Mallory" });
    expect(narrateText).toHaveBeenNthCalledWith(3, "piped line", { voice: "Bob" });
  });

  it("/name 作为 /message-name 别名支持末条消息读写", async () => {
    const setMessageName = vi.fn().mockImplementation(async (index: number, name: string) => {
      // 由命令层负责索引校验；这里仅模拟宿主写入
      expect(index).toBe(1);
      expect(name).toBe("Narrator");
    });
    const ctx = createContext({ setMessageName });

    const writeResult = await executeSlashCommandScript("/name Narrator", ctx);
    ctx.messages[1].name = "Narrator";
    const readResult = await executeSlashCommandScript("/name", ctx);

    expect(writeResult.isError).toBe(false);
    expect(readResult.isError).toBe(false);
    expect(writeResult.pipe).toBe("Narrator");
    expect(readResult.pipe).toBe("Narrator");
    expect(setMessageName).toHaveBeenCalledTimes(1);
  });
});
