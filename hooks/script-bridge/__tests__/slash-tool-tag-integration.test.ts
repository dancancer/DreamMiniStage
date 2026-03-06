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
  registerScriptTool: vi.fn(),
  unregisterScriptTool: vi.fn(),
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
  registerScriptTool: toolBridgeMocks.registerScriptTool,
  unregisterScriptTool: toolBridgeMocks.unregisterScriptTool,
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
  const registeredTools = new Map<string, {
    name: string;
    description: string;
    parameters: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
    handler?: (args: Record<string, unknown>) => unknown | Promise<unknown>;
  }>();

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.clear();
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

    registeredTools.set("weather", {
      name: "weather",
      description: "Read the weather",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
        },
        required: ["city"],
      },
    });
    toolBridgeMocks.getRegisteredScriptTools.mockImplementation(() => {
      return Array.from(registeredTools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    });
    toolBridgeMocks.registerScriptTool.mockImplementation((name, description, parameters, handler) => {
      registeredTools.set(name, {
        name,
        description,
        parameters,
        handler,
      });
      return true;
    });
    toolBridgeMocks.unregisterScriptTool.mockImplementation((name) => {
      return registeredTools.delete(name);
    });
    toolBridgeMocks.invokeScriptTool.mockImplementation(async (name, parameters) => {
      const tool = registeredTools.get(name);
      if (tool?.handler) {
        return tool.handler(parameters);
      }
      return {
        name,
        parameters,
        ok: true,
      };
    });
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

  it("通过 adapter 让 tool 注册命令落到单一路径 registry，并执行 action script", async () => {
    const ctx = createMockContext();

    const result = await slashHandlers.triggerSlash(
      [
        '/tool-register name=echo description=Echo parameters={"type":"object","properties":{"message":{"type":"string"}}} {: /echo {{var::arg.message}} :}|/tool-invoke echo parameters={"message":"Ping"}',
      ],
      ctx,
    );
    const removed = await slashHandlers.triggerSlash([
      "/tool-unregister echo",
    ], ctx);

    expect(result).toMatchObject({ isError: false, pipe: "Ping" });
    expect(removed).toMatchObject({ isError: false, pipe: "true" });
    expect(toolBridgeMocks.registerScriptTool).toHaveBeenCalledWith(
      "echo",
      "Echo",
      {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: undefined,
      },
      expect.any(Function),
    );
    expect(toolBridgeMocks.unregisterScriptTool).toHaveBeenCalledWith("echo");
  });
});
