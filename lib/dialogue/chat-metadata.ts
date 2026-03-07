import { DialogueNode, DialogueTree } from "@/lib/models/node-model";

export type DialogueChatMetadata = Record<string, unknown>;

const ROOT_NODE_ID = "root";

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function ensureDialogueRootNode(tree: DialogueTree): DialogueNode {
  const existing = tree.nodes.find((node) => node.nodeId === ROOT_NODE_ID);
  if (existing) {
    return existing;
  }

  const rootNode = new DialogueNode(ROOT_NODE_ID, ROOT_NODE_ID, "", "", "", "", undefined, {});
  tree.nodes.unshift(rootNode);
  if (!tree.current_nodeId) {
    tree.current_nodeId = ROOT_NODE_ID;
  }
  return rootNode;
}

export function getDialogueChatMetadata(tree: DialogueTree): DialogueChatMetadata {
  const rootNode = tree.nodes.find((node) => node.nodeId === ROOT_NODE_ID);
  if (!rootNode?.extra) {
    return {};
  }

  const direct = toRecord(rootNode.extra.chat_metadata);
  if (Object.keys(direct).length > 0) {
    return { ...direct };
  }

  const jsonlMetadata = toRecord(rootNode.extra.jsonl_metadata);
  const fallback = toRecord(jsonlMetadata.chat_metadata);
  if (Object.keys(fallback).length > 0) {
    return { ...fallback };
  }

  return {};
}

export function setDialogueChatMetadata(tree: DialogueTree, metadata: DialogueChatMetadata): DialogueTree {
  const rootNode = ensureDialogueRootNode(tree);
  const nextMetadata = { ...metadata };
  const extra = toRecord(rootNode.extra);
  const jsonlMetadata = toRecord(extra.jsonl_metadata);

  rootNode.extra = {
    ...extra,
    chat_metadata: nextMetadata,
    ...(Object.keys(jsonlMetadata).length > 0
      ? {
        jsonl_metadata: {
          ...jsonlMetadata,
          chat_metadata: nextMetadata,
        },
      }
      : {}),
  };

  return tree;
}
