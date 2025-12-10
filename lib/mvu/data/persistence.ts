/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 持久化层                                       ║
 * ║                                                                            ║
 * ║  处理变量与对话节点的持久化关联                                               ║
 * ║  设计原则：变量随消息存储，回滚时自动恢复                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import type { MvuData, StatData } from "../types";
import { updateVariablesFromMessage } from "../core/executor";

// ============================================================================
//                              变量获取
// ============================================================================

/**
 * 获取角色当前的变量状态
 * 从对话树的当前节点向上回溯，找到最近的变量快照
 */
export async function getCharacterVariables(characterId: string): Promise<MvuData | null> {
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
  if (!tree || !tree.nodes.length) return null;

  // 从当前节点向上回溯找变量
  const path = await LocalCharacterDialogueOperations.getDialoguePathToNode(
    characterId,
    tree.current_nodeId,
  );

  // 从后往前找第一个有变量的节点
  for (let i = path.length - 1; i >= 0; i--) {
    const node = path[i];
    if (node.parsedContent?.variables) {
      return node.parsedContent.variables;
    }
  }

  return null;
}

/**
 * 获取指定消息节点的变量快照
 */
export async function getNodeVariables(
  characterId: string,
  nodeId: string,
): Promise<MvuData | null> {
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
  if (!tree) return null;

  const node = tree.nodes.find((n) => n.nodeId === nodeId);
  return node?.parsedContent?.variables ?? null;
}

// ============================================================================
//                              变量更新
// ============================================================================

/**
 * 处理消息并更新变量
 * 1. 获取当前变量状态
 * 2. 从消息内容提取更新命令
 * 3. 执行更新
 * 4. 保存到节点
 */
export async function processMessageVariables(
  characterId: string,
  nodeId: string,
  messageContent: string,
): Promise<MvuData | null> {
  // 获取当前变量
  const currentVars = await getCharacterVariables(characterId);
  if (!currentVars) return null;

  // 执行更新
  const result = updateVariablesFromMessage(messageContent, currentVars);

  if (result.modified) {
    // 保存到节点
    await saveNodeVariables(characterId, nodeId, result.variables);
  }

  return result.variables;
}

/**
 * 保存变量到指定节点
 */
export async function saveNodeVariables(
  characterId: string,
  nodeId: string,
  variables: MvuData,
): Promise<boolean> {
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
  if (!tree) return false;

  const node = tree.nodes.find((n) => n.nodeId === nodeId);
  if (!node) return false;

  await LocalCharacterDialogueOperations.updateNodeInDialogueTree(characterId, nodeId, {
    parsedContent: {
      ...node.parsedContent,
      variables,
    },
  });

  return true;
}

// ============================================================================
//                              变量初始化
// ============================================================================

/**
 * 初始化角色变量
 * 在开场白节点保存初始变量
 */
export async function initCharacterVariables(
  characterId: string,
  initialData: StatData,
): Promise<MvuData> {
  const variables: MvuData = {
    stat_data: initialData,
    display_data: JSON.parse(JSON.stringify(initialData)),
    delta_data: {},
    initialized_lorebooks: {},
  };

  // 找到 root 的第一个子节点（开场白）
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(characterId);
  if (tree && tree.nodes.length > 0) {
    const firstNode = tree.nodes.find((n) => n.parentNodeId === "root");
    if (firstNode) {
      await saveNodeVariables(characterId, firstNode.nodeId, variables);
    }
  }

  return variables;
}
