import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { ParsedResponse } from "@/lib/models/parsed-response";
import { DialogueWorkflow, DialogueWorkflowParams } from "@/lib/workflow/examples/DialogueWorkflow";
import { getCurrentSystemPresetType } from "@/function/preset/download";
import { getVectorMemoryManager } from "@/lib/vector-memory/manager";
import { prepareOpeningGreeting, type OpeningPayload } from "@/function/dialogue/opening";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                  Dialogue Workflow Result Interface                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
interface DialogueWorkflowResult {
  outputData: {
    thinkingContent?: string;
    screenContent: string;
    fullResponse: string;
    nextPrompts?: string[];
    event?: unknown;
  };
}

/**
 * 类型守卫：检查 workflow 结果是否符合预期结构
 */
function isDialogueWorkflowResult(result: unknown): result is DialogueWorkflowResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "outputData" in result &&
    typeof (result as DialogueWorkflowResult).outputData === "object" &&
    (result as DialogueWorkflowResult).outputData !== null
  );
}

export async function handleCharacterChatRequest(payload: {
  username?: string;
  dialogueId: string;  // 对话树 ID（sessionId）
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
  openingMessage?: OpeningPayload;
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
      openingMessage,
    } = payload;

    if (!dialogueId || !characterId || !message) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), { status: 400 });
    }

    try {
      await ensureDialogueTreeWithOpening({
        dialogueId,
        characterId,
        language,
        username,
        openingMessage,
      });

      const workflow = new DialogueWorkflow();
      const workflowParams: DialogueWorkflowParams = {
        dialogueKey: dialogueId,  // 会话隔离：使用 sessionId
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

      // ═══════════════════════════════════════════════════════════════════════════
      // 类型守卫：确保 workflow 返回符合预期的结构
      // ═══════════════════════════════════════════════════════════════════════════
      if (!isDialogueWorkflowResult(workflowResult)) {
        throw new Error("No response returned from workflow");
      }

      const {
        thinkingContent,
        screenContent,
        fullResponse,
        nextPrompts,
        event,
      } = workflowResult.outputData;

      // ═══════════════════════════════════════════════════════════════════════════
      // 后处理：提供默认值以满足下游函数的类型要求
      // ═══════════════════════════════════════════════════════════════════════════
      await processPostResponseAsync({
        dialogueId,
        message,
        thinkingContent: thinkingContent ?? "",
        fullResponse,
        screenContent,
        event: typeof event === "string" ? event : "",
        nextPrompts: nextPrompts ?? [],
        nodeId
      })
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

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Processing error:", error);
      return new Response(JSON.stringify({
        type: "error",
        message: errorMessage,
        success: false,
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: `Failed to process request: ${errorMessage}`, success: false }), { 
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

async function ensureDialogueTreeWithOpening(params: {
  dialogueId: string;
  characterId: string;
  language: "zh" | "en";
  username?: string;
  openingMessage?: OpeningPayload;
}) {
  const { dialogueId, characterId, language, username, openingMessage } = params;
  const existingTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);
  if (existingTree) return;

  await LocalCharacterDialogueOperations.createDialogueTree(dialogueId, characterId);
  const opening = openingMessage || await prepareOpeningGreeting({
    dialogueId,
    characterId,
    language,
    username,
  });

  const parsedOpening: ParsedResponse = {
    regexResult: opening.content,
    nextPrompts: [],
  };

  await LocalCharacterDialogueOperations.addNodeToDialogueTree(
    dialogueId,
    "root",
    "",
    opening.content,
    opening.fullContent,
    "",
    parsedOpening,
    opening.id,
  );
}

async function processPostResponseAsync({
  dialogueId,
  message,
  thinkingContent,
  fullResponse,
  screenContent,
  event,
  nextPrompts,
  nodeId,
}: {
  dialogueId: string;  // 对话树 ID（sessionId）
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
      fullResponse,      // 存储原始响应，正则处理后的内容在 parsed.regexResult 中
      fullResponse,
      thinkingContent,
      parsed,
      nodeId,
    );

    // 向量记忆异步写入，不阻塞主流程
    const vectorManager = getVectorMemoryManager();
    const now = Date.now();
    vectorManager.ingest(dialogueId, [
      {
        id: `user_${nodeId}`,
        role: "user",
        source: "user_message",
        content: message,
        createdAt: now,
      },
      {
        id: `assistant_${nodeId}`,
        role: "assistant",
        source: "assistant_response",
        content: screenContent || fullResponse,
        createdAt: now,
      },
    ]).catch((error) => console.warn("[VectorMemory] ingest failed:", error));

    // 处理 MVU 变量更新：仅使用 dialogueId 会话作用域
    const { processMessageVariables } = await import("@/lib/mvu");
    await processMessageVariables({
      dialogueKey: dialogueId,
      nodeId,
      messageContent: fullResponse,
    });

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
