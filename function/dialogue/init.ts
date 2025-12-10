import { Character } from "@/lib/core/character";
import { CharacterDialogue } from "@/lib/core/character-dialogue";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";
import { adaptText } from "@/lib/adapter/tagReplacer";
import { RegexProcessor } from "@/lib/core/regex-processor";

const DEBUG = true;
function log(tag: string, ...args: unknown[]): void {
  if (DEBUG) console.log(`[DialogueInit][${tag}]`, ...args);
}

interface InitCharacterDialogueOptions {
  username?: string;
  dialogueId?: string;  // 对话树 ID（sessionId 或 characterId）
  characterId: string;
  language?: "zh" | "en";
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType: "openai" | "ollama" | "gemini";
}

export async function initCharacterDialogue(options: InitCharacterDialogueOptions) {
  const { username, dialogueId, characterId, language = "zh", modelName, baseUrl, apiKey, llmType } = options;

  if (!characterId) {
    throw new Error("Missing required parameters");
  }

  // 使用 dialogueId（sessionId）或回退到 characterId
  const treeId = dialogueId || characterId;

  try {
    const characterRecord = await LocalCharacterRecordOperations.getCharacterById(characterId);
    if (!characterRecord) {
      throw new Error("Character not found");
    }

    const character = new Character(characterRecord);
    const dialogue = new CharacterDialogue(character);

    await dialogue.initialize({
      modelName,
      baseUrl,
      apiKey,
      llmType,
      language,
    });

    const firstAssistantMessage = await dialogue.getFirstMessage();
    let dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(treeId);

    if (!dialogueTree) {
      // 使用 treeId 创建对话树，关联 characterId
      dialogueTree = await LocalCharacterDialogueOperations.createDialogueTree(treeId, characterId);
    }

    const openingMessages: { id: string; content: string }[] = [];
    if (firstAssistantMessage) {
      const messagesToProcess = [...firstAssistantMessage];
      let firstProcessedMessage = "";

      for (let index = 0; index < messagesToProcess.length; index++) {
        const message = messagesToProcess[index];
        log("ADAPT", `处理开场白 ${index + 1}/${messagesToProcess.length}`);

        const adaptedMessage = adaptText(message, language, username);
        log("ADAPT", `adaptText 完成，长度=${adaptedMessage.length}`);

        log("REGEX", `调用 RegexProcessor...`);
        const regexResult = await RegexProcessor.processFullContext(
          adaptedMessage,
          {
            ownerId: characterId,
          },
        );
        log("REGEX", `RegexProcessor 完成，应用脚本: ${regexResult.appliedScripts.join(", ") || "(无)"}`);

        const processedMessage = regexResult.replacedText;

        // 使用 treeId 作为对话树索引
        const nodeId = await LocalCharacterDialogueOperations.addNodeToDialogueTree(
          treeId,
          "root",
          "",
          adaptedMessage,
          adaptedMessage,
          "",
          {
            nextPrompts: [],
            regexResult: processedMessage,
            compressedContent: "",
          },
          undefined,
        );

        if (index === 0) {
          firstProcessedMessage = processedMessage;
        }

        openingMessages.push({
          id: nodeId,
          content: processedMessage,
        });
      }

      const activeOpeningId = openingMessages[0]?.id || "";
      if (activeOpeningId) {
        await LocalCharacterDialogueOperations.switchBranch(treeId, activeOpeningId);
      }

      if (openingMessages.length > 0) {
        return {
          success: true,
          characterId,
          firstMessage: firstProcessedMessage,
          nodeId: activeOpeningId,
          openingMessages,
        };
      }
    }

    throw new Error("No assistant message generated");
  } catch (error: any) {
    console.error("Failed to initialize character dialogue:", error);
    throw new Error(`Failed to initialize dialogue: ${error.message}`);
  }
}
