import { describe, expect, it, vi } from "vitest";
import type { DialogueMessage } from "@/types/character-dialogue";

const baseMessages: DialogueMessage[] = [
  { id: "m0", role: "assistant", content: "hello" },
  { id: "m1", role: "assistant", content: "world" },
];

describe("session-message-events", () => {
  it("applies set/create/delete patches through one message-state utility", async () => {
    const {
      applySessionMessagePatches,
      appendSessionMessages,
      removeSessionMessages,
    } = await import("../session-message-events");

    expect(applySessionMessagePatches(baseMessages, [{
      message_id: "m1",
      message: "patched world",
      name: "Narrator",
    }])).toEqual([
      { id: "m0", role: "assistant", content: "hello" },
      { id: "m1", role: "assistant", content: "patched world", name: "Narrator" },
    ]);

    expect(appendSessionMessages(baseMessages, [{
      id: "m2",
      role: "user",
      content: "new turn",
    }])).toEqual([
      { id: "m0", role: "assistant", content: "hello" },
      { id: "m1", role: "assistant", content: "world" },
      { id: "m2", role: "user", content: "new turn" },
    ]);

    expect(removeSessionMessages(baseMessages, ["m0"])).toEqual([
      { id: "m1", role: "assistant", content: "world" },
    ]);
  });

  it("creates browser event handlers that patch messages or regenerate assistant replies", async () => {
    const {
      createSessionMessageEventHandlers,
    } = await import("../session-message-events");

    const setDialogueMessages = vi.fn();
    const regenerateDialogueMessage = vi.fn();
    const onError = vi.fn();

    const handlers = createSessionMessageEventHandlers({
      characterId: "char-1",
      dialogueMessages: baseMessages,
      setDialogueMessages,
      regenerateDialogueMessage,
      onError,
    });

    handlers.handleSetChatMessages(new CustomEvent("DreamMiniStage:setChatMessages", {
      detail: {
        characterId: "char-1",
        messages: [{
          message_id: "m1",
          message: "patched world",
        }],
      },
    }));
    handlers.handleCreateChatMessages(new CustomEvent("DreamMiniStage:createChatMessages", {
      detail: {
        characterId: "char-1",
        messages: [{
          id: "m2",
          role: "user",
          content: "new turn",
        }],
      },
    }));
    handlers.handleDeleteChatMessages(new CustomEvent("DreamMiniStage:deleteChatMessages", {
      detail: {
        characterId: "char-1",
        messageIds: ["m0"],
      },
    }));
    handlers.handleRefreshOneMessage(new CustomEvent("DreamMiniStage:refreshOneMessage", {
      detail: {
        characterId: "char-1",
        message_id: "m1",
      },
    }));

    expect(setDialogueMessages).toHaveBeenNthCalledWith(1, [
      { id: "m0", role: "assistant", content: "hello" },
      { id: "m1", role: "assistant", content: "patched world" },
    ]);
    expect(setDialogueMessages).toHaveBeenNthCalledWith(2, [
      { id: "m0", role: "assistant", content: "hello" },
      { id: "m1", role: "assistant", content: "world" },
      { id: "m2", role: "user", content: "new turn" },
    ]);
    expect(setDialogueMessages).toHaveBeenNthCalledWith(3, [
      { id: "m1", role: "assistant", content: "world" },
    ]);
    expect(regenerateDialogueMessage).toHaveBeenCalledWith("m1");
    expect(onError).not.toHaveBeenCalled();
  });
});
