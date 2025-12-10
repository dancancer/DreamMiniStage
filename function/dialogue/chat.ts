import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { DialogueWorkflow, DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import { getCurrentSystemPresetType } from "@/function/preset/download";

export async function handleCharacterChatRequest(payload: {
  username?: string;
  dialogueId?: string;  // 对话树 ID（sessionId 或 characterId）
  characterId: string;
  message: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  llmType?: "openai" | "ollama" | "gemini";
  streaming?: boolean;
  language?: "zh" | "en";
  number?: number;
  nodeId: string;
  fastModel: boolean;
}): Promise<Response> {
  try {
    const {
      username,
      dialogueId,
      characterId,
      message,
      modelName,
      baseUrl,
      apiKey,
      llmType = "openai",
      language = "zh",
      number = 200,
      nodeId,
      fastModel = false,
      streaming = false,
    } = payload;

    // 使用 dialogueId（sessionId）或回退到 characterId
    const treeId = dialogueId || characterId;

    if (!characterId || !message) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400 });
    }

    try {
      const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(treeId);
      if (!existingTree) {
        await LocalCharacterDialogueOperations.createDialogueTree(treeId, characterId);
      }

      const workflow = new DialogueWorkflow();
      const workflowParams: DialogueWorkflowParams = {
        characterId,
        userInput: message,
        language,
        username,
        modelName,
        apiKey,
        baseUrl,
        llmType: llmType as "openai" | "ollama" | "gemini",
        temperature: 0.7,
        streaming,
        streamUsage: true, // 确保token usage追踪
        number,
        fastModel,  
        systemPresetType: getCurrentSystemPresetType(),
      };
      const workflowResult = await workflow.execute(workflowParams);
      
      if (!workflowResult || !workflowResult.outputData) {
        throw new Error("No response returned from workflow");
      }

      const {
        thinkingContent,
        screenContent,
        fullResponse,
        nextPrompts,
        event,
      } = workflowResult.outputData;

      await processPostResponseAsync({ dialogueId: treeId, characterId, message, thinkingContent, fullResponse, screenContent, event, nextPrompts, nodeId })
        .catch((e) => console.error("Post-processing error:", e));

      return new Response(JSON.stringify({
        type: "complete",
        success: true,
        thinkingContent,
        content: screenContent,
        parsedContent: { nextPrompts },
        isRegexProcessed: true,
      }), {
        headers: {
          "Content-Type": "application/json",
        },
      });

    } catch (error: any) {
      console.error("Processing error:", error);
      return new Response(JSON.stringify({
        type: "error",
        message: error.message || "Unknown error",
        success: false,
      }), { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: `Failed to process request: ${error.message}`, success: false }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

async function processPostResponseAsync({
  dialogueId,
  characterId,
  message,
  thinkingContent,
  fullResponse,
  screenContent,
  event,
  nextPrompts,
  nodeId,
}: {
  dialogueId: string;  // 对话树 ID（sessionId 或 characterId）
  characterId: string;
  message: string;
  thinkingContent: string;
  fullResponse: string;
  screenContent: string;
  event: string;
  nextPrompts: string[];
  nodeId: string;
}) {
  try {
    const parsed: ParsedResponse = {
      regexResult: screenContent,
      nextPrompts,
    };

    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
    const parentNodeId = dialogueTree ? dialogueTree.current_nodeId : "root";

    await LocalCharacterDialogueOperations.addNodeToDialogueTree(
      dialogueId,
      parentNodeId,
      message,
      screenContent,
      fullResponse,
      thinkingContent,
      parsed,
      nodeId,
    );

    // 处理 MVU 变量更新（仍使用 characterId 作为 ownerId）
    const { processMessageVariables } = await import("@/lib/mvu");
    await processMessageVariables(characterId, nodeId, fullResponse);

    if (event) {
      await LocalCharacterDialogueOperations.updateNodeInDialogueTree(
        dialogueId,
        nodeId,
        {
          parsedContent: {
            ...parsed,
            compressedContent: event,
          },
        },
      );
    }
  } catch (e) {
    console.error("Error in processPostResponseAsync:", e);
  }
}
