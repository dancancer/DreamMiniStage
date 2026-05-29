import { describe, expect, it, vi } from "vitest";
import { createSessionSlashExecutor } from "../session-slash-executor";
import type { DialogueMessage } from "@/types/character-dialogue";

function buildDialogue(overrides: Partial<{
  messages: DialogueMessage[];
  addUserMessage: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    messages: overrides.messages || [
      { id: "m0", role: "assistant", content: "hello" },
    ],
    addUserMessage: overrides.addUserMessage || vi.fn().mockResolvedValue(undefined),
  };
}

function buildExecutor(overrides: Partial<{
  setUserInput: ReturnType<typeof vi.fn>;
  addUserMessage: ReturnType<typeof vi.fn>;
  message: string;
  nosend: boolean;
}> = {}) {
  const dialogue = buildDialogue({ addUserMessage: overrides.addUserMessage });
  const activateContextSets = vi.fn();
  return {
    dialogue,
    activateContextSets,
    executor: createSessionSlashExecutor({
      sessionId: "session-1",
      dialogue,
      quickReplyStore: {
        resolveVisibleQuickReply: () => ({
          set: { nosend: overrides.nosend ?? false, inject: false, before: false },
          reply: { message: overrides.message ?? "hello from quick reply" },
          scope: "chat",
        }),
        activateContextSets,
      },
      setUserInput: overrides.setUserInput || vi.fn(),
    }),
  };
}

describe("session story input executor", () => {
  it("routes normal quick replies as plain user messages", async () => {
    const { dialogue, activateContextSets, executor } = buildExecutor();

    await expect(executor.executeQuickReplyByIndex(0)).resolves.toBe("hello from quick reply");

    expect(activateContextSets).toHaveBeenCalledWith("session-1", { message: "hello from quick reply" });
    expect(dialogue.addUserMessage).toHaveBeenCalledWith("hello from quick reply");
  });

  it("routes nosend quick replies into input state without sending a message", async () => {
    const setUserInput = vi.fn();
    const { dialogue, executor } = buildExecutor({
      setUserInput,
      message: "prefilled text",
      nosend: true,
    });

    await expect(executor.executeQuickReplyByIndex(0)).resolves.toBe("prefilled text");
    expect(setUserInput).toHaveBeenCalledWith("prefilled text");
    expect(dialogue.addUserMessage).not.toHaveBeenCalled();
  });

  it("rejects direct slash input instead of running script-bridge", async () => {
    const { executor } = buildExecutor();

    await expect(executor.executeSessionSlashInput("/proxy Claude Reverse"))
      .rejects.toThrow("Slash scripts are not supported in story runtime");
  });

  it("rejects slash quick reply payloads", async () => {
    const { executor } = buildExecutor({ message: "/send hidden script" });

    await expect(executor.executeQuickReplyByIndex(0))
      .rejects.toThrow("Slash scripts are not supported in story runtime");
  });
});
