import { describe, expect, it } from "vitest";
import type { LLMConfig } from "@/lib/nodeflow/LLMNode/llm-config";
import {
  buildQaRepairPrompt,
  createQaModelAdapter,
  parseQaRepairResponse,
} from "../qa-repair-model";
import type { LlmQaInput } from "../repair-patch";

const input: LlmQaInput = {
  bundleId: "bundle:qa",
  schemaVersion: 1,
  diagnostics: [
    {
      code: "character.missing_description",
      severity: "warning",
      message: "empty",
      targetPath: "character.description",
    },
  ],
  repairablePaths: ["/character/description"],
};

describe("buildQaRepairPrompt", () => {
  it("produces a system instruction plus a user payload carrying the QA input", () => {
    const messages = buildQaRepairPrompt(input);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/JSON Pointer/i);
    expect(messages[0].content).toMatch(/patches/);
    const user = messages.find((message) => message.role === "user");
    expect(user?.content).toContain("bundle:qa");
    expect(user?.content).toContain("/character/description");
  });
});

describe("parseQaRepairResponse", () => {
  it("extracts JSON from a fenced code block", () => {
    expect(parseQaRepairResponse('```json\n{"patches":[]}\n```')).toEqual({ patches: [] });
  });

  it("extracts JSON embedded in prose", () => {
    expect(parseQaRepairResponse('Sure! {"patches":[]} done')).toEqual({ patches: [] });
  });

  it("throws when the response carries no JSON object", () => {
    expect(() => parseQaRepairResponse("no json at all")).toThrow();
  });
});

describe("createQaModelAdapter", () => {
  it("invokes the model with non-streaming QA messages and parses the response", async () => {
    let seen: LLMConfig | undefined;
    const invokeLLM = async (config: LLMConfig) => {
      seen = config;
      return '{"patches":[]}';
    };
    const adapter = createQaModelAdapter({
      invokeLLM,
      baseConfig: {
        modelName: "m",
        apiKey: "k",
        llmType: "openai",
        mvuToolEnabled: true,
        tools: true,
        stopStrings: ["STOP"],
      },
    });

    const result = await adapter(input);

    expect(result).toEqual({ patches: [] });
    expect(seen?.streaming).toBe(false);
    expect(seen?.messages?.[0].role).toBe("system");
    expect(seen?.modelName).toBe("m");
  });

  it("sanitizes session-only config (tools, mvu, stop strings) out of the QA call", async () => {
    let seen: LLMConfig | undefined;
    const invokeLLM = async (config: LLMConfig) => {
      seen = config;
      return '{"patches":[]}';
    };
    const adapter = createQaModelAdapter({
      invokeLLM,
      baseConfig: {
        modelName: "m",
        apiKey: "k",
        llmType: "openai",
        mvuToolEnabled: true,
        tools: true,
        stopStrings: ["STOP"],
      },
    });

    await adapter(input);

    expect(seen?.mvuToolEnabled).toBeUndefined();
    expect(seen?.tools).toBeUndefined();
    expect(seen?.stopStrings).toBeUndefined();
    expect(seen?.apiKey).toBe("k");
  });
});
