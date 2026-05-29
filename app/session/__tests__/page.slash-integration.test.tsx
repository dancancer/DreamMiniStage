import { describe, expect, it, vi } from "vitest";
import { createSessionChatActions } from "../session-chat-actions";

describe("Session page story input boundary", () => {
  it("fails fast for slash input instead of executing script runtime", async () => {
    const executeSessionSlashInput = vi.fn().mockRejectedValue(
      new Error("Slash scripts are not supported in story runtime: /proxy Claude Reverse"),
    );
    const onError = vi.fn();
    const handleSendMessage = vi.fn();
    const actions = createSessionChatActions({
      executeSessionSlashInput,
      executeQuickReplyByIndex: vi.fn(),
      handleSendMessage,
      setUserInput: vi.fn(),
      t: (key) => key,
      isSending: false,
      activeModes: {},
      onError,
    });

    await actions.handleSubmit({ preventDefault() {} } as never, "/proxy Claude Reverse");

    expect(executeSessionSlashInput).toHaveBeenCalledWith("/proxy Claude Reverse");
    expect(handleSendMessage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Slash scripts are not supported in story runtime: /proxy Claude Reverse",
    );
  });

  it("runs quick reply panel through the story input executor, not slash /qr", async () => {
    const executeSessionSlashInput = vi.fn();
    const executeQuickReplyByIndex = vi.fn().mockResolvedValue("hello");
    const actions = createSessionChatActions({
      executeSessionSlashInput,
      executeQuickReplyByIndex,
      handleSendMessage: vi.fn(),
      setUserInput: vi.fn(),
      t: (key) => key,
      isSending: false,
      activeModes: {},
      onError: vi.fn(),
    });

    await actions.handleExecuteQuickReplyPanel(2);

    expect(executeQuickReplyByIndex).toHaveBeenCalledWith(2);
    expect(executeSessionSlashInput).not.toHaveBeenCalled();
  });
});
