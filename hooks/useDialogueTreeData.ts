/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       useDialogueTreeData Hook                             ║
 * ║                                                                            ║
 * ║  对话树数据管理：全量加载 / 增量更新 / 路径高亮 / 节点处理                    ║
 * ║  从 DialogueTreeModal.tsx 提取的数据逻辑                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { Node, Edge } from "reactflow";
import { getCharacterDialogue } from "@/function/dialogue/info";
import { getIncrementalDialogue } from "@/function/dialogue/incremental-info";
import type { DialogueNodeData } from "@/components/dialogue-tree/DialogueNodeComponent";

// ============================================================================
//                              类型定义
// ============================================================================

export type DialogueNode = Node<DialogueNodeData>;

interface RawDialogueNode {
  nodeId: string;
  parentNodeId: string;
  userInput: string;
  assistantResponse: string;
  parsedContent?: {
    compressedContent?: string;
    regexResult?: string;
  };
}

interface UseDialogueTreeDataOptions {
  characterId: string | null;
  dialogueKey?: string | null;  // sessionId 或 characterId，用于对话树查询
  onEditClick: (id: string) => void;
  onJumpClick: (id: string) => void;
  t: (key: string) => string;
}

interface UseDialogueTreeDataReturn {
  dataLoaded: boolean;
  lastKnownNodeIds: Set<string>;
  lastUpdateTime: string;
  fetchDialogueData: () => Promise<{ nodes: DialogueNode[]; edges: Edge[] } | null>;
  fetchIncrementalData: () => Promise<{ nodes: DialogueNode[]; edges: Edge[] } | null>;
  processRawNodes: (
    rawNodes: RawDialogueNode[],
    currentNodeId: string,
  ) => { nodes: DialogueNode[]; edges: Edge[] };
  updateCurrentPath: () => Promise<{ currentPathIds: string[] } | undefined>;
  setDataLoaded: (loaded: boolean) => void;
}

// ============================================================================
//                              辅助函数
// ============================================================================

function extractUserInput(userInput: string): string {
  const match = userInput.match(/<input_message>([\s\S]*?)<\/input_message>/);
  if (!match) return "";
  return match[1].replace(/^[\s\n\r]*((<[^>]+>\s*)*)?(玩家输入指令|Player Input)[:：]\s*/i, "");
}

function calculateCurrentPath(allNodes: RawDialogueNode[], currentNodeId: string): string[] {
  const pathIds: string[] = [];
  let tempNodeId = currentNodeId;

  while (tempNodeId !== "root") {
    pathIds.push(tempNodeId);
    const node = allNodes.find((n) => n.nodeId === tempNodeId);
    if (!node) break;
    tempNodeId = node.parentNodeId;
  }

  return pathIds;
}

function getEdgeStyle(isRootSource: boolean, isCurrentPath: boolean) {
  if (isRootSource) {
    return {
      stroke: "var(--color-info)",
      labelStroke: "var(--color-info)",
      labelFill: "var(--color-info)",
      className: "root-source",
      width: 3,
    };
  }
  if (isCurrentPath) {
    return {
      stroke: "var(--color-danger)",
      labelStroke: "var(--color-danger)",
      labelFill: "var(--color-danger)",
      className: "current-path",
      width: 3,
    };
  }
  return {
    stroke: "var(--color-ink-soft)",
    labelStroke: "var(--color-ink)",
    labelFill: "var(--color-text-muted)",
    className: "other-path",
    width: 2,
  };
}

// ============================================================================
//                              主 Hook
// ============================================================================

export function useDialogueTreeData({
  characterId,
  dialogueKey,
  onEditClick,
  onJumpClick,
  t,
}: UseDialogueTreeDataOptions): UseDialogueTreeDataReturn {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastKnownNodeIds, setLastKnownNodeIds] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<string>("");
  const nodesRef = useRef<DialogueNode[]>([]);

  // 使用 dialogueKey（sessionId）或回退到 characterId
  const treeId = dialogueKey || characterId;

  // ========== 处理原始节点数据 ==========
  const processRawNodes = useCallback(
    (rawNodes: RawDialogueNode[], currentNodeId: string): { nodes: DialogueNode[]; edges: Edge[] } => {
      const currentPathIds = calculateCurrentPath(rawNodes, currentNodeId);
      const nodeMap: Record<string, RawDialogueNode> = {};
      rawNodes.forEach((node) => {
        nodeMap[node.nodeId] = node;
      });

      const nodes: DialogueNode[] = [];
      const edges: Edge[] = [];

      rawNodes.forEach((node) => {
        const isCurrentPath = currentPathIds.includes(node.nodeId);

        // 生成标签
        let label = "";
        if (node.nodeId === "root") {
          label = "root";
        } else if (node.parentNodeId === "root") {
          const rootChildren = rawNodes.filter((n) => n.parentNodeId === "root");
          const rootChildIndex = rootChildren.findIndex((n) => n.nodeId === node.nodeId);
          const rootChildrenCount = rootChildren.length;
          label = `${t("dialogue.startingPoint")}${rootChildrenCount - rootChildIndex}${rootChildrenCount > 1 ? `/${rootChildrenCount}` : ""}`;
        } else if (node.assistantResponse) {
          if (node.parsedContent?.compressedContent) {
            label = node.parsedContent.compressedContent;
          } else {
            label = node.assistantResponse.length > 30
              ? node.assistantResponse.substring(0, 30) + "..."
              : node.assistantResponse;
          }
        } else {
          label = t("dialogue.systemMessage");
        }

        nodes.push({
          id: node.nodeId,
          type: "dialogueNode",
          data: {
            label,
            fullContent: node.assistantResponse || "",
            userInput: extractUserInput(node.userInput),
            assistantResponse: node.assistantResponse || "",
            parsedContent: node.parsedContent || {},
            onEditClick,
            onJumpClick,
            isCurrentPath,
            characterId: characterId || "",
          },
          position: { x: 0, y: 0 },
          style: {
            width: 280,
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.1)",
          },
        });

        // 创建边
        if (node.nodeId !== "root" && nodeMap[node.parentNodeId]) {
          const isCurrentPathEdge =
            currentPathIds.includes(node.parentNodeId) && currentPathIds.includes(node.nodeId);
          const isRootSource = node.parentNodeId === "root";
          const style = getEdgeStyle(isRootSource, isCurrentPathEdge);

          edges.push({
            id: `edge-${node.parentNodeId}-${node.nodeId}`,
            source: node.parentNodeId,
            target: node.nodeId,
            label: extractUserInput(node.userInput),
            labelBgPadding: [8, 4] as [number, number],
            labelBgBorderRadius: 4,
            labelBgStyle: {
              fill: "var(--color-deep)",
              fillOpacity: 0.8,
              stroke: style.labelStroke,
            },
            labelStyle: {
              fill: style.labelFill,
              fontFamily: "inherit",
              fontSize: 12,
            },
            style: {
              stroke: style.stroke,
              strokeWidth: style.width,
            },
            animated: false,
            className: style.className,
            type: "smoothstep",
          });
        }
      });

      return { nodes, edges };
    },
    [characterId, onEditClick, onJumpClick, t],
  );

  // ========== 全量加载 ==========
  const fetchDialogueData = useCallback(async (): Promise<{ nodes: DialogueNode[]; edges: Edge[] } | null> => {
    if (!treeId || !characterId) return null;

    try {
      const response = await getCharacterDialogue(treeId, characterId);

      if (!response.success || !response.dialogue?.tree?.nodes) {
        throw new Error("Failed to fetch dialogue data");
      }

      const dialogue = response.dialogue;
      const rawNodes = dialogue.tree.nodes || [];
      const currentNodeId = dialogue.tree.currentNodeId || "root";

      if (rawNodes.length === 0) {
        setDataLoaded(true);
        return { nodes: [], edges: [] };
      }

      const { nodes, edges } = processRawNodes(rawNodes, currentNodeId);

      nodesRef.current = nodes;
      setLastKnownNodeIds(new Set(nodes.map((n) => n.id)));
      setDataLoaded(true);

      return { nodes, edges };
    } catch (error) {
      console.error("Error fetching dialogue data:", error);
      setDataLoaded(true);
      return null;
    }
  }, [treeId, characterId, processRawNodes]);

  // ========== 增量加载 ==========
  const fetchIncrementalData = useCallback(async (): Promise<{ nodes: DialogueNode[]; edges: Edge[] } | null> => {
    if (!characterId) return null;

    try {
      const incrementalResponse = await getIncrementalDialogue({
        characterId,
        lastKnownNodeIds: Array.from(lastKnownNodeIds),
        lastUpdateTime: lastUpdateTime || undefined,
      });

      if (!incrementalResponse.success || !incrementalResponse.hasNewData) {
        setDataLoaded(true);
        return null;
      }

      const { newNodes, updatedNodes, deletedNodeIds, currentNodeId } = incrementalResponse;

      if (newNodes.length === 0 && updatedNodes.length === 0 && deletedNodeIds.length === 0) {
        return null;
      }

      const allRawNodes = [...newNodes, ...updatedNodes];
      const { nodes, edges } = processRawNodes(allRawNodes, currentNodeId);

      // 更新追踪状态
      const updatedKnownIds = new Set([...lastKnownNodeIds, ...nodes.map((n) => n.id)]);
      deletedNodeIds.forEach((id: string) => updatedKnownIds.delete(id));

      setLastKnownNodeIds(updatedKnownIds);
      setLastUpdateTime(incrementalResponse.lastUpdateTime);

      return { nodes, edges, deletedNodeIds } as any;
    } catch (error) {
      console.error("Error fetching incremental dialogue data:", error);
      return null;
    }
  }, [characterId, lastKnownNodeIds, lastUpdateTime, processRawNodes]);

  // ========== 更新当前路径颜色 ==========
  const updateCurrentPath = useCallback(async () => {
    if (!treeId || !characterId) return;

    try {
      const response = await getCharacterDialogue(treeId, characterId);

      if (!response.success || !response.dialogue?.tree?.nodes) {
        return;
      }

      const dialogue = response.dialogue;
      const rawNodes = dialogue.tree.nodes || [];
      const currentNodeId = dialogue.tree.currentNodeId || "root";
      const currentPathIds = calculateCurrentPath(rawNodes, currentNodeId);

      // 返回更新后的路径信息，由调用方更新 UI
      return { currentPathIds };
    } catch (error) {
      console.error("Error updating current path:", error);
    }
  }, [treeId, characterId]);

  return {
    dataLoaded,
    lastKnownNodeIds,
    lastUpdateTime,
    fetchDialogueData,
    fetchIncrementalData,
    processRawNodes,
    updateCurrentPath,
    setDataLoaded,
  };
}
