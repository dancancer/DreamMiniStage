/**
 * @input  utils/message-id, lib/models/node-model, types/character-dialogue
 * @output buildDialogueTreeSnapshot
 * @pos    /session 对话树快照构建
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Dialogue Tree                               ║
 * ║                                                                           ║
 * ║  把扁平消息列表收口为对话树快照，供 /save、checkpoint 等路径复用。            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import type { DialogueMessage } from "@/types/character-dialogue";
import { extractNodeIdFromMessageId } from "@/utils/message-id";

export function buildDialogueTreeSnapshot(
  dialogueId: string,
  characterId: string,
  messages: DialogueMessage[],
  existingTree: DialogueTree | null,
): DialogueTree {
  if (messages.length === 0) {
    return existingTree || new DialogueTree(dialogueId, characterId, [], "root");
  }

  const existingById = new Map((existingTree?.nodes || []).map((node) => [node.nodeId, node]));
  const orderedNodeIds: string[] = [];
  const grouped = new Map<string, {
    userInput: string;
    assistantResponse: string;
    thinkingContent: string;
    hidden: boolean;
  }>();

  for (const message of messages) {
    const nodeId = extractNodeIdFromMessageId(message.id);
    if (!grouped.has(nodeId)) {
      grouped.set(nodeId, {
        userInput: "",
        assistantResponse: "",
        thinkingContent: "",
        hidden: false,
      });
      orderedNodeIds.push(nodeId);
    }

    const entry = grouped.get(nodeId)!;
    if (message.role === "user") {
      entry.userInput = message.content;
    }
    if (message.role === "assistant") {
      entry.assistantResponse = message.content;
      entry.thinkingContent = message.thinkingContent || entry.thinkingContent;
    }
    entry.hidden = entry.hidden || Boolean(message.hidden);
  }

  const pathNodes = orderedNodeIds.map((nodeId, index) => {
    const snapshot = grouped.get(nodeId)!;
    const existingNode = existingById.get(nodeId);
    const extra = { ...(existingNode?.extra || {}) };

    if (snapshot.hidden) {
      extra.hidden = true;
    } else {
      delete extra.hidden;
    }

    return new DialogueNode(
      nodeId,
      index === 0 ? "root" : orderedNodeIds[index - 1],
      snapshot.userInput || existingNode?.userInput || "",
      snapshot.assistantResponse || existingNode?.assistantResponse || "",
      snapshot.assistantResponse || existingNode?.fullResponse || "",
      snapshot.thinkingContent || existingNode?.thinkingContent,
      existingNode?.parsedContent,
      Object.keys(extra).length > 0 ? extra : undefined,
    );
  });

  const pathSet = new Set(orderedNodeIds);
  const otherNodes = (existingTree?.nodes || []).filter((node) => !pathSet.has(node.nodeId));

  return new DialogueTree(
    dialogueId,
    characterId,
    [...otherNodes, ...pathNodes],
    orderedNodeIds[orderedNodeIds.length - 1] || "root",
  );
}
