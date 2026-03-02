/**
 * @input  lib/data/roleplay/character-dialogue-operation
 * @output getIncrementalDialogue, hasNewDialogueNodes
 * @pos    增量对话获取 - 只返回新增/更新的对话节点
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";

interface IncrementalDialogueParams {
  dialogueId: string;
  lastKnownNodeIds?: string[];
  lastUpdateTime?: string;
}

interface IncrementalDialogueResponse {
  success: boolean;
  hasNewData: boolean;
  newNodes: any[];
  updatedNodes: any[];
  deletedNodeIds: string[];
  currentNodeId: string;
  totalNodeCount: number;
  lastUpdateTime: string;
}

/**
 * Get incremental dialogue data - only returns new/updated nodes since last check
 * @param params - Parameters including characterId and last known state
 * @returns Only new or updated dialogue nodes
 */
export async function getIncrementalDialogue(params: IncrementalDialogueParams): Promise<IncrementalDialogueResponse> {
  const { dialogueId, lastKnownNodeIds = [], lastUpdateTime } = params;

  if (!dialogueId || !dialogueId.trim()) {
    throw new Error("dialogueId is required for incremental dialogue");
  }

  try {
    const resolvedTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);

    if (!resolvedTree) {
      return {
        success: true,
        hasNewData: false,
        newNodes: [],
        updatedNodes: [],
        deletedNodeIds: [],
        currentNodeId: "root",
        totalNodeCount: 0,
        lastUpdateTime: new Date().toISOString(),
      };
    }

    const allNodes = resolvedTree.nodes || [];
    const lastKnownNodeIdsSet = new Set(lastKnownNodeIds);
    
    // Find new nodes (not in lastKnownNodeIds)
    const newNodes = allNodes.filter(node => !lastKnownNodeIdsSet.has(node.nodeId));
    
    // Find updated nodes (if lastUpdateTime is provided)
    let updatedNodes: any[] = [];
    if (lastUpdateTime) {
      const lastUpdateTimeMs = new Date(lastUpdateTime).getTime();
      updatedNodes = allNodes.filter(node => {
        const nodeUpdateTime = (node as any).updated_at ? new Date((node as any).updated_at).getTime() : 0;
        return lastKnownNodeIdsSet.has(node.nodeId) && nodeUpdateTime > lastUpdateTimeMs;
      });
    }

    // Find deleted nodes (in lastKnownNodeIds but not in current nodes)
    const currentNodeIds = new Set(allNodes.map(node => node.nodeId));
    const deletedNodeIds = Array.from(lastKnownNodeIdsSet).filter(nodeId => !currentNodeIds.has(nodeId));

    const hasNewData = newNodes.length > 0 || updatedNodes.length > 0 || deletedNodeIds.length > 0;

    return {
      success: true,
      hasNewData,
      newNodes,
      updatedNodes,
      deletedNodeIds,
      currentNodeId: resolvedTree.current_nodeId || "root",
      totalNodeCount: allNodes.length,
      lastUpdateTime: new Date().toISOString(),
    };

  } catch (error) {
    console.error("Failed to get incremental dialogue:", error);
    throw new Error(`Failed to get incremental dialogue: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check if there are new dialogue nodes without fetching full data
 * @param characterId - Character ID to check
 * @param lastKnownNodeCount - Last known number of nodes
 * @returns Whether new dialogue nodes exist
 */
export async function hasNewDialogueNodes(
  dialogueId: string,
  lastKnownNodeCount: number,
): Promise<boolean> {
  try {
    if (!dialogueId || !dialogueId.trim()) {
      throw new Error("dialogueId is required to check dialogue nodes");
    }
    const resolvedTree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueId);

    if (!resolvedTree) {
      return false;
    }

    const currentNodeCount = resolvedTree.nodes?.length || 0;
    return currentNodeCount > lastKnownNodeCount;

  } catch (error) {
    console.error("Failed to check for new dialogue nodes:", error);
    return false;
  }
} 
 
