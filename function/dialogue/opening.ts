/**
 * @input  lib/core/character, lib/adapter/tagReplacer, lib/data/roleplay/character-record-operation, lib/core/regex-processor
 * @output OpeningPayload, prepareOpeningGreeting
 * @pos    开场白准备 - 获取并处理角色首条消息
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { Character } from "@/lib/core/character";
import { adaptText } from "@/lib/adapter/tagReplacer";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { RegexProcessor } from "@/lib/core/regex-processor";
import { getCurrentSystemPresetType } from "@/function/preset/download";

export interface OpeningPayload {
  id: string;
  content: string;
  fullContent: string;
}

export async function prepareOpeningGreeting(params: {
  dialogueId: string;
  characterId: string;
  language?: "zh" | "en";
  username?: string;
}): Promise<OpeningPayload> {
  const { dialogueId, characterId, language = "zh", username } = params;
  const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
  if (!characterRecord) {
    throw new Error("Character not found");
  }

  const character = new Character(characterRecord);
  const greetings = await character.getFirstMessage();
  const seedGreeting = greetings[0] || `你好，我是${character.characterData.name || characterId}。`;
  const adaptedGreeting = adaptText(seedGreeting, language, username);

  const presetId = getCurrentSystemPresetType();
  const regexResult = await RegexProcessor.processFullContext(adaptedGreeting, {
    ownerId: characterId,
    isMarkdown: true,
    presetSource: presetId
      ? { ownerId: presetId, presetName: presetId }
      : undefined,
  });
  const screenContent = regexResult.replacedText || adaptedGreeting;

  return {
    id: `${dialogueId}-opening`,
    content: screenContent,
    fullContent: adaptedGreeting,
  };
}
