import { createApiClient } from "@/lib/api/backends";
import { callGeminiOnce } from "@/lib/core/gemini-client";
import type { APIConfig } from "@/lib/model-runtime";
import { useModelStore } from "@/lib/store/model-store";
import { useMvuConfigStore } from "@/lib/store/mvu-config-store";
import { getCharacterVariables, saveNodeVariables } from "@/lib/mvu/data/persistence";
import { createExtraModelParser, type GenerateOptions } from "@/lib/mvu/extra-model";
import { stripMvuProtocolBlocks } from "@/lib/mvu/protocol";

function getActiveModelConfig(): APIConfig | undefined {
  const state = useModelStore.getState();
  return state.getActiveConfig?.() || state.configs.find((config) => config.id === state.activeConfigId);
}

function buildGenerateFn(config: APIConfig) {
  return async (prompt: string, options?: GenerateOptions): Promise<string> => {
    if (config.type === "gemini") {
      return callGeminiOnce({
        system: "",
        user: prompt,
        config: {
          apiKey: config.apiKey || "",
          model: config.model,
          baseUrl: config.baseUrl,
          temperature: options?.temperature ?? config.advanced?.temperature,
          maxTokens: options?.maxTokens ?? config.advanced?.maxTokens,
        },
      });
    }

    const client = createApiClient({
      type: config.type,
      apiKey: config.apiKey,
      apiUrl: config.baseUrl,
    });

    const response = await client.chat({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? config.advanced?.temperature,
      max_tokens: options?.maxTokens ?? config.advanced?.maxTokens,
    });

    return response.content;
  };
}

export async function maybeApplyExtraModelUpdate(params: {
  dialogueKey: string;
  nodeId: string;
  messageContent: string;
}): Promise<boolean> {
  if (useMvuConfigStore.getState().strategy !== "extra-model") {
    return false;
  }

  if (params.messageContent.includes("<UpdateVariable>")) {
    return false;
  }

  const visibleMessage = stripMvuProtocolBlocks(params.messageContent);
  if (!visibleMessage) {
    return false;
  }

  const activeConfig = getActiveModelConfig();
  if (!activeConfig) {
    return false;
  }

  const currentVariables = await getCharacterVariables({ dialogueKey: params.dialogueKey });
  if (!currentVariables) {
    return false;
  }

  const parser = createExtraModelParser(
    { source: "same", useFunctionCall: false },
    buildGenerateFn(activeConfig),
  );

  const result = await parser.parseAndUpdate({
    messageContent: visibleMessage,
    variables: structuredClone(currentVariables),
  });

  if (!result.success || !result.updatedVariables) {
    return false;
  }

  await saveNodeVariables({
    dialogueKey: params.dialogueKey,
    nodeId: params.nodeId,
    variables: result.updatedVariables,
  });

  return true;
}
