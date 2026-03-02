import { v4 as uuidv4 } from "uuid";
import type { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import type { ParsedResponse } from "@/lib/models/parsed-response";
import { getSwipeSiblings } from "@/lib/dialogue/swipe-variants";

export interface JsonlExportOptions {
  userName?: string;
  characterName?: string;
  chatMetadata?: Record<string, unknown>;
}

export interface JsonlImportOptions {
  dialogueId: string;
  characterId: string;
  generateId?: () => string;
}

type JsonlLine = Record<string, unknown>;

type JsonlMessageLine = {
  is_user?: boolean;
  is_system?: boolean;
  mes?: unknown;
  swipes?: unknown;
  swipe_id?: unknown;
  [key: string]: unknown;
};

export function exportDialogueTreeToJsonl(tree: DialogueTree, options: JsonlExportOptions = {}): string {
  const header: JsonlLine = {
    user_name: options.userName ?? "",
    character_name: options.characterName ?? "",
    ...(options.chatMetadata ? { chat_metadata: options.chatMetadata } : {}),
  };

  const lines: string[] = [JSON.stringify(header)];
  const path = getDialoguePathToNode(tree, tree.current_nodeId);

  for (const node of path) {
    if (!node.userInput && !node.assistantResponse) continue;

    if (node.userInput) {
      lines.push(
        JSON.stringify({
          is_user: true,
          is_system: false,
          mes: node.userInput,
        }),
      );
    }

    if (node.assistantResponse) {
      const siblings = getSwipeSiblings(tree, node.nodeId);
      const swipes = (siblings.length > 0 ? siblings : [node]).map(getNodeDisplayContent);
      const swipeId = siblings.length > 0 ? siblings.findIndex((item) => item.nodeId === node.nodeId) : 0;

      lines.push(
        JSON.stringify({
          is_user: false,
          is_system: false,
          mes: getNodeDisplayContent(node),
          ...(swipes.length > 1 ? { swipes, swipe_id: swipeId } : {}),
        }),
      );
    }
  }

  return lines.join("\n");
}

export function importJsonlToDialogueTree(
  jsonlText: string,
  options: JsonlImportOptions,
): { tree: DialogueTree; metadata: JsonlLine | null } {
  const generateId = options.generateId ?? uuidv4;
  const { dialogueId, characterId } = options;

  const rawLines = jsonlText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    throw new Error("Empty JSONL");
  }

  const parsedLines = rawLines.map((line) => JSON.parse(line) as JsonlLine);
  const metadata = parsedLines[0] ?? null;
  const messageLines = parsedLines.slice(1) as JsonlMessageLine[];

  const nodes: DialogueNode[] = [];
  nodes.push(makeRootNode(metadata));

  let parentNodeId = "root";
  let pendingUserInput: string | null = null;

  for (const message of messageLines) {
    const isUser = Boolean(message.is_user);
    const text = normalizeMes(message.mes);
    const extra = extractExtraFields(message);

    if (isUser) {
      pendingUserInput = text;
      continue;
    }

    const swipes = normalizeSwipes(message, text);
    const swipeId = clampSwipeId(message.swipe_id, swipes.length);

    const userInput = pendingUserInput ?? "";
    const createdIds: string[] = [];

    for (const swipeText of swipes) {
      const nodeId = generateId();
      createdIds.push(nodeId);
      nodes.push(makeTurnNode({ nodeId, parentNodeId, userInput, assistant: swipeText, extra }));
    }

    const selectedNodeId = createdIds[swipeId] ?? createdIds[0];
    parentNodeId = selectedNodeId ?? parentNodeId;
    pendingUserInput = null;
  }

  const tree: DialogueTree = {
    id: dialogueId,
    character_id: characterId,
    current_nodeId: parentNodeId,
    nodes,
  };

  return { tree, metadata };
}

function getDialoguePathToNode(tree: DialogueTree, nodeId: string): DialogueNode[] {
  if (!nodeId || nodeId === "root") return [];

  const path: DialogueNode[] = [];
  const nodeById = new Map(tree.nodes.map((node) => [node.nodeId, node]));
  let current: DialogueNode | undefined = nodeById.get(nodeId);

  while (current) {
    path.unshift(current);
    if (current.nodeId === "root") break;
    current = nodeById.get(current.parentNodeId);
  }

  return path;
}

function getNodeDisplayContent(node: DialogueNode): string {
  return node.parsedContent?.regexResult || node.assistantResponse || "";
}

function normalizeMes(mes: unknown): string {
  if (typeof mes === "string") return mes;
  if (mes === null || mes === undefined) return "";
  return String(mes);
}

function normalizeSwipes(message: JsonlMessageLine, fallback: string): string[] {
  if (Array.isArray(message.swipes)) {
    const swipes = message.swipes.map((item) => normalizeMes(item)).filter((item) => item.length > 0);
    if (swipes.length > 0) return swipes;
  }
  return fallback.length > 0 ? [fallback] : [""];
}

function clampSwipeId(swipeId: unknown, total: number): number {
  const value = typeof swipeId === "number" ? swipeId : Number(swipeId);
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), Math.max(total - 1, 0));
}

function makeTurnNode(params: {
  nodeId: string;
  parentNodeId: string;
  userInput: string;
  assistant: string;
  extra: Record<string, unknown>;
}): DialogueNode {
  const parsedContent: ParsedResponse | undefined = undefined;
  return {
    nodeId: params.nodeId,
    parentNodeId: params.parentNodeId,
    userInput: params.userInput,
    assistantResponse: params.assistant,
    fullResponse: params.assistant,
    thinkingContent: "",
    parsedContent,
    ...(Object.keys(params.extra).length > 0 ? { extra: params.extra } : {}),
  };
}

function makeRootNode(metadata: JsonlLine | null): DialogueNode {
  return {
    nodeId: "root",
    parentNodeId: "root",
    userInput: "",
    assistantResponse: "",
    fullResponse: "",
    thinkingContent: "",
    ...(metadata ? { extra: { jsonl_metadata: metadata } } : {}),
  };
}

function extractExtraFields(message: JsonlMessageLine): Record<string, unknown> {
  const known = new Set(["is_user", "is_system", "mes", "swipes", "swipe_id"]);
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message)) {
    if (known.has(key)) continue;
    extra[key] = value;
  }
  return extra;
}
