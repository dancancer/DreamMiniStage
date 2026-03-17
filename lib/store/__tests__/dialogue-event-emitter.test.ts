import { beforeEach, describe, expect, it, vi } from "vitest";

const emitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/events", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

import {
  emitAssistantMessageReceived,
  emitDialogueError,
  emitGenerationEnded,
  emitGenerationStarted,
  emitUserMessageSent,
} from "@/lib/store/dialogue-store/actions/dialogue-event-emitter";
import { EVENT_TYPES } from "@/lib/events/types";

describe("dialogue event emitter helpers", () => {
  beforeEach(() => {
    emitMock.mockReset();
  });

  it("emits generation started with the normalized payload", () => {
    emitGenerationStarted({
      generationType: "normal",
      characterId: "char-1",
      userInput: "hello",
      timestamp: 123,
    });

    expect(emitMock).toHaveBeenCalledWith(EVENT_TYPES.GENERATION_STARTED, {
      type: EVENT_TYPES.GENERATION_STARTED,
      generationType: "normal",
      characterId: "char-1",
      userInput: "hello",
      timestamp: 123,
    });
  });

  it("emits assistant message received and generation ended", () => {
    emitAssistantMessageReceived("msg-1", "reply", "char-1", 456);
    emitGenerationEnded(true, "reply", 100, 250);

    expect(emitMock).toHaveBeenNthCalledWith(1, EVENT_TYPES.MESSAGE_RECEIVED, {
      type: EVENT_TYPES.MESSAGE_RECEIVED,
      messageId: "msg-1",
      content: "reply",
      sender: "assistant",
      characterName: "char-1",
      timestamp: 456,
    });
    expect(emitMock).toHaveBeenNthCalledWith(2, EVENT_TYPES.GENERATION_ENDED, {
      type: EVENT_TYPES.GENERATION_ENDED,
      success: true,
      content: "reply",
      duration: 150,
      timestamp: 250,
    });
  });

  it("emits user message sent and error payloads", () => {
    emitUserMessageSent("msg-user", "hello", 789);
    emitDialogueError("boom", "generateResponse", 790);

    expect(emitMock).toHaveBeenNthCalledWith(1, EVENT_TYPES.MESSAGE_SENT, {
      type: EVENT_TYPES.MESSAGE_SENT,
      messageId: "msg-user",
      content: "hello",
      timestamp: 789,
    });
    expect(emitMock).toHaveBeenNthCalledWith(2, EVENT_TYPES.ERROR_OCCURRED, {
      type: EVENT_TYPES.ERROR_OCCURRED,
      message: "boom",
      source: "generateResponse",
      timestamp: 790,
    });
  });
});
