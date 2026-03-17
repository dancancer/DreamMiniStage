# Handoff（2026-03-08）

## Phase 4 Unified Runtime Refactor 已完成（2026-03-17）

- Phase 4 当前不应再被理解为“仅剩导入语义和迁移样例补齐”的状态；这一轮已经继续完成了对话生成主链路的统一运行时收敛。
- 已落地的主收敛项：
  - `lib/generation-runtime/` 已成为单一路径运行时，负责 `prepare -> model execution -> postprocess -> sink emission`。
  - `function/dialogue/chat.ts` 与 `function/dialogue/chat-streaming.ts` 已收敛为薄适配层；`preparedExecution -> buffered/SSE response` 由统一出口负责。
  - `lib/nodeflow/LLMNode/LLMNodeTools.ts` / `model-invokers.ts` 已去掉大块重复 OpenAI 兼容调用逻辑，并拆出：
    - `llm-config.ts`
    - `runtime-helpers.ts`
    - `function-calling.ts`
    - `tool-call-runtime.ts`
  - `hooks/script-bridge/slash-handlers.ts` 不再提前冻结整串 slash 的 ST env 宏；宏展开已下沉到执行边界。
  - `components/MessageBubble.tsx` / `components/character-chat/MessageItem.tsx` 已切到显式 render phase（`preview / transition / parsed`），避免流式结束后出现短暂空白。
  - `lib/store/dialogue-store/actions/` 已按职责拆成：
    - `generation-actions.ts`
    - `generation-request-runtime.ts`
    - `generation-event-state.ts`
    - `dialogue-snapshot-state.ts`
    - `dialogue-status-state.ts`
    - `dialogue-event-emitter.ts`
- 已删除的历史壳层/伪语义：
  - `ModelExecutionMode`
  - `lib/generation-runtime/model/execution-mode.ts`
  - `lib/generation-runtime/result.ts`
- 当前验证状态：
  - 最近一次 `pnpm verify:stage` 已通过
  - 当前全量约为 `210` 个测试文件、`1901` 个测试通过
- 对下一轮的建议：
  - 不再继续做 Phase 4 主骨架重构。
  - 下一轮若仍留在 Phase 4，应只做两类事：
    - 更真实的上游样本补强与迁移样例扩展
    - PR/评审整理、术语对齐、非阻塞历史文档收口
  - 若目标是新增产品能力，应切换到后续阶段，而不是继续把 Phase 4 当作 runtime 大改阶段。

## Phase 4 Batch 1 进行中（2026-03-15）

> 历史记录：本节保留 2026-03-15 当时的阶段日志；当前可执行现状请以前面的 `Phase 4 Unified Runtime Refactor 已完成（2026-03-17）` 为准。

- 已将 `docs/plans/2026-03-15-phase4-migration-semantics.md` 放回当前阶段分支，避免 Phase 4 执行计划只存在于旧 worktree 的未跟踪文件里。
- 已新增 `lib/import/migration-semantics/`，把 Persona / WorldBook / Regex 的 `retained / ignored / downgraded / manual-review` 语义收口到单一路径：
  - `types.ts`：定义材料类型、字段状态与导入语义摘要结构。
  - `phase4-checklist.ts`：声明 Phase 4 第一批字段规则，明确哪些语义保留、降级或需要人工复核。
  - `report.ts`：把字段列表归并为 UI 可消费的语义分桶结果。
- 已新增 `lib/import/migration-semantics/__tests__/phase4-checklist.test.ts`，验证：
  - `worldbook.useProbability` / `worldbook.groupWeight` 的语义状态是显式声明的。
  - 语义摘要会把未知或未直连的字段归入 `manualReview`，而不是静默吞掉。
- 已新增 `lib/core/__tests__/fixtures/phase4/` 下的 committed fixtures，并把 Phase 4 相关基线测试从本地未跟踪 `test-baseline-assets/` 迁移到仓库内可复现素材：
  - `persona-macro.json`
  - `worldbook-import.json`
  - `regex-flow.json`
- 当前已完成的定向验证：
  - `pnpm vitest run lib/core/__tests__/prompt-assembly.regression.test.ts lib/core/__tests__/st-baseline-worldbook-material.test.ts`
  - `pnpm vitest run lib/import/migration-semantics/__tests__/phase4-checklist.test.ts`
- 下一步只继续推进 Phase 4 Batch 1 的第三项：用更窄的 Persona / WorldBook / Regex 基线测试锁定组合顺序，再决定生产代码是否需要最小修补。

## Phase 4 Batch 1 已完成（2026-03-15）

> 历史记录：本节描述的是 2026-03-15 时点完成的 Batch 1 范围；当前 Phase 4 总体状态与下一轮建议，以上方 2026-03-17 收口说明为准。

- 已补齐 Phase 4 的结构化导入报告能力：
  - `components/import-modal/ImportResultDisplay.tsx` 现支持 `retained / ignored / downgraded / manualReview / notes` 语义分桶。
  - `components/__tests__/ImportResultDisplay.test.tsx` 断言语义分桶由结构化数据驱动渲染，而不是靠硬编码文案。
  - `components/import-modal/index.ts`、`components/import-modal/README.md` 已同步导出与记录新的 `ImportResultSemantics`。
- Phase 4 相关导入产品面现已接入语义摘要：
  - `components/ImportWorldBookModal.tsx`：导入成功后展示 WorldBook Phase 4 迁移语义。
  - `components/ImportRegexScriptModal.tsx`：批量导入与全局导入成功后展示 Regex Phase 4 迁移语义。
  - `components/ImportPresetModal.tsx`：统一切到共享 `ImportResultDisplay`，导入结果结构不再漂浮为局部定制类型。
  - `components/ImportCharacterModal.tsx`：导入角色后会按角色内含 `worldbook / regex` 资源聚合语义说明。
- Persona / WorldBook / Regex 组合顺序已由更窄的新基线测试锁住：
  - `lib/core/__tests__/phase4-persona-macro-baseline.test.ts`
  - `lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts`
  - `lib/core/__tests__/phase4-regex-flow-baseline.test.ts`
  - `lib/core/__tests__/dialogue-flow-test-helpers.ts`
- 为了让 Persona 语义不被“临时激活 Persona”污染，`hooks/useCurrentPersona.ts` 已新增按 `dialogueKey + characterId` 解析的静态 helper：
  - `getPersonaDisplayNameForDialogue()`
  - `getPersonaDescriptionForDialogue()`
- 本轮聚合验证结果：
  - `pnpm vitest run lib/import/migration-semantics/__tests__/phase4-checklist.test.ts lib/core/__tests__/phase4-persona-macro-baseline.test.ts lib/core/__tests__/phase4-worldbook-migration-baseline.test.ts lib/core/__tests__/phase4-regex-flow-baseline.test.ts components/__tests__/ImportResultDisplay.test.tsx`
  - 结果：5 个文件、6 个测试全部通过。
- 本轮阶段门验证结果：
  - `pnpm verify:stage`
  - 结果：`lint` / `typecheck` / `vitest run` / `build` 全部通过。
- 现阶段结论：
  - Phase 4 Batch 1 已完成“可复现素材、迁移语义单一事实源、组合链基线测试、结构化导入语义报告”这四个目标。
  - 后续若继续扩展 Phase 4，更应该补的是更真实的上游样本覆盖与更细粒度的 UI 表达，而不是再发散新的隐式语义路径。

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


## Phase 3 Batch 4 Fix-up 已完成内容（2026-03-12）

- `app/session/page.tsx` 已把 Quick Reply 的执行优先级继续收紧为 `nosend -> inject -> slash/plain message`；`inject` 集合现在会写入真实 prompt injection 宿主，而不是误落成聊天消息。
- `lib/quick-reply/store.ts` 已新增单点可见集合解析；同一集合若同时在 `global/chat` 激活，会以 chat 作用域覆盖 global，避免按钮重复与执行目标漂移。
- `components/quick-reply/QuickReplyPanel.tsx` 已改为直接复用 store 的可见回复结果，产品面与 slash 执行看到的是同一批 Quick Reply。
- `lib/group-chat/store.ts` 已拆分群成员 `name` / `id` 查找规则：用户输入优先命中显示名称，仅在无同名成员时才回退到内部 id；名称唯一性检查也只针对显示名称，避免“成员名称撞上自动 id”时删错人。
- `tasks.md` 已同步更新：Phase 3 的“将相关宿主能力接入真实 `/session` 页面”现已完成，剩余未完成项收敛到 `message mutation / JSONL` 这批后续对齐工作。

## Phase 3 Batch 4 Fix-up 验证（2026-03-12）

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx components/__tests__/QuickReplyPanel.test.tsx lib/quick-reply/__tests__/store.test.ts components/__tests__/GroupMemberPanel.test.tsx lib/group-chat/__tests__/store.test.ts`

## Phase 3 Batch 4 新增/更新测试覆盖

- `app/session/__tests__/page.slash-integration.test.tsx`：断言 `/qr 0` 命中 `inject` 集合时，会写入 prompt injection store，且不会追加用户消息。
- `components/__tests__/QuickReplyPanel.test.tsx`：断言同一集合在 `global/chat` 双作用域同时启用时，面板不会渲染重复按钮。
- `lib/quick-reply/__tests__/store.test.ts`：断言可见 Quick Reply 解析会对同名集合去重，并让 chat 作用域覆盖 global。
- `components/__tests__/GroupMemberPanel.test.tsx`：断言当成员显示名称恰好等于另一成员的自动 id 文本时，移除操作仍优先命中显示名称。
- `lib/group-chat/__tests__/store.test.ts`：断言群成员显示名称与内部 id 文本是两个不同概念，删除时不会把二者混为一谈。


## Phase 3 Batch 5 已完成内容（2026-03-12）

- `app/session/page.tsx` 已开始真实消费脚本桥接层的消息编辑事件：`DreamMiniStage:setChatMessages`、`DreamMiniStage:createChatMessages`、`DreamMiniStage:deleteChatMessages`、`DreamMiniStage:refreshOneMessage` 不再停留在 bridge 协议层，而是会落到当前 `/session` 的 `dialogue` 宿主状态。
- `setChatMessages` 现已按消息 `id` 单路径定位并更新当前页面消息；消息 id 不存在时显式 fail-fast，不做静默跳过。
- `createChatMessages` 现已把桥接层传入的 `role/content/id` 追加到真实页面消息数组；`deleteChatMessages` 现已按消息 id 删除当前会话消息。
- `refreshOneMessage` 当前先走最小真实宿主：定位当前页面消息，并将 assistant 消息转到现有 `dialogue.handleRegenerate()` 路径，避免事件继续在 `/session` 中被吞掉。
- 本轮完成后，Phase 3 剩余未对齐项进一步收敛到 `JSONL` 进出一致性；`message mutation` 已不再只是脚本桥接能力。

## Phase 3 Batch 5 验证（2026-03-12）

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/message-handlers-compat.test.ts app/session/__tests__/session-host-bridge.test.ts`

## Phase 3 Batch 5 新增/更新测试覆盖

- `app/session/__tests__/page.slash-integration.test.tsx`：断言 `/session` 页面会真实消费 `setChatMessages/createChatMessages/deleteChatMessages/refreshOneMessage` 四类事件，而不是只保留桥接层协议。


## Phase 3 当前交接状态（2026-03-12）

- 当前 `/session` 宿主侧已经完成的闭环包括：Quick Reply、group members、checkpoint / branch、message mutation。Phase 3 剩余主缺口已经明确收敛到 `JSONL` 进出一致性，不建议在这一阶段再横向扩散到别的产品面。
- `message mutation` 这轮已确认不是“桥接层可调用、页面没响应”的假闭环：`setChatMessages`、`createChatMessages`、`deleteChatMessages`、`refreshOneMessage` 已有真实页面回归保护，相关事件会命中 `dialogue` 宿主状态。
- 本轮在执行 `pnpm verify:stage` 时额外暴露出一条与当前功能无关但会阻塞阶段门的属性测试问题：`lib/core/__tests__/trim-string-filter.property.test.ts` 中某条 property 把 `_` 同时当分隔符和可生成 pattern，导致断言自身不成立。该问题已通过收紧生成器（禁止 pattern 含 `_`）修复；生产代码未改动。
- 最新阶段门证据已经重跑且通过：
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/message-handlers-compat.test.ts app/session/__tests__/session-host-bridge.test.ts`
  - `pnpm verify:stage`
  - 结果：`lint` / `typecheck` / `vitest run` / `build` 全部通过

## Phase 3 下一步建议（2026-03-12）

- 下一批工作建议只聚焦 `JSONL` 进出一致性，不再并行掺入新的 slash 宿主能力。
- 当前最值得优先核对的 JSONL 差距不是“能不能导入导出”，而是“导入后保留下来的 metadata / chat_metadata / swipe 语义，是否会在后续导出中继续稳定表达”。
- 现状判断：
  - `hooks/useCharacterDialogue.ts` 已把 `导入 JSONL / 导出 JSONL` 接到真实 `/session` 控制面。
  - `function/dialogue/jsonl.ts` 与 `lib/dialogue/jsonl.ts` 已支持核心聊天结构与 swipe。
  - 但 [CHAT_JSONL_IMPORT_EXPORT.md](/Users/xupeng/mycode/DreamMiniStage/docs/CHAT_JSONL_IMPORT_EXPORT.md) 仍明确写着“导出时目前不回填到 JSONL（只导出核心字段）”，这正是路线图里还未收口的差距。
- 推荐下一轮直接围绕这条差距做最小闭环：
  - 先补 round-trip 定向测试
  - 再决定保留哪些 metadata 字段进入导出
  - 最后更新文档与阶段任务状态


## Phase 3 Batch 6 已完成内容（2026-03-12）

- `lib/dialogue/jsonl.ts` 已补齐 JSONL round-trip 的单路径保留逻辑：根 header 会从 `root.extra.jsonl_metadata` 回填原始 metadata，并继续以当前运行时 `chat_metadata` 为准覆盖导出结果。
- turn 节点现在会在导入时把 user / assistant 两侧各自的 JSONL 扩展字段收口到 `extra.jsonl_message`；后续导出会按原始消息位置回填，不再只输出核心 `mes/is_user/swipes` 字段。
- 旧数据路径也保持单路收敛：若历史树节点里只有顶层 assistant `extra`，导出仍会将其视为 assistant 侧 JSONL 扩展字段，避免已经导入过的会话再次导出时继续丢字段。
- `docs/CHAT_JSONL_IMPORT_EXPORT.md` 与 `tasks.md` 已同步更新；Phase 3 的 `swipe / branch / message mutation / JSONL` 对齐项现已全部收口。

## Phase 3 Batch 6 验证（2026-03-12）

- `pnpm vitest run lib/dialogue/__tests__/swipe-jsonl.test.ts`

## Phase 3 Batch 6 新增/更新测试覆盖

- `lib/dialogue/__tests__/swipe-jsonl.test.ts`：断言带有 `create_date/scenario/chat_metadata` 的 header，以及 `name/send_date/extra` 等消息扩展字段，在 `import -> export` 后保持稳定表达，不再被导出链路吞掉。

## Phase 3 Review 结论（2026-03-12）

- 正式阶段 review 已补齐，见 `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-review-result.md`。
- review 结论不是 “Phase 3 仍有功能缺口”，而是 “Phase 3 功能闭环已完成，阶段流程尚未收口”。
- 当前方向校准：
  - 不再把 slash/bridge 可调用误当成产品能力完成。
  - `/session` 真实宿主闭环是本阶段真正的交付，不建议继续横向扩展新的 Phase 3 能力。
- 当前问题清单：
  - 工作区尚未整理成最终提交边界。
  - 本地无 `gh`，PR 创建状态无法直接核验。
  - 在 PR 合入前，不应启动下一阶段实现。
- 剩余优先级重排：
  1. 整理当前变更集并形成清晰提交边界。
  2. 基于 `codex/phase-3-session-quickreply` 提交 PR。
  3. PR 合入 `main` 后，再从最新主干切下一阶段分支。
- 下一阶段目标建议改为优先推进 `Phase 5：JS-Slash-Runner 宿主完成度`，继续沿用“真实宿主责任边界”而不是“命令覆盖率”思路。

## Phase 3 PR 收尾清单（2026-03-12）

- 已新增 `docs/plan/2026-03-08-sillytavern-product-roadmap/phase3-pr-closeout.md`，集中记录：
  - 当前分支事实
  - 已通过的验证命令
  - 工作区文件分类
  - 建议的提交边界
  - PR 标题/描述骨架
- 当前剩余工作已经明确收敛为工程流程，不再是功能开发：
  - 整理提交
  - 提交 PR
  - 等待合入
  - 从最新 `main` 重开下一阶段分支

## Phase 5 Batch 1 已完成内容（2026-03-12）

- 已在 `codex/phase-5-js-slash-runner-host` 分支启动下一阶段，并使用独立 worktree 推进当前批次。
- 新增 `hooks/script-bridge/host-capability-matrix.ts`，把 `JS-Slash-Runner` 首批宿主能力切片的产品语义收口为单一事实源；当前覆盖：
  - `tool-registration`
  - `extension-state`
  - `clipboard`
  - `audio`
- 新增 `hooks/script-bridge/host-debug-resolver.ts` 与 `hooks/script-bridge/host-debug-state.ts`，把“默认支持 / 条件支持 / fail-fast”解析与最近 API 观察、运行时计数收口到最小调试状态层。
- `hooks/script-bridge/index.ts` 与 `hooks/useScriptBridge.ts` 现已接通首批 host-debug 观察路径：
  - 高价值 API 调用会记录 `method / capability / resolvedPath / outcome / timestamp`
  - 运行时会同步 `toolRegistrations / eventListeners / hasHostOverrides`
- `components/ScriptDebugPanel.tsx` 已从“只看脚本状态”升级为四段式最小宿主调试面板：
  - `Host Capability`
  - `Recent API Calls`
  - `Runtime State`
  - `Script Status`
- `/session` 级验证已补齐两类口径：
  - `app/session/__tests__/session-host-bridge.test.ts`：显式验证 `default / conditional / fail-fast` 三类宿主语义
  - `app/session/__tests__/page.slash-integration.test.tsx`：验证真实页面会把 `hostDebug` payload 传入 `ScriptDebugPanel`
- `app/test-script-runner/scenarios.ts` 已同步更新首批场景描述，明确 `tool registration` 与 `audio` 当前属于默认宿主路径。

## Phase 5 Batch 1 验证（2026-03-12）

- `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/host-debug-resolver.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
- `pnpm vitest run components/__tests__/ScriptDebugPanel.test.tsx`
- `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`

## Phase 5 Batch 1 当前边界（2026-03-12）

- 本轮只完成了首批切片的宿主语义建模与调试可视化，不宣称整个 Phase 5 已收口。
- 仍待后续批次继续推进的项包括：
  - 更大范围的高价值宿主产品路径拉通
  - 更完整的默认支持 / 条件支持 / 显式不支持清单
  - 把 batch 1 的调试状态继续扩到更多 `JS-Slash-Runner` 能力域

## Phase 5 Batch 2 已完成内容（2026-03-13）

- `app/session/session-host-bridge.ts` 已把 `/session` 宿主协议继续扩到 `clipboard / extension-state`：
  - `getClipboardText`
  - `setClipboardText`
  - `isExtensionInstalled`
  - `getExtensionEnabledState`
  - `setExtensionEnabled`
- `app/session/session-host-defaults.ts` 已补齐默认 clipboard 宿主：
  - 读写统一走浏览器 `navigator.clipboard`
  - 浏览器能力缺失时显式 fail-fast
- `app/session/session-host-defaults.ts` 已补齐 `extension-state / extension-exists` 默认读路径：
  - 统一从 `window.pluginRegistry` 读取安装态与 enabled 状态
  - 读路径默认可用
  - 写路径仍不伪装成默认支持，继续保留为条件支持
- `app/session/page.tsx` 现已把这批能力同时接入两条真实产品路径：
  - 页面 slash 宿主执行链
  - `CharacterChatPanel -> useScriptBridge -> ApiCallContext` 的脚本桥宿主执行链
- `hooks/script-bridge/slash-context-adapter.ts` 已移除 extension-state 对隐式 `window.pluginRegistry` 的兜底读取；extension 相关能力现在只消费显式注入回调，避免再次形成第二条隐藏宿主路径。
- `hooks/script-bridge/host-capability-matrix.ts` / `host-debug-resolver.ts` / `index.ts` 已补齐 batch 2 所需的调试语义：
  - `extension-state` 读路径与写路径拆成两个 capability 事实项
  - `triggerSlash("/clipboard-*")` / `triggerSlash("/extension-*")` 现会按 `session-default / api-context / fail-fast` 记录真实 resolved path
  - `triggerSlash` 返回 `isError=true` 时，也会作为 fail-fast 记录到 recent API calls
- `vitest.config.ts` 已排除 `**/.worktrees/**`，避免仓库内辅助 worktree 被主工作区测试误扫进来，污染阶段验证结果。

## Phase 5 Batch 2 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/session-host-defaults.test.ts app/session/__tests__/page.slash-integration.test.tsx hooks/script-bridge/__tests__/host-debug-resolver.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`

## Phase 5 当前边界（2026-03-13）

- 当前已真实拉通的 Phase 5 能力切片包括：
  - `tool-registration`
  - `audio`
  - `clipboard`
  - `extension-state` 读路径
  - `gallery`
- 当前仍明确保留为条件支持的项包括：
  - `extension-enable`
  - `extension-disable`
  - `extension-toggle`
- `app/session/session-host.ts` 已把 `/session` 默认宿主合并与高价值 callback wiring 从 `page.tsx` 中提炼出来；当前页面仍然很大，但至少宿主职责已不再和页面渲染逻辑继续硬缠在一起。
- `app/session/session-gallery.ts` + `components/session-gallery/SessionGalleryDialog.tsx` 已补齐 `gallery` 的最小真实宿主路径：
  - `/list-gallery` 可返回当前角色头像列表
  - `/show-gallery` 可在 `/session` 打开真实弹窗
  - 当前 `group gallery` 仍显式不支持，不做静默兼容
- `hooks/script-bridge/host-capability-matrix.ts` / `host-debug-resolver.ts` / `index.ts` 已继续扩展到 `gallery`：
  - `triggerSlash("/show-gallery|/list-gallery")` 会记录 `gallery-browser`
  - 默认路径当前解析为 `session-default`
- 本轮新增定向验证：
  - `app/session/__tests__/session-host.test.ts`
  - `components/__tests__/CharacterChatPanel.bridge.test.tsx`
  - `app/session/__tests__/page.slash-integration.test.tsx`
  - `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
- 这一批工作继续推进了“高价值宿主能力真实产品路径”与“默认 / 条件 / fail-fast 说明书”两个主目标，但还未覆盖更多命令域与更完整产品入口，因此不宣称整个 Phase 5 已完成。

## Phase 5 Batch 4 已完成内容（2026-03-13）

- `app/session/session-message-events.ts` 已把 `/session` 页面里那段高密度消息事件逻辑抽出：
  - `DreamMiniStage:setChatMessages`
  - `DreamMiniStage:createChatMessages`
  - `DreamMiniStage:deleteChatMessages`
  - `DreamMiniStage:refreshOneMessage`
- `app/session/page.tsx` 当前只负责注册/注销浏览器事件，消息补丁与刷新语义已经不再埋在页面组件里。
- `app/session/session-gallery.ts` 已继续从“只返回 avatar”推进到“avatar + 会话消息里的图片链接”：
  - 支持 Markdown 图片语法 `![alt](url)`
  - 支持常见图片扩展名直链 `png/jpg/jpeg/gif/webp`
  - 继续去重，避免同一素材重复出现在画廊里
- 本轮新增定向验证：
  - `app/session/__tests__/session-message-events.test.ts`
  - `app/session/__tests__/session-gallery.test.ts`

## Phase 5 Batch 4 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/session-message-events.test.ts app/session/__tests__/session-gallery.test.ts app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-host.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`

## Phase 5 Batch 5 已完成内容（2026-03-13）

- `app/session/session-store-hosts.ts` 已把 `/session` 里依赖 store 的 slash host 再拆出一层：
  - `checkpoint-*`
  - `member-*`
  - `wi-get-timed-effect`
  - `wi-set-timed-effect`
- `app/session/page.tsx` 当前这批能力已改为复用 `createSessionStoreHostCallbacks()`，不再保留页面内那串重复的 `useCallback + sessionId fail-fast + store.getState()` 实现。
- `app/session/session-gallery.ts` 已继续从“avatar + chat messages”推进到：
  - avatar
  - opening messages
  - chat messages
  三类来源统一去重后组成 `/list-gallery` 的真实素材集合。
- 本轮新增定向测试：
  - `app/session/__tests__/session-store-hosts.test.ts`
  - `app/session/__tests__/session-gallery.test.ts` 已扩到 opening messages 覆盖

## Phase 5 Batch 5 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/session-store-hosts.test.ts app/session/__tests__/session-gallery.test.ts app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-host.test.ts app/session/__tests__/session-message-events.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`

## Phase 5 当前边界（2026-03-13 更新）

- `page.tsx` 仍然偏大，但当前已经把三类高密度宿主逻辑分拆出页面：
  - `session-host.ts`
  - `session-message-events.ts`
  - `session-store-hosts.ts`
- `gallery` 当前已是真实产品路径，但素材范围仍只覆盖：
  - 当前角色 avatar
  - opening/chat 中直接可解析的图片 URL
- 还没有进入更完整的角色素材体系（例如表达包目录、更多静态资产枚举），因此不宣称 `gallery` 已完全产品化。

## Phase 5 Batch 6 已完成内容（2026-03-13）

- `app/session/page.tsx` 已进一步收口为入口壳，仅保留：
  - `Suspense`
  - loading fallback
  - `SessionPageContent` 装配
- 原 `/session` 页面主逻辑已下沉到 `app/session/session-page-content.tsx`，避免入口文件再次累积为巨石。
- 当前 `app/session/page.tsx` 行数已压回双位数级别，方便后续继续维护与 review。

## Phase 5 Batch 6 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-host.test.ts app/session/__tests__/session-message-events.test.ts app/session/__tests__/session-store-hosts.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx`

## Phase 5 Batch 7 已完成内容（2026-03-13）

- `app/session/session-slash-executor.ts` 已把 `/session` 内容页里的 slash 执行器整段抽出：
  - 变量读写与 scoped variable 语义
  - Quick Reply 的 `nosend / inject / slash / plain message` 分发
  - `ExecutionContext` 组装
- `app/session/session-content-view.tsx` 已把 `/session` 主视图切换抽成独立 router：
  - `chat`
  - `worldbook`
  - `preset`
  - `regex`
- 当前 `app/session/page.tsx` 继续保持入口壳，而 `app/session/session-page-content.tsx` 也进一步瘦身：
  - `page.tsx`：34 行
  - `session-page-content.tsx`：1032 行
  - 仍然偏大，但已不再同时承担“入口壳 + 内容编排 + slash 执行器 + 视图切换”四种职责
- 本轮新增定向测试：
  - `app/session/__tests__/session-slash-executor.test.ts`
  - `app/session/__tests__/session-content-view.test.tsx`

## Phase 5 Batch 7 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/session-content-view.test.tsx`

## Phase 5 Batch 8 已完成内容（2026-03-13）

- `app/session/session-page-content.tsx` 已不再承担“路由解析 + effect 注册 + 视图装配 + 动作中转”这几种职责的混合体，当前只保留状态编排与 guard：
  - `session-page-content.tsx`：230 行
  - `page.tsx`：34 行
- 新增 `app/session/use-session-route-state.ts`，把 `sessionId -> characterId / sessionError` 的加载与 fail-fast 逻辑收口为独立 route state hook。
- 新增 `app/session/use-session-page-effects.tsx`，把以下页面副作用从内容页抽离：
  - header top bar 装配
  - dialogueData -> 页面状态同步
  - preset 激活回填
  - display username 变更后的对话刷新
  - `DreamMiniStage:*ChatMessages` 消息事件注册
- 新增 `app/session/session-page-layout.tsx`，集中处理：
  - `SessionContentView`
  - `SessionChatView`
  - `WorldBookEditor / PresetEditor / RegexScriptEditor`
  - `LoginModal / DialogueTreeModal`
  - `CharacterChatPanel` 大量 props 的单点装配
- 新增 `app/session/session-dialogue-tree.ts`，把扁平消息转 `DialogueTree` 的快照构建从页面层提升为独立领域工具；`use-session-page-actions.ts` 不再从页面层回传这个 helper。
- 新增 `app/session/session-dialogue-actions.ts` 与 `app/session/session-quick-reply-store.ts`：
  - 前者收口 hide / unhide / force-save / reasoning 这批重复的对话动作
  - 后者收口 Quick Reply store -> slash executor 的适配
- `app/session/use-session-page-actions.ts` 已继续压回 371 行，不再在同一文件里重复实现消息隐藏、恢复、保存与 Quick Reply adapter。

## Phase 5 Batch 8 验证（2026-03-13）

- `pnpm lint`
- `pnpm typecheck`
- `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/session-content-view.test.tsx app/session/__tests__/session-navigation-actions.test.ts app/session/__tests__/session-host-actions.test.ts app/session/__tests__/session-chat-actions.test.ts`
- `pnpm verify:stage`

## Phase 5 Batch 9 已完成内容（2026-03-13）

- `hooks/script-bridge/host-capability-matrix.ts` 已从“首批切片矩阵”扩到当前 `/session` 已真实落地的高价值宿主能力：
  - `navigation`
  - `proxy`
  - `quick-reply`
  - `checkpoint`
  - `group-member`
  - `translation`
  - `youtube-transcript`
  - `timed-world-info`
- 上述能力现已与真实 slash 命令建立单一路径映射，不再只把 `clipboard / extension-state / gallery / audio` 视为唯一可观测宿主切片。
- `components/ScriptDebugPanel.tsx` 已同步改为展示更可审查的 capability 卡片：
  - capability id
  - area
  - host source
  - `hasProductEntry`
  - support level
- 这样 Phase 5 后续就不需要再靠口头判断“某条命令到底算默认支持还是已经有真实产品面”，调试面会直接反映矩阵中的单一事实源。

## Phase 5 Batch 9 验证（2026-03-13）

- `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts`
- `pnpm vitest run components/__tests__/ScriptDebugPanel.test.tsx`
- `pnpm lint`
- `pnpm typecheck`

## Phase 5 Batch 10 已完成内容（2026-03-13）

- `/session` 页面直输 slash 当前已不再绕过 host-debug：
  - 页面聊天输入中的 slash
  - `QuickReplyPanel` 触发的 `/qr`
  - iframe script bridge 的 `triggerSlash`
  现在都会写入同一份 host-debug 观察状态。
- 新增 `app/session/use-session-host-debug.ts`，把 `/session` 的 host-debug state / snapshot / sync 收口成共享控制器；`useScriptBridge` 不再私有持有另一份 recorder。
- `hooks/useScriptBridge.ts` 已改为消费外部注入的 host-debug state，并在 iframe API 调用后把快照同步回页面层。
- `app/session/session-slash-executor.ts` 已接入同一条 host-debug 记录链：
  - 直输 slash 会按 host capability matrix 解析能力
  - 会记录 `resolvedPath`
  - 会在 success / fail-fast 后刷新最近调用与 runtime state
- 本轮新增回归保护：
  - `app/session/__tests__/session-slash-executor.test.ts`
  - `app/session/__tests__/page.slash-integration.test.tsx`
  - `components/__tests__/CharacterChatPanel.bridge.test.tsx`

## Phase 5 Batch 10 验证（2026-03-13）

- `pnpm vitest run app/session/__tests__/session-slash-executor.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm verify:stage`

## Phase 5 Batch 11 已完成内容（2026-03-13）

- 新增 `hooks/script-bridge/default-ui-host.ts`，把这批默认 UI host 行为从 `slash-context-adapter.ts` 中提炼为共享实现：
  - `/popup`
  - `/buttons`
  - `/pick-icon`
  - `/is-mobile`
  - `/closechat`
  - `/bgcol`
  - `/bubble` / `/default` / `/single` / `/story`
- `app/session/session-slash-executor.ts` 已复用同一组默认 UI host，实现页面直输 slash 与 iframe script bridge 的行为一致；这批命令不再只在 bridge 路径可用。
- `hooks/script-bridge/host-capability-matrix.ts` 已继续纳入这批 bridge-only 宿主能力：
  - `ui-style`
  - `popup`
  - `device`
  - `chat-control`
- 当前 Script Debugger 现在既能解释 `/session` 默认路径，也能解释 bridge-only 默认 UI host 路径，不再把这批命令留在不可观测区。
- 本轮新增回归保护：
  - `app/session/__tests__/session-slash-executor.test.ts`
  - `app/session/__tests__/page.slash-integration.test.tsx`
  - `hooks/script-bridge/__tests__/host-capability-matrix.test.ts`
  - `hooks/script-bridge/__tests__/host-debug-resolver.test.ts`

## Phase 5 Batch 11 验证（2026-03-13）

- `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm verify:stage`

## Phase 5 Batch 12 已完成内容（2026-03-13）

- `hooks/script-bridge/default-ui-host.ts` 已继续扩到第二批默认 UI host：
  - `theme`
  - `movingui`
  - `css-var`
  - `panels`
  - `resetpanels`
  - `vn`
- `hooks/script-bridge/slash-context-adapter.ts` 与 `app/session/session-slash-executor.ts` 现已共用这组默认实现，避免 bridge 路径与页面直输 slash 再次分叉。
- `hooks/script-bridge/host-capability-matrix.ts` 已新增 `panel-layout` area，并把以下命令继续纳入统一能力矩阵：
  - `theme`
  - `movingui`
  - `css-var`
  - `panels`
  - `togglepanels`
  - `resetpanels`
  - `vn`
- `/session` 页面直输 slash 当前已能直接跑通：
  - `/theme light`
  - `/css-var varname=--session-accent amber`
  - `/panels`
  - `/resetpanels`
  - `/vn`
- 这样 Phase 5 当前已经不只是“消息/会话类宿主”闭环，连一批原本只在 bridge 默认路径可用的 UI 命令，也开始在 `/session` 页面输入框里共享同一实现与同一调试语义。

## Phase 5 Batch 12 验证（2026-03-13）

- `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm verify:stage`

## Phase 5 Batch 13 已完成内容（2026-03-13）

- `hooks/script-bridge/default-ui-host.ts` 已继续扩到背景命令默认实现：
  - `bg`
  - `lockbg`
  - `unlockbg`
  - `autobg`
- `hooks/script-bridge/slash-context-adapter.ts` 与 `app/session/session-slash-executor.ts` 现已继续共用这组背景默认 host；页面直输 slash 不再比 bridge 路径少一整块背景能力。
- `hooks/script-bridge/host-capability-matrix.ts` 已新增 `background` area，并把以下命令纳入统一观测：
  - `bg`
  - `background`
  - `lockbg`
  - `bglock`
  - `unlockbg`
  - `bgunlock`
  - `autobg`
  - `bgauto`
- `/session` 页面直输 slash 当前已能直接跑通：
  - `/bg forest`
  - `/lockbg`
  - `/unlockbg`
  - `/autobg`
- 到这里，Phase 5 中“bridge-only 默认 UI host 与 `/session` 页面输入框行为不一致”的大头已经基本收口；剩余问题更像个别命令域是否值得继续产品化，而不再是默认宿主骨架缺失。

## Phase 5 Batch 13 验证（2026-03-13）

- `pnpm vitest run hooks/script-bridge/__tests__/host-capability-matrix.test.ts hooks/script-bridge/__tests__/host-debug-resolver.test.ts app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/page.slash-integration.test.tsx`
- `pnpm typecheck`
- `pnpm verify:stage`

## Phase 5 总收束（2026-03-13）

- 已新增 Phase 5 总矩阵说明书：
  - `docs/plan/2026-03-08-sillytavern-product-roadmap/phase5-host-capability-matrix.md`
- 当前 Phase 5 已可明确分为三类：
  - 默认支持
  - 条件支持
  - 显式不支持
- 这份文档与 `hooks/script-bridge/host-capability-matrix.ts` / `host-debug-resolver.ts` 共同组成当前阶段的单一事实源，不再依赖零散 handoff 文字或口头判断。
- 基于当前矩阵与已完成的 Batch 1-13，`tasks.md` 中 Phase 5 的两个总项已正式勾掉：
  - `拉通高价值宿主能力的真实产品路径`
  - `明确哪些能力默认支持、条件支持、显式不支持`
- 后续若还要继续推进 Phase 5，不应再以“补更多命令覆盖率”为目标，而应只围绕：
  - 是否新增新的高价值能力域
  - 是否继续把当前显式不支持边界产品化
