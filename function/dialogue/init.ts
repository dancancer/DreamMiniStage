/**
 * @input  function/dialogue/opening
 * @output initCharacterDialogue
 * @pos    对话初始化 - 创建新对话并获取开场白
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { prepareOpeningGreeting } from "@/function/dialogue/opening";

interface InitCharacterDialogueOptions {
  username?: string;
  dialogueId: string;  // 对话树 ID（sessionId）
  characterId: string;
  language?: "zh" | "en";
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
}

export async function initCharacterDialogue(options: InitCharacterDialogueOptions) {
  const { username, dialogueId, characterId, language = "zh" } = options;

  if (!dialogueId || !characterId) {
    throw new Error("Missing required parameters");
  }

  try {
    const opening = await prepareOpeningGreeting({
      dialogueId,
      characterId,
      language,
      username,
    });

    return {
      success: true,
      characterId,
      firstMessage: opening.content,
      openingMessage: opening,
      openingMessages: [
        {
          id: opening.id,
          content: opening.content,
          fullContent: opening.fullContent,
        },
      ],
    };
  } catch (error) {
    console.error("Failed to initialize character dialogue:", error);
    throw new Error(`Failed to initialize dialogue: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
