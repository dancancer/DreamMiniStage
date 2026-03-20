/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         MVU 持久化层                                       ║
 * ║                                                                            ║
 * ║  处理变量与对话节点的持久化关联                                               ║
 * ║  设计原则：变量随消息存储，回滚时自动恢复                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { LocalCharacterDialogueOperations } from "@/lib/data/roleplay/character-dialogue-operation";
import { WorldBookOperations } from "@/lib/data/roleplay/world-book-operation";
import type { ParsedMvuTrace } from "@/lib/models/parsed-response";
import type { MvuData, StatData } from "../types";
import { updateVariablesFromMessage } from "../core/executor";
import { initializeVariables, type WorldBookEntry } from "../variable-init";

/** 对话范围参数：使用 sessionId（dialogueKey） */
interface DialogueScope {
  dialogueKey: string;
}

/** 强制获取对话树主键，缺失即报错 */
function requireDialogueKey(scope: DialogueScope): string {
  const dialogueKey = scope.dialogueKey?.trim();
  if (!dialogueKey) {
    throw new Error("dialogueKey is required for MVU persistence");
  }
  return dialogueKey;
}

// ============================================================================
//                              变量获取
// ============================================================================

/**
 * 获取角色当前的变量状态
 * 从对话树的当前节点向上回溯，找到最近的变量快照
 */
export async function getCharacterVariables(scope: DialogueScope): Promise<MvuData | null> {
  const dialogueKey = requireDialogueKey(scope);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree || !tree.nodes.length) return null;

  // 从当前节点向上回溯找变量
  const path = await LocalCharacterDialogueOperations.getDialoguePathToNode(
    dialogueKey,
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
  scope: DialogueScope,
  nodeId: string,
): Promise<MvuData | null> {
  const dialogueKey = requireDialogueKey(scope);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree) return null;

  const node = tree.nodes.find((n) => n.nodeId === nodeId);
  return node?.parsedContent?.variables ?? null;
}

export async function getNodeMvuTrace(
  scope: DialogueScope,
  nodeId: string,
): Promise<ParsedMvuTrace | null> {
  const dialogueKey = requireDialogueKey(scope);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree) return null;

  const node = tree.nodes.find((entry) => entry.nodeId === nodeId);
  return node?.parsedContent?.mvuTrace ?? null;
}

export async function getCurrentMvuTrace(scope: DialogueScope): Promise<ParsedMvuTrace | null> {
  const dialogueKey = requireDialogueKey(scope);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree) return null;

  const node = tree.nodes.find((entry) => entry.nodeId === tree.current_nodeId);
  return node?.parsedContent?.mvuTrace ?? null;
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
  scope: DialogueScope & { nodeId: string; messageContent: string },
): Promise<MvuData | null> {
  const { nodeId, messageContent } = scope;

  // 获取当前变量
  const currentVars = await getCharacterVariables(scope);
  if (!currentVars) return null;

  // 执行更新
  const result = updateVariablesFromMessage(messageContent, currentVars);

  if (result.modified) {
    // 保存到节点
    await saveNodeVariables({
      dialogueKey: scope.dialogueKey,
      nodeId,
      variables: result.variables,
    });
  }

  return result.variables;
}

/**
 * 保存变量到指定节点
 */
export async function saveNodeVariables(
  scope: DialogueScope & { nodeId: string; variables: MvuData },
): Promise<boolean> {
  const { nodeId, variables } = scope;
  const dialogueKey = requireDialogueKey(scope);
  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (!tree) return false;

  const node = tree.nodes.find((n) => n.nodeId === nodeId);
  if (!node) return false;

  await LocalCharacterDialogueOperations.updateNodeInDialogueTree(dialogueKey, nodeId, {
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
  scope: DialogueScope & { initialData: StatData },
): Promise<MvuData> {
  const dialogueKey = requireDialogueKey(scope);
  const { initialData } = scope;
  const variables: MvuData = {
    stat_data: initialData,
    display_data: JSON.parse(JSON.stringify(initialData)),
    delta_data: {},
    initialized_lorebooks: {},
  };

  const tree = await LocalCharacterDialogueOperations.getDialogueTreeById(dialogueKey);
  if (tree && tree.nodes.length > 0) {
    const firstNode = tree.nodes.find((n) => n.parentNodeId === "root");
    if (firstNode) {
      await saveNodeVariables({ dialogueKey, nodeId: firstNode.nodeId, variables });
    }
  }

  return variables;
}

// ============================================================================
//                              世界书初始化
// ============================================================================

/**
 * 从世界书加载并初始化 MVU 变量
 *
 * 【完整初始化流程】
 * 1. 加载角色世界书和全局世界书
 * 2. 提取 [InitVar] 条目
 * 3. 应用开场白 <initvar> 覆盖（如果有）
 * 4. 保存到开场白节点
 *
 * @param params.dialogueKey - 对话树 ID
 * @param params.characterId - 角色 ID
 * @param params.openingNodeId - 开场白节点 ID
 * @param params.greeting - 开场白内容（用于检测 <initvar> 块）
 */
export async function initMvuVariablesFromWorldBooks(params: {
  dialogueKey: string;
  characterId: string;
  openingNodeId: string;
  greeting?: string;
}): Promise<MvuData | null> {
  const { dialogueKey, characterId, openingNodeId, greeting } = params;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: 并行加载世界书（角色 + 全局）
    // ═══════════════════════════════════════════════════════════════════════
    const [characterWB, globalWB] = await Promise.all([
      loadWorldBookEntries(`character:${characterId}`),
      loadWorldBookEntries("global"),
    ]);

    const worldBooks: WorldBookEntry[][] = [];
    const worldBookNames: string[] = [];

    if (characterWB.length > 0) {
      worldBooks.push(characterWB);
      worldBookNames.push(`character:${characterId}`);
    }

    if (globalWB.length > 0) {
      worldBooks.push(globalWB);
      worldBookNames.push("global");
    }

    // 没有任何世界书，创建空的 MVU 数据
    if (worldBooks.length === 0 && !greeting) {
      console.debug("[MVU] 无世界书和开场白变量，跳过初始化");
      return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: 调用 initializeVariables 执行初始化
    // ═══════════════════════════════════════════════════════════════════════
    const result = initializeVariables({
      worldBooks,
      worldBookNames,
      greeting,
      existingData: null,
    });

    if (!result.success) {
      console.warn("[MVU] 变量初始化失败:", result.errors);
      return null;
    }

    // 如果没有加载任何变量，不保存
    if (Object.keys(result.variables.stat_data).length === 0) {
      console.debug("[MVU] 初始化完成但无变量数据");
      return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 3: 保存到开场白节点
    // ═══════════════════════════════════════════════════════════════════════
    await saveNodeVariables({
      dialogueKey,
      nodeId: openingNodeId,
      variables: result.variables,
    });

    console.log("[MVU] 变量初始化完成:", {
      sources: result.loadedSources,
      varCount: Object.keys(result.variables.stat_data).length,
    });

    return result.variables;
  } catch (error) {
    console.error("[MVU] 变量初始化异常:", error);
    return null;
  }
}

/**
 * 加载世界书条目并转换为 MVU 格式
 */
async function loadWorldBookEntries(key: string): Promise<WorldBookEntry[]> {
  try {
    const worldBook = await WorldBookOperations.getWorldBook(key);
    if (!worldBook) return [];

    return Object.values(worldBook)
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({
        uid: entry.entry_id || entry.id || String(Math.random()),
        comment: entry.comment,
        content: entry.content,
        keys: entry.keys,
        enabled: entry.enabled,
      }));
  } catch (error) {
    console.warn(`[MVU] 加载世界书 ${key} 失败:`, error);
    return [];
  }
}
