import { 
  CHARACTER_DIALOGUES_FILE, 
  deleteRecord, 
  getRecordByKey, 
  putRecord, 
} from "@/lib/data/local-storage";
import { DialogueNode, DialogueTree } from "@/lib/models/node-model";
import { v4 as uuidv4 } from "uuid";
import { ParsedResponse } from "@/lib/models/parsed-response";

export class LocalCharacterDialogueOperations {
  /**
   * 创建对话树
   * 
   * @param dialogueId - 对话树 ID（sessionId 或 characterId）
   * @param characterId - 角色 ID（可选，默认与 dialogueId 相同）
   */
  static async createDialogueTree(dialogueId: string, characterId?: string): Promise<DialogueTree> {
    const charId = characterId || dialogueId;
    const dialogueTree = new DialogueTree(
      dialogueId,
      charId,
      [],
      "root",
    );
    
    await putRecord(CHARACTER_DIALOGUES_FILE, dialogueTree.id, dialogueTree);

    await this.addNodeToDialogueTree(dialogueId, "", "", "", "", "", undefined, "root");
    return dialogueTree;
  }
  
  static async getDialogueTreeById(dialogueId: string): Promise<DialogueTree | null> {
    const dialogue = await getRecordByKey<any>(CHARACTER_DIALOGUES_FILE, dialogueId);
    if (!dialogue) return null;
    
    return new DialogueTree(
      dialogue.id,
      dialogue.character_id,
      dialogue.nodes?.map((node: any) => new DialogueNode(
        node.nodeId,
        node.parentNodeId,
        node.userInput,
        node.assistantResponse,
        node.fullResponse,
        node.thinkingContent,
        node.parsedContent,
      )) || [],
      dialogue.current_nodeId,
    );
  }
  
  static async addNodeToDialogueTree(
    dialogueId: string, 
    parentNodeId: string,
    userInput: string,
    assistantResponse: string,
    fullResponse: string,
    thinkingContent?: string,
    parsedContent?: ParsedResponse,
    nodeId?: string,
  ): Promise<string> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    if (!dialogueTree) {
      throw new Error(`Dialogue not found: ${dialogueId}`);
    }

    if (!nodeId) {
      nodeId = uuidv4();
    }
    
    const newNode = new DialogueNode(
      nodeId,
      parentNodeId,
      userInput,
      assistantResponse,
      fullResponse,
      thinkingContent,
      parsedContent,
    );

    if (!dialogueTree.nodes) {
      dialogueTree.nodes = [];
    }
    
    dialogueTree.nodes.push(newNode);
    dialogueTree.current_nodeId = nodeId;
    
    await this.updateDialogueTree(dialogueId, dialogueTree);
    
    return nodeId;
  }

  static async updateDialogueTree(dialogueId: string, updatedDialogue: DialogueTree): Promise<boolean> {
    await putRecord(CHARACTER_DIALOGUES_FILE, dialogueId, updatedDialogue);
    return true;
  }

  static async updateNodeInDialogueTree(
    dialogueId: string, 
    nodeId: string, 
    updates: Partial<DialogueNode>,
  ): Promise<DialogueTree | null> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree) {
      return null;
    }
    
    const nodeIndex = dialogueTree.nodes.findIndex(node => node.nodeId === nodeId);
    
    if (nodeIndex === -1) {
      return null;
    }
    
    dialogueTree.nodes[nodeIndex] = {
      ...dialogueTree.nodes[nodeIndex],
      ...updates,
    };
    
    await this.updateDialogueTree(dialogueId, dialogueTree);
    
    return dialogueTree;
  }
  
  static async switchBranch(dialogueId: string, nodeId: string): Promise<DialogueTree | null> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree) {
      return null;
    }
    
    const node = dialogueTree.nodes.find(n => n.nodeId === nodeId);
    
    if (!node) {
      return null;
    }
    
    dialogueTree.current_nodeId = nodeId;
    
    await this.updateDialogueTree(dialogueId, dialogueTree);
    
    return dialogueTree;
  }
  
  static async clearDialogueHistory(dialogueId: string): Promise<DialogueTree | null> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree) {
      return null;
    }
    
    dialogueTree.nodes = [];
    dialogueTree.current_nodeId = "root";
    
    await this.updateDialogueTree(dialogueId, dialogueTree);
    
    return dialogueTree;
  }

  static async deleteDialogueTree(dialogueId: string): Promise<boolean> {
    const dialogue = await this.getDialogueTreeById(dialogueId);
    if (!dialogue) {
      return false;
    }

    await deleteRecord(CHARACTER_DIALOGUES_FILE, dialogueId);
    return true;
  }

  static async deleteNode(dialogueId: string, nodeId: string): Promise<DialogueTree | null> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree || nodeId === "root") {
      return null;
    }
    
    const nodeToDelete = dialogueTree.nodes.find(node => node.nodeId === nodeId);
    if (!nodeToDelete) {
      return null;
    }

    const nodesToDelete = new Set<string>();
    const collectNodesToDelete = (currentNodeId: string) => {
      nodesToDelete.add(currentNodeId);
      const children = dialogueTree.nodes.filter(node => node.parentNodeId === currentNodeId);
      children.forEach(child => collectNodesToDelete(child.nodeId));
    };
    
    collectNodesToDelete(nodeId);
    dialogueTree.nodes = dialogueTree.nodes.filter(node => !nodesToDelete.has(node.nodeId));
    if (nodesToDelete.has(dialogueTree.current_nodeId)) {
      dialogueTree.current_nodeId = nodeToDelete.parentNodeId;
      const newCurrentNode = dialogueTree.nodes.find(node => node.nodeId === dialogueTree.current_nodeId);
    }
    
    await this.updateDialogueTree(dialogueId, dialogueTree);
    
    return dialogueTree;
  }

  static async getDialoguePathToNode(dialogueId: string, nodeId: string): Promise<DialogueNode[]> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree) {
      return [];
    }
    
    const path: DialogueNode[] = [];
    let currentNode = dialogueTree.nodes.find(node => node.nodeId === nodeId);
    
    while (currentNode) {
      path.unshift(currentNode);
      
      if (currentNode.nodeId === "root") {
        break;
      }
      
      currentNode = dialogueTree.nodes.find(node => node.nodeId === currentNode?.parentNodeId);
    }
    
    return path;
  }

  static async getChildNodes(dialogueId: string, parentNodeId: string): Promise<DialogueNode[]> {
    const dialogueTree = await this.getDialogueTreeById(dialogueId);
    
    if (!dialogueTree) {
      return [];
    }
    
    return dialogueTree.nodes.filter(node => node.parentNodeId === parentNodeId);
  }

  static async getSystemMessage(characterId: string): Promise<string> {
    const dialogueTree = await this.getDialogueTreeById(characterId);
    if (!dialogueTree || !dialogueTree.nodes || dialogueTree.nodes.length === 0) {
      return "";
    }
    const rootNode = dialogueTree.nodes.find(node => node.parentNodeId === "root");
    return rootNode?.assistantResponse || "";
  }
  
  static async getLastNodeId(characterId: string): Promise<string> {
    const dialogueTree = await this.getDialogueTreeById(characterId);
    return dialogueTree?.current_nodeId || "root";
  }

  static async nodeExists(characterId: string, nodeId: string): Promise<boolean> {
    if (nodeId === "root") return true;
    
    const dialogueTree = await this.getDialogueTreeById(characterId);
    if (!dialogueTree || !dialogueTree.nodes || dialogueTree.nodes.length === 0) {
      return false;
    }

    return dialogueTree.nodes.some(node => node.nodeId === nodeId);
  }
}
