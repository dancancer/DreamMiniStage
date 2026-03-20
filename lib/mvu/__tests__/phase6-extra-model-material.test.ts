import { beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "./fixtures/phase6/extra-model-material-workflow.json";

const chatMock = vi.fn();
const createApiClientMock = vi.fn();
const getCharacterVariablesMock = vi.fn();
const saveNodeVariablesMock = vi.fn();

vi.mock("@/lib/api/backends", () => ({
  createApiClient: (...args: unknown[]) => createApiClientMock(...args),
}));

vi.mock("@/lib/core/gemini-client", () => ({
  callGeminiOnce: vi.fn(),
}));

vi.mock("@/lib/mvu/data/persistence", () => ({
  getCharacterVariables: (...args: unknown[]) => getCharacterVariablesMock(...args),
  saveNodeVariables: (...args: unknown[]) => saveNodeVariablesMock(...args),
}));

import { maybeApplyExtraModelUpdate } from "@/lib/mvu/extra-model-runtime";
import { useModelStore } from "@/lib/store/model-store";
import { resetMvuConfigStore, useMvuConfigStore } from "@/lib/store/mvu-config-store";

describe("phase6 extra-model material baseline", () => {
  beforeEach(() => {
    resetMvuConfigStore();
    useMvuConfigStore.getState().setStrategy("extra-model");
    useModelStore.setState({
      configs: [fixture.activeConfig],
      activeConfigId: fixture.activeConfig.id,
    });

    chatMock.mockReset();
    createApiClientMock.mockReset();
    getCharacterVariablesMock.mockReset();
    saveNodeVariablesMock.mockReset();

    createApiClientMock.mockReturnValue({ chat: chatMock });
    getCharacterVariablesMock.mockResolvedValue(fixture.currentVariables);
    saveNodeVariablesMock.mockResolvedValue(true);
    chatMock.mockResolvedValue({ content: fixture.modelResponse });
  });

  it("replays a committed extra-model fixture built from current repo materials", async () => {
    const applied = await maybeApplyExtraModelUpdate({
      dialogueKey: fixture.dialogueKey,
      nodeId: fixture.nodeId,
      messageContent: fixture.messageContent,
    });

    expect(applied).toBe(true);
    expect(chatMock).toHaveBeenCalledWith(expect.objectContaining({
      model: fixture.activeConfig.model,
      messages: [
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(fixture.messageContent),
        }),
      ],
      max_tokens: fixture.activeConfig.advanced.maxTokens,
      temperature: fixture.activeConfig.advanced.temperature,
    }));
    expect(saveNodeVariablesMock).toHaveBeenCalledWith({
      dialogueKey: fixture.dialogueKey,
      nodeId: fixture.nodeId,
      variables: expect.objectContaining({
        stat_data: fixture.expectedVariables,
      }),
    });
  });
});
