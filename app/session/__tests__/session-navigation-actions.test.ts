import { describe, expect, it, vi } from "vitest";

describe("session-navigation-actions", () => {
  it("switches character by creating a new session and pushing the new route", async () => {
    const { createSessionNavigationActions } = await import("../session-navigation-actions");

    const actions = createSessionNavigationActions({
      sessionId: "session-1",
      characterId: "char-1",
      currentCharacterName: "Alice",
      createSession: vi.fn().mockResolvedValue("session-2"),
      updateSessionName: vi.fn(),
      resolveCharacterSwitchTarget: vi.fn().mockResolvedValue("char-2"),
      getCharacterNameById: vi.fn().mockResolvedValue("Bob"),
      updateCharacterName: vi.fn(),
      pushRoute: vi.fn(),
      queryMessageElement: vi.fn(),
      currentMessagesLength: 2,
      setCharacterNameOverride: vi.fn(),
      buildTemporarySessionName: () => "Bob [temp]",
      buildSwitchedSessionName: () => "Bob - switched",
    });

    const result = await actions.handleSwitchCharacter("Bob");

    expect(result).toMatchObject({
      characterId: "char-2",
      characterName: "Bob",
      sessionId: "session-2",
      sessionName: "Bob - switched",
    });
  });
});
