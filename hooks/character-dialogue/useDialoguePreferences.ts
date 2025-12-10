/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character Dialogue Preferences                        ║
 * ║  语言与 LLM 配置的持久化读取：统一接入 useLocalStorage                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useMemo } from "react";
import { LLMConfig, LLMType } from "@/types/character-dialogue";
import {
  useLocalStorageBoolean,
  useLocalStorageNumber,
  useLocalStorageString,
} from "@/hooks/useLocalStorage";

export const useDialoguePreferences = () => {
  const { value: storedLanguage } = useLocalStorageString("language", "zh");
  const { value: storedLlmType } = useLocalStorageString("llmType", "openai");
  const { value: openaiModel } = useLocalStorageString("openaiModel", "");
  const { value: openaiBaseUrl } = useLocalStorageString("openaiBaseUrl", "");
  const { value: openaiApiKey } = useLocalStorageString("openaiApiKey", "");
  const { value: ollamaModel } = useLocalStorageString("ollamaModel", "");
  const { value: ollamaBaseUrl } = useLocalStorageString("ollamaBaseUrl", "");
  const { value: geminiModel } = useLocalStorageString("geminiModel", "");
  const { value: geminiBaseUrl } = useLocalStorageString("geminiBaseUrl", "");
  const { value: geminiApiKey } = useLocalStorageString("geminiApiKey", "");
  const { value: responseLength } = useLocalStorageNumber("responseLength", 200);
  const { value: fastModelEnabled } = useLocalStorageBoolean("fastModelEnabled", false);

  const language = useMemo<"en" | "zh">(
    () => (storedLanguage === "en" ? "en" : "zh"),
    [storedLanguage]
  );

  const readLlmConfig = useCallback((): LLMConfig => {
    const llmType: LLMType =
      storedLlmType === "openai" || storedLlmType === "ollama" || storedLlmType === "gemini"
        ? storedLlmType
        : "openai";

    const keyMap: Record<LLMType, { modelName: string; baseUrl: string; apiKey: string }> = {
      openai: { modelName: openaiModel, baseUrl: openaiBaseUrl, apiKey: openaiApiKey },
      ollama: { modelName: ollamaModel, baseUrl: ollamaBaseUrl, apiKey: "" },
      gemini: { modelName: geminiModel, baseUrl: geminiBaseUrl, apiKey: geminiApiKey },
    };

    return {
      llmType,
      ...keyMap[llmType],
    };
  }, [
    geminiApiKey,
    geminiBaseUrl,
    geminiModel,
    ollamaBaseUrl,
    ollamaModel,
    openaiApiKey,
    openaiBaseUrl,
    openaiModel,
    storedLlmType,
  ]);

  return { language, readLlmConfig, responseLength, fastModelEnabled };
};
