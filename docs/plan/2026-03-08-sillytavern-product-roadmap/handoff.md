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

## Review Follow-up（2026-03-08）

- 已根据新一轮 review 修复 4 个确认成立的问题：
  - `lib/model-runtime.ts`：`contextWindow` 裁剪改为按原始索引保留消息，避免打乱 prompt 顺序，同时继续保持预算硬约束。
  - `hooks/useCharacterDialogue.ts`：`/trigger` 路径现已继续传递 `advanced`，保证 continue generation 与普通发送/regen 语义一致。
  - `lib/adapters/import/preset-import.ts`：导入 preset 时会优先保留当前 app-format 的嵌套 `sampling`，再用 legacy ST 顶层字段补全缺失项。
  - `lib/nodeflow/LLMNode/LLMNodeTools.ts`：OpenAI/Claude 在未显式配置时不再覆盖底层默认 timeout，避免近乎无限的挂起等待。
- `timeout` 真实聊天链路已继续补齐到 `function/dialogue/chat.ts`、`lib/workflow/examples/DialogueWorkflow.ts`、`lib/workflow/examples/RAGWorkflow.ts` 与 `lib/nodeflow/LLMNode/LLMNode.ts`。
- 已新增/扩展定向测试：
  - `lib/__tests__/model-runtime.test.ts`
  - `lib/adapters/__tests__/preset-import.property.test.ts`
  - `lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
  - `function/dialogue/__tests__/chat-first-message.test.ts`
- 修复后已重新执行 `pnpm verify:stage`，结果为 lint / typecheck / test / build 全部通过。

## Code Quality Follow-up（2026-03-09）

- 已根据 `phase1-code-quality-review.md` 修复本轮确认成立的 code quality 阻塞项：
  - `function/dialogue/chat.ts` 已拆为 `chat.ts`、`chat-shared.ts`、`chat-streaming.ts`；流式模式已明确标注为 buffered chunked delivery。
  - `hooks/useModelSidebarConfig.ts` 已拆出 `helpers.ts`、`model-list.ts`、`test-model.ts`，主 hook 重新压回 400 行以内。
  - `lib/nodeflow/LLMNode/model-invokers.ts` 的 Gemini MVU 工具声明已提取到 `lib/mvu/function-call.ts`，同一份 schema 供 OpenAI / Gemini 复用。
  - `lib/model-runtime.ts` 已移除 `resolveModelAdvancedSettings` 的冗余外层 normalize，并为 `syncModelConfigToStorage` 的双写 key 补充注释；provider 参数支持矩阵已拆到 `lib/model-runtime-support.ts`，保证核心 runtime 文件重新回到 400 行以内。
  - `hooks/useApiConfig.ts` 已移除 `syncConfigToStorage` 空包装，并修复 `handleConfigSelect` 在 `await` 之后读取 stale configs 的问题。
- 当前关键文件行数已满足硬性指标：
  - `function/dialogue/chat.ts`：251 行
  - `hooks/useModelSidebarConfig.ts`：384 行
  - `lib/nodeflow/LLMNode/model-invokers.ts`：400 行
  - `lib/model-runtime.ts`：397 行
- 已新增/扩展本轮定向测试：
  - `lib/__tests__/model-runtime.test.ts`
  - `hooks/__tests__/useModelSidebarConfig.helpers.test.ts`
  - `function/dialogue/__tests__/chat-first-message.test.ts`
- 本轮实际验证结果：
  - `pnpm vitest run lib/__tests__/model-runtime.test.ts hooks/__tests__/useModelSidebarConfig.helpers.test.ts hooks/character-dialogue/__tests__/useDialoguePreferences.test.ts function/dialogue/__tests__/chat-first-message.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm verify:stage`
- 上述命令均已通过；当前阶段在已 review 的行为与代码质量项上已形成闭环，可继续推进 PR 准备。
