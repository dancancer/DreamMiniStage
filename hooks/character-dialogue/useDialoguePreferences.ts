/**
 * @input  types/character-dialogue, hooks/useLocalStorage, lib/store/model-store
 * @output useDialoguePreferences
 * @pos    对话偏好设置 - 语言与 LLM 配置的持久化读取
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Character Dialogue Preferences                        ║
 * ║  语言与 LLM 配置的持久化读取：模型参数统一来自 model-store 单一状态源          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useCallback, useMemo } from "react";
import { LLMConfig } from "@/types/character-dialogue";
import { useModelStore } from "@/lib/store/model-store";
import {
  useLocalStorageBoolean,
  useLocalStorageNumber,
  useLocalStorageString,
} from "@/hooks/useLocalStorage";

export const useDialoguePreferences = () => {
  const { value: storedLanguage } = useLocalStorageString("language", "zh");
  const { value: responseLength } = useLocalStorageNumber("responseLength", 200);
  const { value: fastModelEnabled } = useLocalStorageBoolean("fastModelEnabled", false);
  const configs = useModelStore((state) => state.configs);
  const activeConfigId = useModelStore((state) => state.activeConfigId);

  const language = useMemo<"en" | "zh">(
    () => (storedLanguage === "en" ? "en" : "zh"),
    [storedLanguage],
  );

  const readLlmConfig = useCallback((): LLMConfig => {
    const activeConfig = configs.find((config) => config.id === activeConfigId);

    if (!activeConfig) {
      return {
        llmType: "openai",
        modelName: "",
        baseUrl: "",
        apiKey: "",
        advanced: {},
      };
    }

    return {
      llmType: activeConfig.type,
      modelName: activeConfig.model,
      baseUrl: activeConfig.baseUrl,
      apiKey: activeConfig.apiKey || "",
      advanced: activeConfig.advanced || {},
    };
  }, [activeConfigId, configs]);

  return { language, readLlmConfig, responseLength, fastModelEnabled };
};
