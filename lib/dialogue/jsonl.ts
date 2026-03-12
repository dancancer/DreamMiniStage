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
  const header = buildJsonlHeader(tree, options);

  const lines: string[] = [JSON.stringify(header)];
  const path = getDialoguePathToNode(tree, tree.current_nodeId);

  for (const node of path) {
    if (!node.userInput && !node.assistantResponse) continue;

    if (node.userInput) {
      lines.push(
        JSON.stringify({
          ...getJsonlMessageExtra(node.extra, "user"),
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
          ...getJsonlMessageExtra(node.extra, "assistant"),
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
  let pendingUserExtra: Record<string, unknown> = {};

  for (const message of messageLines) {
    const isUser = Boolean(message.is_user);
    const text = normalizeMes(message.mes);
    const extra = extractExtraFields(message);

    if (isUser) {
      pendingUserInput = text;
      pendingUserExtra = extra;
      continue;
    }

    const swipes = normalizeSwipes(message, text);
    const swipeId = clampSwipeId(message.swipe_id, swipes.length);

    const userInput = pendingUserInput ?? "";
    const createdIds: string[] = [];

    for (const swipeText of swipes) {
      const nodeId = generateId();
      createdIds.push(nodeId);
      nodes.push(makeTurnNode({
        nodeId,
        parentNodeId,
        userInput,
        assistant: swipeText,
        extra: buildTurnExtra(pendingUserExtra, extra),
      }));
    }

    const selectedNodeId = createdIds[swipeId] ?? createdIds[0];
    parentNodeId = selectedNodeId ?? parentNodeId;
    pendingUserInput = null;
    pendingUserExtra = {};
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

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
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

function buildJsonlHeader(tree: DialogueTree, options: JsonlExportOptions): JsonlLine {
  const rootNode = tree.nodes.find((node) => node.nodeId === "root");
  const rootExtra = toRecord(rootNode?.extra);
  const storedHeader = toRecord(rootExtra.jsonl_metadata);
  const { chat_metadata: _storedChatMetadata, ...headerWithoutChatMetadata } = storedHeader;
  const chatMetadata = options.chatMetadata ?? toRecord(rootExtra.chat_metadata);

  return {
    ...headerWithoutChatMetadata,
    user_name: options.userName ?? normalizeMes(storedHeader.user_name),
    character_name: options.characterName ?? normalizeMes(storedHeader.character_name),
    ...(Object.keys(chatMetadata).length > 0 ? { chat_metadata: chatMetadata } : {}),
  };
}

function buildTurnExtra(
  userExtra: Record<string, unknown>,
  assistantExtra: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.keys(userExtra).length === 0 && Object.keys(assistantExtra).length === 0) {
    return {};
  }

  return {
    ...assistantExtra,
    jsonl_message: {
      ...(Object.keys(userExtra).length > 0 ? { user: userExtra } : {}),
      ...(Object.keys(assistantExtra).length > 0 ? { assistant: assistantExtra } : {}),
    },
  };
}

function getJsonlMessageExtra(
  extra: Record<string, unknown> | undefined,
  role: "user" | "assistant",
): Record<string, unknown> {
  const extraRecord = toRecord(extra);
  const stored = toRecord(toRecord(extraRecord.jsonl_message)[role]);

  if (Object.keys(stored).length > 0) {
    return stored;
  }

  if (role === "user") {
    return {};
  }

  const { jsonl_message: _jsonlMessage, ...legacyAssistantExtra } = extraRecord;
  return legacyAssistantExtra;
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
  const chatMetadata = metadata && typeof metadata.chat_metadata === "object" && metadata.chat_metadata !== null
    ? metadata.chat_metadata as Record<string, unknown>
    : undefined;

  return {
    nodeId: "root",
    parentNodeId: "root",
    userInput: "",
    assistantResponse: "",
    fullResponse: "",
    thinkingContent: "",
    ...(metadata
      ? {
        extra: {
          jsonl_metadata: metadata,
          ...(chatMetadata ? { chat_metadata: chatMetadata } : {}),
        },
      }
      : {}),
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
