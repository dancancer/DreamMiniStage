import { BaseWorkflow, WorkflowConfig } from "@/lib/workflow/BaseWorkflow";
import { NodeCategory } from "@/lib/nodeflow/types";
import { UserInputNode } from "@/lib/nodeflow/UserInputNode/UserInputNode";
import { HistoryPreNode } from "@/lib/nodeflow/HistoryPreNode/HistoryPreNode";
import { PresetNode } from "@/lib/nodeflow/PresetNode/PresetNode";
import { ContextNode } from "@/lib/nodeflow/ContextNode/ContextNode";
import { MemoryRetrievalNode } from "@/lib/nodeflow/MemoryNode/MemoryRetrievalNode";
import { WorldBookNode } from "@/lib/nodeflow/WorldBookNode/WorldBookNode";
import { LLMNode } from "@/lib/nodeflow/LLMNode/LLMNode";
import { RegexNode } from "@/lib/nodeflow/RegexNode/RegexNode";
import { OutputNode } from "@/lib/nodeflow/OutputNode/OutputNode";
import { MemoryStorageNode } from "@/lib/nodeflow/MemoryNode/MemoryStorageNode";

/**
 * CorrectRAGWorkflow - Enhanced execution architecture with AFTER nodes
 * 
 * Execution Flow:
 * 1. ENTRY -> MIDDLE nodes execute sequentially (userInput -> preset -> context -> memoryRetrieval -> worldBook -> llm -> regex)
 * 2. EXIT node (output) executes and workflow returns immediately to user
 * 3. AFTER nodes (memoryStorage) execute in background asynchronously
 * 
 * Benefits:
 * - User receives immediate response after output node
 * - Memory storage happens asynchronously without blocking user experience
 * - Maintains data consistency while improving response time
 * 
 * Usage:
 * ```typescript
 * const result = await workflowEngine.execute(params, context, {
 *   executeAfterNodes: true,  // Execute memory storage in background (default: true)
 *   awaitAfterNodes: false    // Don't wait for memory storage (default: false)
 * });
 * // User receives result immediately while memory storage continues in background
 * ```
 */

export interface CorrectRAGWorkflowParams {
  dialogueKey?: string;  // 会话 ID（用于隔离不同会话的历史）
  characterId: string;
  userInput: string;
  number?: number;
  language?: "zh" | "en";
  username?: string;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  llmType?: "openai" | "ollama" | "gemini";
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK?: number;
  repeatPenalty?: number;
  streaming?: boolean;
  streamUsage?: boolean;
  fastModel?: boolean;
  // Memory-specific parameters
  maxMemories?: number;
  enableMemoryStorage?: boolean;
}

export class CorrectRAGWorkflow extends BaseWorkflow {
  protected getNodeRegistry() {
    return {
      "userInput": {
        nodeClass: UserInputNode,
      },
      "historyPre": {
        nodeClass: HistoryPreNode,
      },
      "preset": {
        nodeClass: PresetNode,
      },
      "context": {
        nodeClass: ContextNode,
      },
      "memoryRetrieval": {
        nodeClass: MemoryRetrievalNode,
      },
      "worldBook": {
        nodeClass: WorldBookNode,
      },
      "llm": {
        nodeClass: LLMNode,
      },
      "regex": {
        nodeClass: RegexNode,
      },
      "output": {
        nodeClass: OutputNode,
      },
      "memoryStorage": {
        nodeClass: MemoryStorageNode,
      },
    };
  }

  protected getWorkflowConfig(): WorkflowConfig {
    return {
      id: "correct-rag-workflow",
      name: "Correct RAG Workflow - Early return with background AFTER nodes",
      nodes: [
        /* ═══════════════════════════════════════════════════════════════════
           入口节点：接收用户输入和配置参数
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "user-input-1",
          name: "userInput",
          category: NodeCategory.ENTRY,
          next: ["history-pre-1"],
          initParams: [
            "dialogueKey",
            "characterId", 
            "userInput", 
            "number", 
            "language", 
            "username", 
            "modelName", 
            "apiKey", 
            "baseUrl", 
            "llmType", 
            "temperature", 
            "fastModel",
            "maxMemories",
            "enableMemoryStorage",
            "streaming",
            "streamUsage",
          ],
          inputFields: [],
          outputFields: [
            "dialogueKey",
            "characterId", 
            "userInput", 
            "number", 
            "language", 
            "username", 
            "modelName", 
            "apiKey", 
            "baseUrl", 
            "llmType", 
            "temperature", 
            "fastModel",
            "maxMemories",
            "enableMemoryStorage",
            "streaming",
            "streamUsage",
          ],
        },

        /* ═══════════════════════════════════════════════════════════════════
           历史数据前置节点：在 PresetNode 之前提供结构化历史数据
           Requirements: 6.2 - RAGWorkflow 执行时，系统应在其节点链中包含 HistoryPreNode
           
           输出：
           - chatHistoryMessages: 结构化历史消息数组 → PresetNode
           - chatHistoryText: 压缩历史文本 → ContextNode
           - conversationContext: 短上下文 → memory/RAG 子系统
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "history-pre-1",
          name: "historyPre",
          category: NodeCategory.MIDDLE,
          next: ["preset-1"],
          initParams: [],
          inputFields: ["dialogueKey", "characterId", "userInput"],
          outputFields: ["chatHistoryMessages", "chatHistoryText", "conversationContext", "userInput"],
        },

        /* ═══════════════════════════════════════════════════════════════════
           预设节点：根据 preset 配置构建 messages[] 数组
           Requirements: 2.6 - PresetNode 构建 MacroEnv 时应包含来自 HistoryPreNode 的 chatHistoryMessages
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "preset-1",
          name: "preset",
          category: NodeCategory.MIDDLE,
          next: ["context-1"],
          initParams: [],
          inputFields: ["characterId", "language", "username", "number", "fastModel", "dialogueKey", "userInput", "chatHistoryMessages"],
          outputFields: ["systemMessage", "userMessage", "messages", "presetId"],
          inputMapping: {
            "userInput": "currentUserInput",
          },
        },

        /* ═══════════════════════════════════════════════════════════════════
           上下文节点：UI/兼容层，处理 userMessage 中的 {{chatHistory}} 文本替换
           接收 chatHistoryText 用于兼容旧 preset 的文本替换
           ═══════════════════════════════════════════════════════════════════ */
        {
          id: "context-1",
          name: "context",
          category: NodeCategory.MIDDLE,
          next: ["memory-retrieval-1"],
          initParams: [],
          inputFields: ["userMessage", "dialogueKey", "characterId", "userInput", "messages", "chatHistoryText"],
          outputFields: ["userMessage", "messages"],
        },
        {
          id: "memory-retrieval-1",
          name: "memoryRetrieval",
          category: NodeCategory.MIDDLE,
          next: ["world-book-1"],
          initParams: [],
          inputFields: ["characterId", "userInput", "systemMessage", "apiKey", "baseUrl", "language", "maxMemories", "username", "messages"],
          outputFields: ["systemMessage", "memoryPrompt", "messages"],
        },
        {
          id: "world-book-1",
          name: "worldBook",
          category: NodeCategory.MIDDLE,
          next: ["llm-1"],
          initParams: [],
          inputFields: ["systemMessage", "userMessage", "dialogueKey", "characterId", "language", "username", "userInput", "messages"],
          outputFields: ["systemMessage", "userMessage", "messages"],
          inputMapping: {
            "userInput": "currentUserInput",
          },
        },
        {
          id: "llm-1",
          name: "llm",
          category: NodeCategory.MIDDLE,
          next: ["regex-1"],
          initParams: [],
          inputFields: ["systemMessage", "userMessage", "messages", "modelName", "apiKey", "baseUrl", "llmType", "temperature", "language", "streaming", "streamUsage", "dialogueKey", "characterId"],
          outputFields: ["llmResponse"],
        },
        {
          id: "regex-1",
          name: "regex",
          category: NodeCategory.MIDDLE,
          next: ["output-1"],
          initParams: [],
          inputFields: ["llmResponse", "characterId"],
          outputFields: ["replacedText", "screenContent", "fullResponse", "nextPrompts", "event"], // 只输出处理后的内容
        },
        {
          id: "output-1",
          name: "output",
          category: NodeCategory.EXIT, // EXIT: Workflow returns immediately after this node
          next: [], // No next nodes - workflow completes here for user response
          initParams: [],
          inputFields: [
            "replacedText", 
            "screenContent", 
            "fullResponse", 
            "nextPrompts", 
            "event", 
            "presetId",
          ],
          outputFields: [
            "replacedText", 
            "screenContent", 
            "fullResponse", 
            "nextPrompts", 
            "event", 
            "presetId",
          ], // User receives immediate response with these fields
        },
        {
          id: "memory-storage-1",
          name: "memoryStorage",
          category: NodeCategory.AFTER, // AFTER: Executes in background after EXIT nodes complete
          next: [], // Terminal node in background execution
          initParams: [],
          inputFields: [
            // AFTER nodes have access to all data from the main workflow context
            "characterId",
            "userInput",
            "fullResponse",
            "conversationContext",
            "apiKey",
            "baseUrl",
            "language",
            "enableMemoryStorage",
            "replacedText",
            "screenContent", 
            "nextPrompts",
            "event",
            "presetId",
          ],
          outputFields: [
            // AFTER nodes don't need to output data since user already received response
          ],
        },
      ],
    };
  }
} 
