/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     DialogueWorkflow 字段流转验证测试                       ║
 * ║                                                                            ║
 * ║  验证 Task 8: 更新 DialogueWorkflow                                        ║
 * ║  - 8.1 HistoryPreNode 正确插入到 pluginMessage 之后、preset 之前            ║
 * ║  - 8.2 字段流转正确配置                                                     ║
 * ║                                                                            ║
 * ║  Requirements: 2.1, 2.6                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import { DialogueWorkflow } from "../examples/DialogueWorkflow";

describe("Task 8: DialogueWorkflow 更新验证", () => {

  describe("8.1 HistoryPreNode 插入位置", () => {
    it("DialogueWorkflow 应该能够成功实例化（配置验证通过）", () => {
      // BaseWorkflow 构造函数会调用 validateWorkflowConfig
      // 如果字段流转配置错误，会抛出 ValidationError
      expect(() => new DialogueWorkflow()).not.toThrow();
    });

    it("historyPre 节点应该在 pluginMessage 之后", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const pluginMessageNode = nodes.find((n: any) => n.name === "pluginMessage");
      expect(pluginMessageNode).toBeDefined();
      expect(pluginMessageNode.next).toContain("history-pre-1");
    });

    it("historyPre 节点应该在 preset 之前", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");
      expect(historyPreNode).toBeDefined();
      expect(historyPreNode.next).toContain("preset-1");
    });

    it("节点顺序应该是: userInput → pluginMessage → historyPre → preset → context", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      // 验证节点链
      const userInputNode = nodes.find((n: any) => n.name === "userInput");
      const pluginMessageNode = nodes.find((n: any) => n.name === "pluginMessage");
      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");
      const presetNode = nodes.find((n: any) => n.name === "preset");
      const contextNode = nodes.find((n: any) => n.name === "context");

      expect(userInputNode.next).toContain("plugin-message-1");
      expect(pluginMessageNode.next).toContain("history-pre-1");
      expect(historyPreNode.next).toContain("preset-1");
      expect(presetNode.next).toContain("context-1");
    });
  });

  describe("8.2 字段流转配置", () => {
    it("chatHistoryMessages 应该从 HistoryPreNode 流向 PresetNode", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");
      const presetNode = nodes.find((n: any) => n.name === "preset");

      // HistoryPreNode 输出 chatHistoryMessages
      expect(historyPreNode.outputFields).toContain("chatHistoryMessages");

      // PresetNode 接收 chatHistoryMessages
      expect(presetNode.inputFields).toContain("chatHistoryMessages");
    });

    it("HistoryPreNode 不再输出 chatHistoryText，ContextNode 保持 messages-only 中转", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");
      const contextNode = nodes.find((n: any) => n.name === "context");

      // HistoryPreNode 已移除 chatHistoryText 兼容输出
      expect(historyPreNode.outputFields).not.toContain("chatHistoryText");

      // ContextNode 仅透传 messages[]
      expect(contextNode.inputFields).toEqual(["messages"]);
      expect(contextNode.outputFields).toEqual(["messages"]);
    });

    it("HistoryPreNode 应该输出 conversationContext（用于 memory/RAG）", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");
      expect(historyPreNode.outputFields).toContain("conversationContext");
    });

    it("PresetNode 应该接收 dialogueKey 和 userInput（用于 currentUserInput 映射）", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const presetNode = nodes.find((n: any) => n.name === "preset");

      expect(presetNode.inputFields).toContain("dialogueKey");
      expect(presetNode.inputFields).toContain("userInput");
      expect(presetNode.inputMapping).toEqual({ userInput: "currentUserInput" });
      expect(presetNode.outputFields).toContain("messages");
      expect(presetNode.outputFields).not.toContain("systemMessage");
      expect(presetNode.outputFields).not.toContain("userMessage");
    });

    it("HistoryPreNode 应该透传 userInput", () => {
      const workflow = new DialogueWorkflow();
      const config = (workflow as unknown).config;
      const nodes = config.nodes;

      const historyPreNode = nodes.find((n: any) => n.name === "historyPre");

      // 输入和输出都包含 userInput
      expect(historyPreNode.inputFields).toContain("userInput");
      expect(historyPreNode.outputFields).toContain("userInput");
    });
  });

  describe("节点注册表", () => {
    it("historyPre 节点应该在注册表中", () => {
      const workflow = new DialogueWorkflow();
      const registry = (workflow as unknown).registry;

      expect(registry).toHaveProperty("historyPre");
      expect(registry.historyPre.nodeClass).toBeDefined();
    });
  });
});
