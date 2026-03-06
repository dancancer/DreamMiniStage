/**
 * @input  lib/models/node-model, lib/models/parsed-response, utils/message-id, lib/dialogue/swipe-variants
 * @output ProcessedDialogueMessage, ProcessedDialogue, buildProcessedDialogue
 * @pos    对话处理 - 将对话树转换为前端可用的消息列表
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import type { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import type { ParsedResponse } from "@/lib/models/parsed-response";
import { generateMessageId } from "@/utils/message-id";
import { getSwipeInfo } from "@/lib/dialogue/swipe-variants";

export interface ProcessedDialogueMessage {
  id: string;
  role: "user" | "assistant";
  thinkingContent: string;
  content: string;
  hidden?: boolean;
  parsedContent: ParsedResponse | null;
  swipe?: { activeIndex: number; total: number };
}

export interface ProcessedDialogue {
  id: string;
  character_id: string;
  current_nodeId: string;
  messages: ProcessedDialogueMessage[];
  tree: {
    nodes: DialogueNode[];
    currentNodeId: string;
  };
}

export function buildProcessedDialogue(dialogueTree: DialogueTree): ProcessedDialogue {
  const currentPath =
    dialogueTree.current_nodeId !== "root"
      ? getDialoguePathToNode(dialogueTree, dialogueTree.current_nodeId)
      : [];

  const messages: ProcessedDialogueMessage[] = [];
  for (const node of currentPath) {
    const hidden = Boolean(node.extra?.hidden);
    if (node.userInput) {
      messages.push({
        id: generateMessageId({ nodeId: node.nodeId, role: "user" }),
        role: "user",
        thinkingContent: node.thinkingContent || "",
        content: node.userInput,
        hidden,
        parsedContent: null,
      });
    }

    if (node.assistantResponse) {
      const swipe = getSwipeInfo(dialogueTree, node.nodeId);
      messages.push({
        id: generateMessageId({ nodeId: node.nodeId, role: "assistant" }),
        role: "assistant",
        thinkingContent: node.thinkingContent || "",
        content: node.parsedContent?.regexResult || node.assistantResponse,
        hidden,
        parsedContent: node.parsedContent || null,
        ...(swipe ? { swipe } : {}),
      });
    }
  }

  return {
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

function getDialoguePathToNode(dialogueTree: DialogueTree, nodeId: string): DialogueNode[] {
  const path: DialogueNode[] = [];
  const nodeById = new Map(dialogueTree.nodes.map((node) => [node.nodeId, node]));

  let currentNode = nodeById.get(nodeId);
  while (currentNode) {
    path.unshift(currentNode);
    if (currentNode.nodeId === "root") break;
    currentNode = nodeById.get(currentNode.parentNodeId);
  }

  return path;
}
