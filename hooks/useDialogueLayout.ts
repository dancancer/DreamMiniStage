/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       useDialogueLayout Hook                               ║
 * ║                                                                            ║
 * ║  对话树布局策略：ELK 自动布局 / Grid 回退布局 / Progressive 增量布局         ║
 * ║  从 DialogueTreeModal.tsx 提取的布局逻辑                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useMemo, useState } from "react";
import { Node, Edge } from "reactflow";
import ELK from "elkjs/lib/elk.bundled.js";

// ============================================================================
//                              类型定义
// ============================================================================

interface ELKNode {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ELKNode[];
}

interface ELKEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ELKGraph {
  id: string;
  children?: ELKNode[];
  edges: ELKEdge[];
}

export type LayoutMethod = "elk" | "grid";

interface UseDialogueLayoutReturn {
  layoutMethod: LayoutMethod;
  userAdjustedPositions: Record<string, { x: number; y: number }>;
  setUserAdjustedPositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  calculateFallbackLayout: <T extends Node>(nodes: T[]) => T[];
  calculateELKLayout: (nodes: Node[], edges: Edge[]) => Promise<ELKGraph | null>;
  calculateProgressiveLayout: <T extends Node>(
    allNodes: T[],
    allEdges: Edge[],
    existingNodes: T[],
  ) => Promise<T[]>;
  applyLayout: <T extends Node>(nodes: T[], edges: Edge[]) => Promise<T[]>;
  resetUserPositions: () => void;
  saveNodePosition: (nodeId: string, x: number, y: number) => void;
}

// ============================================================================
//                              ELK 布局配置
// ============================================================================

const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "80",
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.edgeNode": "20",
  "elk.spacing.edgeEdge": "15",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.cycleBreaking.strategy": "GREEDY",
  "elk.alignment": "CENTER",
  "elk.spacing.portPort": "10",
  "elk.portConstraints": "FIXED_ORDER",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.separateConnectedComponents": "true",
  "elk.layered.thoroughness": "10",
  "elk.layered.unnecessaryBendpoints": "true",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.aspectRatio": "1.6",
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 140;

// ============================================================================
//                              主 Hook
// ============================================================================

export function useDialogueLayout(): UseDialogueLayoutReturn {
  const [layoutMethod, setLayoutMethod] = useState<LayoutMethod>("elk");
  const [userAdjustedPositions, setUserAdjustedPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const elk = useMemo(() => new ELK(), []);

  // ========== Grid 回退布局 ==========
  const calculateFallbackLayout = useCallback(<T extends Node>(nodes: T[]): T[] => {
    const nodeCount = nodes.length;
    const columns = nodeCount <= 3 ? 1 : Math.max(1, Math.round(Math.sqrt(nodeCount)));

    const baseHorizontalGap = 500;
    const baseVerticalGap = 250;
    const minHorizontalGap = 200;
    const minVerticalGap = 150;

    const horizontalGap = Math.max(minHorizontalGap, baseHorizontalGap * Math.pow(0.9, nodeCount));
    const verticalGap = Math.max(minVerticalGap, baseVerticalGap * Math.pow(0.95, nodeCount));

    const rows = Math.ceil(nodeCount / columns);
    const gridWidth = columns * NODE_WIDTH + (columns - 1) * horizontalGap;
    const gridHeight = rows * NODE_HEIGHT + (rows - 1) * verticalGap;

    return nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const xPos = col * (NODE_WIDTH + horizontalGap) - gridWidth / 2 + NODE_WIDTH / 2;
      const yPos = row * (NODE_HEIGHT + verticalGap) - gridHeight / 2 + NODE_HEIGHT / 2;

      return { ...node, position: { x: xPos, y: yPos } };
    });
  }, []);

  // ========== ELK 自动布局 ==========
  const calculateELKLayout = useCallback(
    async (nodes: Node[], edges: Edge[]): Promise<ELKGraph | null> => {
      const elkGraph: ELKGraph = {
        id: "root",
        children: nodes.map((node) => ({
          id: node.id,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      try {
        const layout = await elk.layout(elkGraph, { layoutOptions: ELK_LAYOUT_OPTIONS });
        return layout;
      } catch (error) {
        console.error("ELK layout calculation failed:", error);
        return null;
      }
    },
    [elk],
  );

  // ========== Progressive 增量布局 ==========
  const calculateProgressiveLayout = useCallback(
    async <T extends Node>(
      allNodes: T[],
      allEdges: Edge[],
      existingNodes: T[],
    ): Promise<T[]> => {
      const existingNodeIds = new Set(existingNodes.map((n) => n.id));
      const newNodes = allNodes.filter((node) => !existingNodeIds.has(node.id));

      // 没有新节点，只应用用户位置
      if (newNodes.length === 0) {
        return allNodes.map((node) => {
          const userPos = userAdjustedPositions[node.id];
          return userPos ? { ...node, position: userPos } : node;
        });
      }

      try {
        const elkLayout = await calculateELKLayout(allNodes, allEdges);

        if (elkLayout?.children?.length) {
          return allNodes.map((node) => {
            const userPos = userAdjustedPositions[node.id];
            if (userPos) return { ...node, position: userPos };

            const elkNode = elkLayout.children?.find((child) => child.id === node.id);
            if (elkNode && typeof elkNode.x === "number" && typeof elkNode.y === "number") {
              return { ...node, position: { x: elkNode.x, y: elkNode.y } };
            }
            return node;
          });
        }

        return calculateFallbackLayout(allNodes);
      } catch (error) {
        console.error("Error in progressive layout:", error);
        return calculateFallbackLayout(allNodes);
      }
    },
    [calculateELKLayout, calculateFallbackLayout, userAdjustedPositions],
  );

  // ========== 应用布局（统一入口） ==========
  const applyLayout = useCallback(
    async <T extends Node>(nodes: T[], edges: Edge[]): Promise<T[]> => {
      try {
        const elkLayout = await calculateELKLayout(nodes, edges);

        if (elkLayout?.children?.length) {
          setLayoutMethod("elk");
          return nodes.map((node) => {
            const elkNode = elkLayout.children?.find((child) => child.id === node.id);
            if (elkNode && typeof elkNode.x === "number" && typeof elkNode.y === "number") {
              return { ...node, position: { x: elkNode.x, y: elkNode.y } };
            }
            return node;
          });
        }

        setLayoutMethod("grid");
        return calculateFallbackLayout(nodes);
      } catch (error) {
        console.error("Error in layout calculation:", error);
        setLayoutMethod("grid");
        return calculateFallbackLayout(nodes);
      }
    },
    [calculateELKLayout, calculateFallbackLayout],
  );

  // ========== 重置用户位置 ==========
  const resetUserPositions = useCallback(() => {
    setUserAdjustedPositions({});
  }, []);

  // ========== 保存节点位置 ==========
  const saveNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setUserAdjustedPositions((prev) => ({
      ...prev,
      [nodeId]: { x, y },
    }));
  }, []);

  return {
    layoutMethod,
    userAdjustedPositions,
    setUserAdjustedPositions,
    calculateFallbackLayout,
    calculateELKLayout,
    calculateProgressiveLayout,
    applyLayout,
    resetUserPositions,
    saveNodePosition,
  };
}
