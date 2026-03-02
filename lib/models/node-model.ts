/**
 * @input  lib/models/parsed-response
 * @output DialogueNode
 * @pos    对话树节点模型,支持多分支对话历史的树状结构
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

import { ParsedResponse } from "@/lib/models/parsed-response";

export class DialogueNode {
  nodeId: string;
  parentNodeId: string;
  userInput: string;
  assistantResponse: string;
  fullResponse: string;
  thinkingContent?: string;
  parsedContent?: ParsedResponse;
  extra?: Record<string, unknown>;
  constructor(
    nodeId: string,
    parentNodeId: string,
    userInput: string,
    assistantResponse: string,
    fullResponse: string,
    thinkingContent?: string,
    parsedContent?: ParsedResponse,
    extra?: Record<string, unknown>,
  ) {
    this.nodeId = nodeId;
    this.parentNodeId = parentNodeId;
    this.userInput = userInput;
    this.assistantResponse = assistantResponse;
    this.fullResponse = fullResponse;
    this.thinkingContent = thinkingContent;
    this.parsedContent = parsedContent;
    this.extra = extra;
  }
}

export class DialogueTree {
  id: string;
  character_id: string;
  current_nodeId: string;
  
  nodes: DialogueNode[];
  
  constructor(
    id: string,
    character_id: string,
    nodes: DialogueNode[] = [],
    current_nodeId: string = "root",
  ) {
    this.id = id;
    this.character_id = character_id;
    this.nodes = nodes;
    this.current_nodeId = current_nodeId;
  }
}
