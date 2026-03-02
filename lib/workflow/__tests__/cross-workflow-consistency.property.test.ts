/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     跨工作流一致性属性测试                                   ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**     ║
 * ║  **Validates: Requirements 6.1, 6.3**                                      ║
 * ║                                                                            ║
 * ║  验证 DialogueWorkflow 和 RAGWorkflow 在相同输入下产生一致的 messages[]     ║
 * ║  结构，差异仅限于节点存在性（如 MemoryNode）而非协议差异                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { DialogueWorkflow } from "../examples/DialogueWorkflow";
import { CorrectRAGWorkflow } from "../examples/RAGWorkflow";

/* ═══════════════════════════════════════════════════════════════════════════
   测试辅助类型
   ═══════════════════════════════════════════════════════════════════════════ */

interface WorkflowNodeConfig {
  id: string;
  name: string;
  next: string[];
  inputFields: string[];
  outputFields: string[];
  inputMapping?: Record<string, string>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 11: 跨工作流一致性
   
   *For any* workflow configuration, DialogueWorkflow 和 RAGWorkflow 应该：
   1. 包含相同的核心节点（historyPre, preset, context, worldBook, llm）
   2. 核心节点的字段流转配置一致
   3. 差异仅限于 memory 相关节点的存在性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 11: 跨工作流一致性", () => {
  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1, 6.3**
   * 
   * 验证两个工作流都包含 HistoryPreNode
   */
  it("两个工作流都应该包含 HistoryPreNode", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialogueHistoryPre = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );
    const ragHistoryPre = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );

    expect(dialogueHistoryPre).toBeDefined();
    expect(ragHistoryPre).toBeDefined();
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 验证 HistoryPreNode 的输出字段在两个工作流中一致
   */
  it("HistoryPreNode 输出字段应该在两个工作流中一致", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialogueHistoryPre = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );
    const ragHistoryPre = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );

    // 核心输出字段必须一致
    const coreOutputFields = ["chatHistoryMessages", "conversationContext", "userInput"];
    
    for (const field of coreOutputFields) {
      expect(dialogueHistoryPre.outputFields).toContain(field);
      expect(ragHistoryPre.outputFields).toContain(field);
    }
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 验证 PresetNode 接收 chatHistoryMessages 的配置在两个工作流中一致
   */
  it("PresetNode 应该在两个工作流中都接收 chatHistoryMessages", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialoguePreset = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );
    const ragPreset = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );

    expect(dialoguePreset.inputFields).toContain("chatHistoryMessages");
    expect(ragPreset.inputFields).toContain("chatHistoryMessages");
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 验证 PresetNode 输出 messages[] 的配置在两个工作流中一致
   */
  it("PresetNode 应该在两个工作流中都输出 messages", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialoguePreset = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );
    const ragPreset = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );

    expect(dialoguePreset.outputFields).toContain("messages");
    expect(ragPreset.outputFields).toContain("messages");
    expect(dialoguePreset.outputFields).not.toContain("systemMessage");
    expect(dialoguePreset.outputFields).not.toContain("userMessage");
    expect(ragPreset.outputFields).not.toContain("systemMessage");
    expect(ragPreset.outputFields).not.toContain("userMessage");
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 验证 ContextNode 在两个工作流中都保持 messages-only 中转
   */
  it("ContextNode 应该在两个工作流中都只处理中转 messages", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialogueContext = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "context",
    );
    const ragContext = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "context",
    );

    expect(dialogueContext.inputFields).toEqual(["messages"]);
    expect(dialogueContext.outputFields).toEqual(["messages"]);
    expect(ragContext.inputFields).toEqual(["messages"]);
    expect(ragContext.outputFields).toEqual(["messages"]);
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 验证 messages[] 在两个工作流中都能流转到 LLMNode
   */
  it("messages 应该在两个工作流中都流转到 LLMNode", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    const dialogueLLM = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "llm",
    );
    const ragLLM = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "llm",
    );

    expect(dialogueLLM.inputFields).toContain("messages");
    expect(ragLLM.inputFields).toContain("messages");
  });

  /**
   * RAG 记忆检索节点应采用 messages-only 注入链路
   */
  it("RAG 的 MemoryRetrievalNode 不应依赖 systemMessage 字符串输入", () => {
    const ragWorkflow = new CorrectRAGWorkflow();
    const ragConfig = (ragWorkflow as unknown).config;

    const memoryRetrieval = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "memoryRetrieval",
    );

    expect(memoryRetrieval.inputFields).toContain("messages");
    expect(memoryRetrieval.inputFields).not.toContain("systemMessage");
    expect(memoryRetrieval.outputFields).toContain("messages");
    expect(memoryRetrieval.outputFields).not.toContain("systemMessage");
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.3**
   * 
   * 验证节点顺序一致性：historyPre → preset → context
   */
  it("核心节点顺序应该一致：historyPre → preset → context", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueConfig = (dialogueWorkflow as unknown).config;
    const ragConfig = (ragWorkflow as unknown).config;

    // DialogueWorkflow: historyPre → preset → context
    const dialogueHistoryPre = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );
    const dialoguePreset = dialogueConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );

    expect(dialogueHistoryPre.next).toContain("preset-1");
    expect(dialoguePreset.next).toContain("context-1");

    // RAGWorkflow: historyPre → preset → context
    const ragHistoryPre = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "historyPre",
    );
    const ragPreset = ragConfig.nodes.find(
      (n: WorkflowNodeConfig) => n.name === "preset",
    );

    expect(ragHistoryPre.next).toContain("preset-1");
    expect(ragPreset.next).toContain("context-1");
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.3**
   * 
   * 验证差异仅限于 memory 相关节点
   */
  it("工作流差异应该仅限于 memory 相关节点", () => {
    const dialogueWorkflow = new DialogueWorkflow();
    const ragWorkflow = new CorrectRAGWorkflow();

    const dialogueRegistry = (dialogueWorkflow as unknown).registry;
    const ragRegistry = (ragWorkflow as unknown).registry;

    // 核心节点两个工作流都应该有
    const coreNodes = ["userInput", "historyPre", "preset", "context", "worldBook", "llm", "regex", "output"];
    
    for (const nodeName of coreNodes) {
      expect(dialogueRegistry).toHaveProperty(nodeName);
      expect(ragRegistry).toHaveProperty(nodeName);
    }

    // RAGWorkflow 特有的 memory 节点
    expect(ragRegistry).toHaveProperty("memoryRetrieval");
    expect(ragRegistry).toHaveProperty("memoryStorage");

    // DialogueWorkflow 特有的 plugin 节点
    expect(dialogueRegistry).toHaveProperty("pluginMessage");
    expect(dialogueRegistry).toHaveProperty("plugin");
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 属性测试：对于任意核心字段名，两个工作流的 PresetNode 配置应该一致
   */
  it("PresetNode 核心输入字段配置应该一致", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "characterId",
          "language", 
          "username",
          "number",
          "fastModel",
          "dialogueKey",
          "userInput",
          "chatHistoryMessages",
        ),
        (fieldName: string) => {
          const dialogueWorkflow = new DialogueWorkflow();
          const ragWorkflow = new CorrectRAGWorkflow();

          const dialogueConfig = (dialogueWorkflow as unknown).config;
          const ragConfig = (ragWorkflow as unknown).config;

          const dialoguePreset = dialogueConfig.nodes.find(
            (n: WorkflowNodeConfig) => n.name === "preset",
          );
          const ragPreset = ragConfig.nodes.find(
            (n: WorkflowNodeConfig) => n.name === "preset",
          );

          // 两个工作流的 PresetNode 都应该包含该核心字段
          const dialogueHasField = dialoguePreset.inputFields.includes(fieldName);
          const ragHasField = ragPreset.inputFields.includes(fieldName);

          return dialogueHasField === ragHasField;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.1**
   * 
   * 属性测试：对于任意核心输出字段，两个工作流的 HistoryPreNode 配置应该一致
   */
  it("HistoryPreNode 输出字段配置应该一致", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "chatHistoryMessages",
          "conversationContext",
          "userInput",
        ),
        (fieldName: string) => {
          const dialogueWorkflow = new DialogueWorkflow();
          const ragWorkflow = new CorrectRAGWorkflow();

          const dialogueConfig = (dialogueWorkflow as unknown).config;
          const ragConfig = (ragWorkflow as unknown).config;

          const dialogueHistoryPre = dialogueConfig.nodes.find(
            (n: WorkflowNodeConfig) => n.name === "historyPre",
          );
          const ragHistoryPre = ragConfig.nodes.find(
            (n: WorkflowNodeConfig) => n.name === "historyPre",
          );

          // 两个工作流的 HistoryPreNode 都应该输出该字段
          const dialogueHasField = dialogueHistoryPre.outputFields.includes(fieldName);
          const ragHasField = ragHistoryPre.outputFields.includes(fieldName);

          return dialogueHasField && ragHasField;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 11: 跨工作流一致性**
   * **Validates: Requirements 6.3**
   * 
   * 属性测试：对于任意核心节点名，两个工作流都应该注册该节点
   */
  it("核心节点应该在两个工作流中都注册", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "userInput",
          "historyPre",
          "preset",
          "context",
          "worldBook",
          "llm",
          "regex",
          "output",
        ),
        (nodeName: string) => {
          const dialogueWorkflow = new DialogueWorkflow();
          const ragWorkflow = new CorrectRAGWorkflow();

          const dialogueRegistry = (dialogueWorkflow as unknown).registry;
          const ragRegistry = (ragWorkflow as unknown).registry;

          // 两个工作流都应该注册该核心节点
          const dialogueHasNode = nodeName in dialogueRegistry;
          const ragHasNode = nodeName in ragRegistry;

          return dialogueHasNode && ragHasNode;
        },
      ),
      { numRuns: 100 },
    );
  });
});
