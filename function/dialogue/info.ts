import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { Character } from "@/lib/core/character";

/**
 * 获取角色对话信息
 * 
 * @param dialogueKey - 对话索引 Key（sessionId 或 characterId）
 * @param characterId - 角色 ID（用于获取角色信息）
 * @param language - 语言
 * @param username - 用户名
 */
export async function getCharacterDialogue(
  dialogueKey: string,
  characterId: string,
  language: "en" | "zh" = "zh",
  username?: string
) {
  if (!characterId) {
    throw new Error("Character ID is required");
  }

  // 使用 dialogueKey 作为对话树的索引（支持 sessionId）
  const dialogueId = dialogueKey || characterId;

  try {
    const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
    if (!characterRecord) {
      throw new Error(`Character not found: ${characterId}`);
    }
    const character = new Character(characterRecord);
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
    let processedDialogue = null;

    if (dialogueTree) {
      const currentPath = dialogueTree.current_nodeId !== "root"
        ? await LocalCharacterDialogueOperations.getDialoguePathToNode(dialogueId, dialogueTree.current_nodeId)
        : [];

      const messages = [];

      for (const node of currentPath) {
        if (node.userInput) {
          messages.push({
            id: node.nodeId,
            role: "user",
            thinkingContent: node.thinkingContent || "",
            content: node.userInput,
            parsedContent: null,
          });
        }

        if (node.assistantResponse) {
          if (node.parsedContent?.regexResult) {
            messages.push({
              id: node.nodeId,
              role: "assistant",
              thinkingContent: node.thinkingContent || "",
              content: node.parsedContent.regexResult,
              parsedContent: node.parsedContent,
            });
          }
          else {
            messages.push({
              id: node.nodeId,
              role: "assistant",
              thinkingContent: node.thinkingContent || "",
              content: node.assistantResponse,
              parsedContent: node.parsedContent,
            });
          }
        }
      }

      processedDialogue = {
        id: dialogueTree.id,
        character_id: dialogueTree.character_id,
        current_nodeId: dialogueTree.current_nodeId,
        messages,
        tree: {
          nodes: dialogueTree.nodes,
          currentNodeId: dialogueTree.current_nodeId,
        },
      };
    }

    return {
      success: true,
      character: {
        id: character.id,
        data: character.getData(language, username),
        imagePath: character.imagePath,
      },
      dialogue: processedDialogue,
    };
  } catch (error: any) {
    console.error("Failed to get character information:", error);
    throw new Error(`Failed to get character information: ${error.message}`);
  }
}
