import { describe, expect, it, vi } from "vitest";

describe("session-chat-actions", () => {
  it("builds a guided message for normal submit and delegates slash input to executor", async () => {
    const { createSessionChatActions } = await import("../session-chat-actions");

    const executeSessionSlashInput = vi.fn().mockResolvedValue("");
    const handleSendMessage = vi.fn().mockResolvedValue(undefined);
    const setUserInput = vi.fn();

    const actions = createSessionChatActions({
      executeSessionSlashInput,
      handleSendMessage,
      setUserInput,
      t: (key) => key,
      isSending: false,
      activeModes: {
        "story-progress": true,
        perspective: { active: true, mode: "novel" },
        "scene-setting": false,
      },
    });

    await actions.handleSubmit({
      preventDefault() {},
    } as never, "/proxy Claude Reverse");
    await actions.handleSubmit({
      preventDefault() {},
    } as never, "hello");

    expect(executeSessionSlashInput).toHaveBeenCalledWith("/proxy Claude Reverse");
    expect(handleSendMessage).toHaveBeenCalledWith(expect.stringContaining("characterChat.storyProgressHint"));
    expect(setUserInput).toHaveBeenCalledWith("");
  });
});
