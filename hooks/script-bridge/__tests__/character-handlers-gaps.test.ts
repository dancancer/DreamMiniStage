import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiCallContext } from "../types";

const characterOpsMocks = vi.hoisted(() => ({
  getAllCharacters: vi.fn(),
  getCharacterById: vi.fn(),
  createCharacter: vi.fn(),
  updateCharacter: vi.fn(),
  deleteCharacter: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: {
    getAllCharacters: characterOpsMocks.getAllCharacters,
    getCharacterById: characterOpsMocks.getCharacterById,
    createCharacter: characterOpsMocks.createCharacter,
    updateCharacter: characterOpsMocks.updateCharacter,
    deleteCharacter: characterOpsMocks.deleteCharacter,
  },
}));

import { characterHandlers } from "../character-handlers";

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-current",
    dialogueId: "dialogue-character-test",
    messages: [],
    setScriptVariable: vi.fn(),
    deleteScriptVariable: vi.fn(),
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
    ...overrides,
  };
}

describe("character handlers p2 gaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterOpsMocks.getAllCharacters.mockResolvedValue([]);
    characterOpsMocks.getCharacterById.mockResolvedValue(null);
    characterOpsMocks.createCharacter.mockResolvedValue({});
    characterOpsMocks.updateCharacter.mockResolvedValue({});
    characterOpsMocks.deleteCharacter.mockResolvedValue(true);
  });

  it("returns current character name from current context", async () => {
    characterOpsMocks.getCharacterById.mockResolvedValueOnce({
      id: "char-current",
      imagePath: "char-current.png",
      data: {
        name: "fallback",
        description: "",
        personality: "",
        first_mes: "",
        scenario: "",
        mes_example: "",
        creatorcomment: "",
        avatar: "",
        sample_status: "",
        data: {
          name: "Alice",
          description: "",
          personality: "",
          first_mes: "",
          scenario: "",
          mes_example: "",
          creator_notes: "",
          system_prompt: "",
          post_history_instructions: "",
          tags: [],
          creator: "",
          character_version: "",
          alternate_greetings: [],
          character_book: { entries: [] },
          extensions: {},
        },
      },
    });

    await expect(
      characterHandlers.getCurrentCharacterName([], createMockContext()),
    ).resolves.toBe("Alice");
  });

  it("createCharacter keeps duplicate guard and persists normalized payload", async () => {
    characterOpsMocks.getAllCharacters.mockResolvedValueOnce([
      {
        id: "char-existing",
        imagePath: "char-existing.png",
        data: {
          name: "Existing",
          description: "",
          personality: "",
          first_mes: "",
          scenario: "",
          mes_example: "",
          creatorcomment: "",
          avatar: "",
          sample_status: "",
          data: {
            name: "Existing",
            description: "",
            personality: "",
            first_mes: "",
            scenario: "",
            mes_example: "",
            creator_notes: "",
            system_prompt: "",
            post_history_instructions: "",
            tags: [],
            creator: "",
            character_version: "",
            alternate_greetings: [],
            character_book: { entries: [] },
            extensions: {},
          },
        },
      },
    ]);
    await expect(
      characterHandlers.createCharacter(["Existing", {}], createMockContext()),
    ).resolves.toBe(false);

    characterOpsMocks.getAllCharacters.mockResolvedValueOnce([]);
    await expect(
      characterHandlers.createCharacter(
        ["Neo", { description: "desc", first_messages: ["hi", "hey"], worldbook: "wb-1" }],
        createMockContext(),
      ),
    ).resolves.toBe(true);

    expect(characterOpsMocks.createCharacter).toHaveBeenCalledTimes(1);
    expect(characterOpsMocks.createCharacter).toHaveBeenCalledWith(
      expect.stringMatching(/^char_/),
      expect.objectContaining({
        name: "Neo",
        description: "desc",
        first_mes: "hi",
        data: expect.objectContaining({
          name: "Neo",
          alternate_greetings: ["hey"],
          extensions: expect.objectContaining({ world: "wb-1" }),
        }),
      }),
      expect.stringMatching(/^char_.*\.png$/),
    );
  });

  it("replaceCharacter/deleteCharacter support current alias and fail-fast guards", async () => {
    characterOpsMocks.getCharacterById.mockResolvedValue({
      id: "char-current",
      imagePath: "char-current.png",
      data: {
        id: "char-current",
        name: "Current",
        description: "",
        personality: "",
        first_mes: "a",
        scenario: "",
        mes_example: "",
        creatorcomment: "",
        avatar: "",
        sample_status: "",
        data: {
          name: "Current",
          description: "",
          personality: "",
          first_mes: "a",
          scenario: "",
          mes_example: "",
          creator_notes: "",
          system_prompt: "",
          post_history_instructions: "",
          tags: [],
          creator: "",
          character_version: "",
          alternate_greetings: [],
          character_book: { entries: [] },
          extensions: {},
        },
      },
    });
    characterOpsMocks.updateCharacter.mockResolvedValueOnce({
      id: "char-current",
    });

    await expect(
      characterHandlers.replaceCharacter(
        ["current", { first_messages: ["new-first"] }],
        createMockContext(),
      ),
    ).resolves.toBe(true);
    expect(characterOpsMocks.updateCharacter).toHaveBeenCalledWith(
      "char-current",
      expect.objectContaining({
        first_mes: "new-first",
      }),
    );

    await expect(
      characterHandlers.deleteCharacter(["current"], createMockContext()),
    ).resolves.toBe(true);
    expect(characterOpsMocks.deleteCharacter).toHaveBeenCalledWith("char-current");

    await expect(
      characterHandlers.createCharacter(["current"], createMockContext()),
    ).rejects.toThrow("does not allow name='current'");
  });
});
