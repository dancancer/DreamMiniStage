/**
 * @input  types/character-dialogue, hooks/useLocalStorage, lib/store/model-store, lib/model-runtime
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
import {
  DEFAULT_RESPONSE_LENGTH,
  RESPONSE_LENGTH_STORAGE_KEY,
} from "@/lib/model-capabilities";
import type { APIConfig } from "@/lib/model-runtime";
import { resolveModelAdvancedSettings } from "@/lib/model-runtime";
import { LLMConfig } from "@/types/character-dialogue";
import { useModelStore } from "@/lib/store/model-store";
import { useStorySessionSettings } from "@/lib/store/story-session-settings";
import { resolveSessionModelConfig } from "@/lib/story-agent/session";
import {
  useLocalStorageBoolean,
  useLocalStorageNumber,
  useLocalStorageString,
} from "@/hooks/useLocalStorage";

export function buildDialogueLlmConfig(activeConfig: APIConfig | undefined): LLMConfig {
  if (!activeConfig) {
    return {
      llmType: "openai",
      modelName: "",
      baseUrl: "",
      apiKey: "",
      advanced: resolveModelAdvancedSettings({}),
    };
  }

  return {
    llmType: activeConfig.type,
    modelName: activeConfig.model,
    baseUrl: activeConfig.baseUrl,
    apiKey: activeConfig.apiKey || "",
    advanced: resolveModelAdvancedSettings({ session: activeConfig.advanced }),
    instructTemplateId: activeConfig.instructTemplateId,
  };
}

export const useDialoguePreferences = () => {
  const { value: storedLanguage } = useLocalStorageString("language", "zh");
  const { value: responseLength } = useLocalStorageNumber(RESPONSE_LENGTH_STORAGE_KEY, DEFAULT_RESPONSE_LENGTH);
  const { value: fastModelEnabled } = useLocalStorageBoolean("fastModelEnabled", false);
  const configs = useModelStore((state) => state.configs);
  const activeConfigId = useModelStore((state) => state.activeConfigId);

  const language = useMemo<"en" | "zh">(
    () => (storedLanguage === "en" ? "en" : "zh"),
    [storedLanguage],
  );

  const readLlmConfig = useCallback((expectedDialogueId?: string | null): LLMConfig => {
    // 会话级模型锁定优先：当前会话若 pin 了某配置则用它，否则回落 active 配置。
    // 仅当 settings store 已加载到「正是这次派发的会话」时才采用 pin——代际守卫，避免
    // 切换会话时上一会话的慢 load 把旧 pin 泄漏到新会话。
    const state = useStorySessionSettings.getState();
    const pinnedId =
      expectedDialogueId && state.dialogueId === expectedDialogueId ? state.modelConfigId : undefined;
    const config = resolveSessionModelConfig(configs, activeConfigId, pinnedId);
    return buildDialogueLlmConfig(config);
  }, [activeConfigId, configs]);

  return { language, readLlmConfig, responseLength, fastModelEnabled };
};
