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


## Phase 2 已完成内容（2026-03-09）

- 已创建阶段分支 `codex/phase-2-prompt-product-surface`，本轮实现按新的阶段分支推进。
- 新增 `lib/store/prompt-config-store.ts`、`lib/prompt-config/state.ts`、`lib/prompt-config/service.ts`、`lib/prompt-config/catalog.ts`，把 `preset / instruct / sysprompt / context / stop strings / prompt post-processing` 收口到单一状态源。
- `function/preset/global.ts` 与 `hooks/script-bridge/slash-context-adapter.ts` 已改为复用 prompt-config 单路径：
  - `/preset`、`/instruct*`、`/context`、`/prompt-post-processing`、`/custom-stop-strings`、`/sysprompt*` 不再各自漂浮在独立 localStorage key 上。
  - `/model` 的默认宿主也改为直连 `model-store`，避免脚本路径与产品路径分叉。
- `app/session/page.tsx` 的真实 slash 宿主已补齐 prompt 相关回调：聊天页面中的 slash 输入与脚本桥宿主现在操作同一批 Prompt 行为状态。
- `components/prompt-config/PromptBehaviorPanel.tsx` 已接入 `AdvancedSettingsEditor`，提供可见的 Prompt 行为产品面：
  - 当前预设切换
  - instruct 开关与模板
  - context preset 选择与 story string 编辑
  - sysprompt 开关、名称、system content、post-history content
  - stop strings 与 prompt post-processing
  - 最终生效配置摘要
- `function/dialogue/chat.ts` / `chat-streaming.ts` / `chat-shared.ts` / `DialogueWorkflow` / `PresetNode` / `LLMNode` 已补齐 Prompt 行为运行时透传：
  - instruct 通过 post-processing 真正影响最终 messages 结构
  - sysprompt 真正进入 prompt 构建
  - custom stop strings 真正进入 OpenAI / Claude / Ollama / Gemini 调用
  - context preset 在非默认模板下会生成额外 story string 注入
- `Prompt Viewer` 已显示本次请求最终生效配置，便于验证 preset / instruct / context / sysprompt / stop strings / post-processing 的真实落点。
- ST preset 导入链路现已保留 `context` / `sysprompt` 结构，不再只保存 prompts 与 sampling。

## Phase 2 验证（2026-03-09）

- `pnpm vitest run function/dialogue/__tests__/chat-first-message.test.ts lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts lib/workflow/__tests__/dialogue-workflow-validation.test.ts components/__tests__/PromptViewerModal.test.tsx lib/core/__tests__/st-prompt-manager.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm verify:stage`

## Phase 2 新增/更新测试覆盖

- `function/dialogue/__tests__/chat-first-message.test.ts`：断言真实聊天入口在 Phase 2 之后仍保持模型参数透传，并兼容新的 prompt runtime 注入。
- `lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts`：断言 `/sysprompt*` 命令簇与新的 prompt-config 状态源保持一致。
- `lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts`：验证 `/prompt-post-processing` 命令继续可用，并已接入统一状态源。
- `lib/workflow/__tests__/dialogue-workflow-validation.test.ts`：继续覆盖工作流字段流转，确保 Phase 2 新字段没有破坏原有节点顺序与参数闭环。
- `components/__tests__/PromptViewerModal.test.tsx`：确认 Prompt Viewer 弹窗仍可正常渲染，并兼容新的最终生效配置展示。
- `lib/core/__tests__/st-prompt-manager.test.ts`：回归验证 marker 行为未被 Phase 2 的 context product surface 改坏。

## Phase 2 仍需注意

- 当前 context preset 先提供了最小产品面与真实 runtime 注入，但仍只内建了少量模板；后续如果要进一步对齐上游，需要补齐更完整的 preset 集和更细粒度的 story_string 布局控制。
- Prompt Viewer 现在已经展示最终生效配置，但仍然是“摘要视图”；若后续需要做作者级调试，还可以继续扩展为逐来源 diff。


## Phase 2 Review Fix-up（2026-03-11）

- 已根据最新 review 继续修复 3 个确认成立/部分成立的问题：
  - `lib/prompt-config/service.ts`：`getActivePromptPreset()` 不再盲信 `prompt-config-store` 中缓存的 `activePresetId`；若该 preset 在持久层里已被禁用，会自动回退到当前真正启用的 preset，并同步修正 store，避免 `handleCharacterChatRequest()` 与 `PresetNodeTools.loadUserEnabledPreset()` 读取到不同 preset。
  - `lib/nodeflow/PresetNode/PresetNodeTools.ts`：对于导入 context preset 中当前尚未支持的 `story_string_position` / `story_string_depth` 组合，改为显式 fail-fast；不再静默 `unshift` 到消息最前面，避免悄悄篡改上游 placement 语义。
  - `lib/api/backends.ts`：`AnthropicClient.chatStream()` 已补齐 `stop_sequences: params.stop`，使 Claude 的 stop strings 在非流式与流式路径上保持一致。
- 已新增定向回归测试：
  - `lib/prompt-config/__tests__/service.test.ts`：断言缓存 preset 已禁用时，会回退到真正 active preset 并同步 store。
  - `lib/nodeflow/__tests__/preset-node.test.ts`：断言非默认 context placement 当前会显式 fail-fast，而不是静默降级。
  - `lib/api/__tests__/backends.test.ts`：断言 `AnthropicClient.chatStream()` 会发送 `stop_sequences`。
- 本轮验证结果：
  - `pnpm vitest run lib/prompt-config/__tests__/service.test.ts lib/nodeflow/__tests__/preset-node.test.ts lib/api/__tests__/backends.test.ts function/dialogue/__tests__/chat-first-message.test.ts lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm verify:stage`
- 上述命令均已通过；当前 Phase 2 在这轮 review 提出的状态一致性、context placement 保护、Claude stop strings 一致性问题上已形成闭环。


## Phase 3 Batch 1 已完成内容（2026-03-11）

- `/session` 已接入第一批 Quick Reply 宿主能力：`/qr`、`/qr-set*`、`/qr-chat-set*`、`/qr-list`、`/qr-get`、`/qr-create`、`/qr-update`、`/qr-delete`、`/qr-context*`、`/qr-set-create|update|delete` 现在都走真实页面状态，而不是只停留在 slash/bridge 空接口。
- 新增 `lib/quick-reply/store.ts`，把 Quick Reply 集合定义、全局/会话启用状态、上下文集合绑定、`nosend` 行为收口到单一状态源，并通过持久化保存。
- 新增 `components/quick-reply/QuickReplyPanel.tsx`，在真实聊天输入区提供最小产品面：可见按钮带、集合创建、集合启停、会话级启用、回复创建与删除。
- Quick Reply 执行链路已对齐真实 `/session` 行为：普通文本会直接发送；`nosend` 集合会回填输入框；以 `/` 开头的回复会继续通过当前 slash 宿主执行；context set 绑定会在执行时激活对应会话集合。
- `CharacterChatPanel` 已开放 `footerSlot`，避免把 Quick Reply 逻辑硬塞进控制面板，保持输入区扩展点单一而直白。

## Phase 3 Batch 1 验证（2026-03-11）

- `pnpm vitest run lib/quick-reply/__tests__/store.test.ts components/__tests__/QuickReplyPanel.test.tsx app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm lint`


## Phase 3 Batch 2 已完成内容（2026-03-12）

- 新增 `lib/group-chat/store.ts`，把群聊成员状态按 `dialogueId` 收口到单一持久化状态源，当前最小模型覆盖：成员查看、成员加入/移除、成员启停、成员顺序调整，以及 slash 所需的 `name/index/id/avatar` 字段读取。
- `/session` 真实 slash 宿主已接通群成员链路：`/member-add`、`/member-remove`、`/member-up`、`/member-down`、`/member-peek`、`/member-count`、`/member-get`、`/disable`、`/enable` 现在会直接命中真实页面状态，而不是只停留在命令层 mock callback。
- 新增 `components/group-chat/GroupMemberPanel.tsx`，在聊天输入区旁提供最小产品面：成员列表、启用/停用、上移/下移、加入/移除；与 Quick Reply 并排作为 `/session` 的编排入口。
- `app/session/page.tsx` 与 `components/CharacterChatPanel.tsx` 已继续补齐群聊宿主回调透传，确保页面 slash 输入和角色脚本桥共享同一组群成员状态。

## Phase 3 Batch 2 验证（2026-03-12）

- `pnpm vitest run lib/group-chat/__tests__/store.test.ts components/__tests__/GroupMemberPanel.test.tsx app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm lint`


## Phase 3 Batch 3 已完成内容（2026-03-12）

- 新增 `lib/checkpoint/store.ts`，把 `/checkpoint-*` 与 `/branch-create` 从 slash handler 内部临时内存态提升为按 `dialogueId` 持久化的真实宿主状态，覆盖 checkpoint 建立、branch 建立、当前分支、父会话与消息到 checkpoint 的绑定。
- `lib/slash-command/registry/handlers/core.ts` 现已优先使用宿主注入的 checkpoint / branch 回调；`/session` 路径下这些命令不再只依赖命令层局部 `Map`，而是命中真实页面状态。
- `app/session/page.tsx` 已补齐 checkpoint 宿主实现：`/branch-create`、`/checkpoint-create|get|list|go|exit|parent` 现在都通过 `useCheckpointStore` 工作；`/swipe` 也已通过页面集成测试确认继续走真实 `dialogue.handleSwipe` 宿主。
- 新增 `components/checkpoint/CheckpointPanel.tsx`，在聊天输入区旁展示当前分支与已挂接的 checkpoint 列表，避免这批能力继续停留在纯 slash 黑盒里。
- `components/CharacterChatPanel.tsx`、`hooks/useScriptBridge.ts`、`hooks/script-bridge/slash-context-adapter.ts` 已继续透传 checkpoint / branch 宿主回调，保证页面 slash 路径与脚本桥共享同一组会话编排状态。

## Phase 3 Batch 3 验证（2026-03-12）

- `pnpm vitest run lib/checkpoint/__tests__/store.test.ts components/__tests__/CheckpointPanel.test.tsx app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
