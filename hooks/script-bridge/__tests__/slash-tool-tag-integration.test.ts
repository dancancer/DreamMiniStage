import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiCallContext } from "../types";

const characterOpsMocks = vi.hoisted(() => ({
  getAllCharacters: vi.fn(),
  getCharacterById: vi.fn(),
  updateCharacter: vi.fn(),
}));

const toolBridgeMocks = vi.hoisted(() => ({
  getRegisteredScriptTools: vi.fn(),
  invokeScriptTool: vi.fn(),
}));

vi.mock("@/lib/data/roleplay/character-record-operation", () => ({
  LocalCharacterRecordOperations: {
    getAllCharacters: characterOpsMocks.getAllCharacters,
    getCharacterById: characterOpsMocks.getCharacterById,
    updateCharacter: characterOpsMocks.updateCharacter,
  },
}));

vi.mock("../tool-handlers", () => ({
  getRegisteredScriptTools: toolBridgeMocks.getRegisteredScriptTools,
  invokeScriptTool: toolBridgeMocks.invokeScriptTool,
}));

import { slashHandlers } from "../slash-handlers";

let currentRecord: {
  id: string;
  data: {
    name: string;
    data: {
      name: string;
      tags: string[];
    };
  };
};

function createMockContext(overrides: Partial<ApiCallContext> = {}): ApiCallContext {
  return {
    characterId: "char-current",
    dialogueId: "dialogue-tool-tag",
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

describe("slash handlers tool/tag integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRecord = {
      id: "char-current",
      data: {
        name: "Alice",
        data: {
          name: "Alice",
          tags: ["base"],
        },
      },
    };

    characterOpsMocks.getCharacterById.mockImplementation(async () => currentRecord);
    characterOpsMocks.getAllCharacters.mockImplementation(async () => [currentRecord]);
    characterOpsMocks.updateCharacter.mockImplementation(async (_id, patch) => {
      currentRecord = {
        ...currentRecord,
        data: {
          ...currentRecord.data,
          ...patch,
          data: {
            ...currentRecord.data.data,
            ...patch.data,
          },
        },
      };
      return currentRecord;
    });

    toolBridgeMocks.getRegisteredScriptTools.mockReturnValue([
      {
        name: "weather",
        description: "Read the weather",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
      },
    ]);
    toolBridgeMocks.invokeScriptTool.mockImplementation(async (name, parameters) => ({
      name,
      parameters,
      ok: true,
    }));
  });

  it("通过 adapter 让 tag 命令直接读写角色元数据", async () => {
    const result = await slashHandlers.triggerSlash(
      ["/tag-add scenario|/tag-exists scenario|/tag-list"],
      createMockContext(),
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("base, scenario");
    expect(characterOpsMocks.updateCharacter).toHaveBeenCalledWith(
      "char-current",
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["base", "scenario"],
        }),
      }),
    );
  });

  it("通过 adapter 让 tool 命令复用 script tool registry", async () => {
    const listed = await slashHandlers.triggerSlash(
      ["/tool-list return=pipe"],
      createMockContext(),
    );
    const invoked = await slashHandlers.triggerSlash(
      ['/tool-invoke weather parameters={"city":"Paris"}'],
      createMockContext(),
    );

    expect(listed).toMatchObject({ isError: false, pipe: "weather" });
    expect(invoked).toMatchObject({
      isError: false,
      pipe: '{"name":"weather","parameters":{"city":"Paris"},"ok":true}',
    });
    expect(toolBridgeMocks.invokeScriptTool).toHaveBeenCalledWith("weather", { city: "Paris" });
  });
});
