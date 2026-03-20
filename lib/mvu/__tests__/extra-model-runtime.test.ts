import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("maybeApplyExtraModelUpdate", () => {
  beforeEach(() => {
    resetMvuConfigStore();
    useModelStore.setState({
      configs: [{
        id: "cfg-1",
        name: "Config",
        type: "openai",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-4o-mini",
        apiKey: "key",
        advanced: {},
      }],
      activeConfigId: "cfg-1",
    });

    chatMock.mockReset();
    createApiClientMock.mockReset();
    getCharacterVariablesMock.mockReset();
    saveNodeVariablesMock.mockReset();

    createApiClientMock.mockReturnValue({
      chat: chatMock,
    });
    getCharacterVariablesMock.mockResolvedValue({
      stat_data: { hp: 1 },
      display_data: {},
      delta_data: {},
    });
    saveNodeVariablesMock.mockResolvedValue(true);
  });

  it("does nothing when the selected strategy is not extra-model", async () => {
    const applied = await maybeApplyExtraModelUpdate({
      dialogueKey: "dialogue-1",
      nodeId: "node-1",
      messageContent: "Visible reply",
    });

    expect(applied).toBe(false);
    expect(chatMock).not.toHaveBeenCalled();
    expect(saveNodeVariablesMock).not.toHaveBeenCalled();
  });

  it("persists updated variables when extra-model strategy is selected", async () => {
    useMvuConfigStore.getState().setStrategy("extra-model");
    chatMock.mockResolvedValue({
      content: "<UpdateVariable>_.set('hp', 3);</UpdateVariable>",
    });

    const applied = await maybeApplyExtraModelUpdate({
      dialogueKey: "dialogue-1",
      nodeId: "node-1",
      messageContent: "Visible reply",
    });

    expect(applied).toBe(true);
    expect(saveNodeVariablesMock).toHaveBeenCalledWith({
      dialogueKey: "dialogue-1",
      nodeId: "node-1",
      variables: expect.objectContaining({
        stat_data: {
          hp: 3,
        },
      }),
    });
  });
});
