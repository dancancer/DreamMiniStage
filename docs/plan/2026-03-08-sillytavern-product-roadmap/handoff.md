# Handoff（2026-03-08）

## Phase 1 已完成内容

- 已创建阶段分支 `codex/phase-1-model-runtime`，按阶段分支规则推进本轮实现。
- 新增 `lib/model-runtime.ts`，把模型高级参数、preset 参数映射、优先级合并、运行时存储同步收口到单一路径。
- `model-store` 现已把 `advanced` 并入 `APIConfig`，`useDialoguePreferences` 改为从 `model-store` 读取当前激活模型配置，不再在运行时重新拼接分散的 localStorage key。
- `PresetOperations` / `preset-import` / `PresetNodeTools` 已保留并恢复 ST preset 的关键采样参数：`openai_max_context`、`openai_max_tokens`、`temperature`、`top_p`、`top_k`、`frequency_penalty`、`presence_penalty`、`repetition_penalty`、`stream_openai`。
- `handleCharacterChatRequest` 现会按 `请求(UI/脚本)` -> `preset 默认` -> `provider 默认` 的顺序合并高级参数，并将结果透传到 `DialogueWorkflow -> LLMNode -> model invoker`。
- `LLMNode` / `LLMNodeTools` / `model-invokers` 已接通 `contextWindow`、`maxTokens`、`timeout`、`maxRetries`、`topP`、`frequencyPenalty`、`presencePenalty`、`topK`、`repeatPenalty`、`streaming`、`streamUsage`。
- 模型侧边栏桌面端与移动端都新增了高级设置 UI，可直接修改上下文窗口、最大输出、采样参数、超时、重试与 streaming 开关。

## 验证

- `pnpm typecheck`
- `pnpm vitest run lib/adapters/__tests__/preset-import.property.test.ts lib/workflow/__tests__/dialogue-workflow-validation.test.ts function/dialogue/__tests__/chat-first-message.test.ts`

## 新增/更新测试覆盖

- `lib/adapters/__tests__/preset-import.property.test.ts`：断言 ST 预设采样参数导入后被保留并映射到统一 runtime 字段。
- `lib/workflow/__tests__/dialogue-workflow-validation.test.ts`：断言高级参数字段从工作流入口流转到 `LLMNode`。
- `function/dialogue/__tests__/chat-first-message.test.ts`：断言真实聊天请求会把高级参数透传到 `DialogueWorkflow`。

## 仍需注意

- 当前 Phase 1 已把模型参数闭环打通，但 Prompt Viewer 的“最终生效参数可视化”仍属于 Phase 2 范围，尚未处理。
- 现有模型配置 UI 仍沿用旧结构：基础字段对已存在配置的编辑体验没有在本轮整体重做；本轮新增的高级参数已经可编辑并可生效。

## 阶段质检门（2026-03-08 新增）

- 已新增统一阶段质检命令：`pnpm verify:stage`
- 质检内容固定为：`pnpm lint` -> `pnpm typecheck` -> `pnpm vitest run` -> `pnpm build`
- 本次实际执行结果：lint 通过、typecheck 通过、test 通过、build 通过
- 已修复历史阻塞项：`/Users/xupeng/mycode/DreamMiniStage/lib/slash-command/__tests__/pipe-propagation.property.test.ts` 中的 `/setvar` 简写与字符串归一化问题，当前阶段已满足全局质检门
