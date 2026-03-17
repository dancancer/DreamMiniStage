# Streaming Preview Render Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在真正流式输出期间，助手消息先走轻量预览渲染，不再反复触发完整 Markdown/HTML 解析；流结束后再恢复完整解析。

**Architecture:** 把“是否正在流式生成”与“是否支持流式功能”分开。`MessageItem` 只在最后一条 assistant 消息且 `isSending=true` 时启用 preview。`MessageBubble` 在 preview 模式下直接渲染原始文本并保留换行，不调用 `parseContent`、`markdown-converter`、`tag-replacer`。当 `isSending=false` 后自动回切现有完整解析链。

**Tech Stack:** React 19, TypeScript, Vitest, Next 15.
