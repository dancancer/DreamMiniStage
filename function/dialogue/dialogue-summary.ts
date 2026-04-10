import { DEFAULT_SUMMARIZE_CONFIG } from "@/lib/extensions/summarize";
import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import type { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import { getJSON, removeItem, setJSON } from "@/lib/storage/client-storage";

export interface DialogueSummaryConfig {
  triggerThreshold: number;
  preserveRecentMessages: number;
  maxSummaryLength: number;
}

export interface DialogueSummaryState {
  content: string;
  includedNodeIds: string[];
  currentNodeId: string;
  messageCount: number;
  source: "turn-summary" | "fallback" | "mixed";
  updatedAt: number;
}

interface SummaryMessage {
  role: "user" | "assistant";
  content: string;
  nodeId: string;
}

const STORAGE_PREFIX = "dreamministage.dialogue-summary:";

export const DEFAULT_DIALOGUE_SUMMARY_CONFIG: DialogueSummaryConfig = {
  triggerThreshold: DEFAULT_SUMMARIZE_CONFIG.triggerThreshold,
  preserveRecentMessages: DEFAULT_SUMMARIZE_CONFIG.preserveRecentMessages,
  maxSummaryLength: DEFAULT_SUMMARIZE_CONFIG.maxSummaryLength,
};

export function getDialogueSummaryStorageKey(dialogueKey: string): string {
  return `${STORAGE_PREFIX}${dialogueKey}`;
}

function getDialoguePathNodes(dialogueTree: DialogueTree): DialogueNode[] {
  if (dialogueTree.current_nodeId === "root") {
    return [];
  }

  const path: DialogueNode[] = [];
  const nodeById = new Map(dialogueTree.nodes.map((node) => [node.nodeId, node]));

  let currentNode = nodeById.get(dialogueTree.current_nodeId);
  while (currentNode) {
    path.unshift(currentNode);
    if (currentNode.nodeId === "root") {
      break;
    }
    currentNode = nodeById.get(currentNode.parentNodeId);
  }

  return path.filter((node) => node.nodeId !== "root");
}

function flattenPathMessages(nodes: readonly DialogueNode[]): SummaryMessage[] {
  const messages: SummaryMessage[] = [];

  for (const node of nodes) {
    if (node.userInput) {
      messages.push({
        role: "user",
        content: node.userInput,
        nodeId: node.nodeId,
      });
    }

    if (node.assistantResponse) {
      messages.push({
        role: "assistant",
        content: node.parsedContent?.regexResult || node.assistantResponse,
        nodeId: node.nodeId,
      });
    }
  }

  return messages;
}

function collectSummaryNodeIds(
  messages: readonly SummaryMessage[],
  preserveRecentMessages: number,
): string[] {
  const cutoff = Math.max(messages.length - preserveRecentMessages, 0);
  const nodeIds = new Set<string>();

  for (let index = 0; index < cutoff; index += 1) {
    nodeIds.add(messages[index].nodeId);
  }

  return [...nodeIds];
}

function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 1))}…`;
}

function buildFallbackEntry(node: DialogueNode): string {
  const segments: string[] = [];

  if (node.userInput.trim()) {
    segments.push(`用户：${compactText(node.userInput, 40)}`);
  }

  const assistantContent = (node.parsedContent?.regexResult || node.assistantResponse || "").trim();
  if (assistantContent) {
    segments.push(`角色：${compactText(assistantContent, 60)}`);
  }

  return segments.join("；");
}

function mergeEntries(entries: string[], maxSummaryLength: number): string {
  let content = "";

  for (const entry of entries) {
    const line = `- ${entry}`;
    if (!content) {
      content = line.length <= maxSummaryLength
        ? line
        : compactText(line, maxSummaryLength);
      continue;
    }

    const candidate = `${content}\n${line}`;
    if (candidate.length > maxSummaryLength) {
      break;
    }
    content = candidate;
  }

  return content.trim();
}

function detectSummarySource(
  entries: Array<{ usedCompressed: boolean }>,
): DialogueSummaryState["source"] {
  if (entries.length > 0 && entries.every((entry) => entry.usedCompressed)) {
    return "turn-summary";
  }

  if (entries.some((entry) => entry.usedCompressed)) {
    return "mixed";
  }

  return "fallback";
}

export function buildDialogueSummaryState(
  dialogueTree: DialogueTree,
  config: Partial<DialogueSummaryConfig> = {},
): DialogueSummaryState | null {
  const effectiveConfig: DialogueSummaryConfig = {
    ...DEFAULT_DIALOGUE_SUMMARY_CONFIG,
    ...config,
  };
  const pathNodes = getDialoguePathNodes(dialogueTree);
  const pathMessages = flattenPathMessages(pathNodes);

  if (pathMessages.length < effectiveConfig.triggerThreshold) {
    return null;
  }

  const includedNodeIds = collectSummaryNodeIds(
    pathMessages,
    effectiveConfig.preserveRecentMessages,
  );
  if (includedNodeIds.length === 0) {
    return null;
  }

  const summarizedNodes = pathNodes.filter((node) => includedNodeIds.includes(node.nodeId));
  const summaryEntries = summarizedNodes
    .map((node) => {
      const compressed = node.parsedContent?.compressedContent?.trim();
      return {
        content: compressed || buildFallbackEntry(node),
        usedCompressed: Boolean(compressed),
      };
    })
    .filter((entry) => entry.content.length > 0);

  if (summaryEntries.length === 0) {
    return null;
  }

  const content = mergeEntries(
    summaryEntries.map((entry) => entry.content),
    effectiveConfig.maxSummaryLength,
  );
  if (!content) {
    return null;
  }

  return {
    content,
    includedNodeIds,
    currentNodeId: dialogueTree.current_nodeId,
    messageCount: pathMessages.length,
    source: detectSummarySource(summaryEntries),
    updatedAt: Date.now(),
  };
}

export function readDialogueSummaryState(dialogueKey: string): DialogueSummaryState | null {
  return getJSON<DialogueSummaryState | null>(
    getDialogueSummaryStorageKey(dialogueKey),
    null,
  );
}

export function writeDialogueSummaryState(
  dialogueKey: string,
  state: DialogueSummaryState | null,
): boolean {
  if (!state) {
    removeItem(getDialogueSummaryStorageKey(dialogueKey));
    return true;
  }

  return setJSON(getDialogueSummaryStorageKey(dialogueKey), state);
}

export async function syncDialogueSummaryState(
  dialogueKey: string,
  config: Partial<DialogueSummaryConfig> = {},
): Promise<DialogueSummaryState | null> {
  if (!dialogueKey) {
    return null;
  }

  if (typeof indexedDB === "undefined") {
    return null;
  }

  try {
    const dialogueTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
    if (!dialogueTree) {
      writeDialogueSummaryState(dialogueKey, null);
      return null;
    }

    const state = buildDialogueSummaryState(dialogueTree, config);
    writeDialogueSummaryState(dialogueKey, state);
    return state;
  } catch (error) {
    console.warn("[DialogueSummary] sync failed, skip injection:", error);
    return null;
  }
}

export async function getDialogueSummaryInjectionContent(
  dialogueKey: string,
  config: Partial<DialogueSummaryConfig> = {},
): Promise<string> {
  const state = await syncDialogueSummaryState(dialogueKey, config);
  return state ? `[Story Summary]\n${state.content}` : "";
}
