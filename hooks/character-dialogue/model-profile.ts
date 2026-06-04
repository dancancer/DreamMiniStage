/**
 * @input  types/character-dialogue
 * @output DialogueGenerationProfile, buildDialogueModelProfile
 * @pos    对话模型 Profile - 将模型配置、语言、输出长度和快模型模式收束为生成 Profile
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Dialogue Model Profile                              ║
 * ║  调用者只读取一个生成 Profile，具体模型字段留在这个 Module 内部整理             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { DialogueGenerationProfile, LLMConfig } from "@/types/character-dialogue";

interface BuildDialogueModelProfileInput {
  language: "zh" | "en";
  llmConfig: LLMConfig;
  responseLength: number;
  fastModelEnabled: boolean;
}

export function buildDialogueModelProfile(input: BuildDialogueModelProfileInput): DialogueGenerationProfile {
  const { language, llmConfig, responseLength, fastModelEnabled } = input;
  const { llmType, modelName, baseUrl, apiKey, advanced } = llmConfig;

  return {
    language,
    modelName,
    baseUrl,
    apiKey,
    llmType,
    advanced,
    responseLength,
    fastModel: fastModelEnabled,
  };
}
