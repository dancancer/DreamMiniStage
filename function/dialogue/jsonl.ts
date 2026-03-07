/**
 * @input  lib/data/roleplay/character-dialogue-operation, utils/username-helper, lib/dialogue/jsonl
 * @output exportDialogueJsonl, importDialogueJsonl
 * @pos    JSONL 格式导入导出 - 对话树的 JSONL 格式转换
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { getDisplayUsername } from "@/utils/username-helper";
import { exportDialogueTreeToJsonl, importJsonlToDialogueTree } from "@/lib/dialogue/jsonl";
import { getDialogueChatMetadata } from "@/lib/dialogue/chat-metadata";

export async function exportDialogueJsonl(options: {
  dialogueId: string;
  characterName?: string;
}) {
  const { dialogueId, characterName } = options;

  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (!tree) {
    throw new Error("Dialogue not found");
  }

  const userName = getDisplayUsername();
  const chatMetadata = getDialogueChatMetadata(tree);
  return exportDialogueTreeToJsonl(tree, {
    userName,
    characterName,
    chatMetadata: Object.keys(chatMetadata).length > 0 ? chatMetadata : undefined,
  });
}

export async function importDialogueJsonl(options: {
  dialogueId: string;
  characterId: string;
  jsonlText: string;
}) {
  const { dialogueId, characterId, jsonlText } = options;

  const { tree } = importJsonlToDialogueTree(jsonlText, { dialogueId, characterId });
  const existing = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);

  if (!existing) {
    await LocalCharacterDialogueOperations.createDialogueTree(dialogueId, characterId);
  }

  await LocalCharacterDialogueOperations.updateDialogueTree(dialogueId, tree);
  return tree;
}

