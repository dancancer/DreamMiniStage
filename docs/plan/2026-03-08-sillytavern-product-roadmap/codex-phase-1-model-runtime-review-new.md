# Review Report: `codex/phase-1-model-runtime`

- Review target: `codex/phase-1-model-runtime`
- Base branch: `main`
- Merge base: `06e556264664961120df144f53bdb65ba9b851bd`
- Overall correctness: **patch is incorrect**

## Executive Summary

这次审查基于 `git diff 06e556264664961120df144f53bdb65ba9b851bd` 对 `codex/phase-1-model-runtime` 做了逐项检查。

这批改动的方向是对的：它试图把模型高级参数、预设采样参数和上下文裁剪统一收口到 `lib/model-runtime.ts`，同时把参数链路从 UI 贯穿到 workflow/runtime。结构上比继续堆散落的 localStorage 读写更干净。

但当前补丁仍然有 4 个作者大概率会马上修的离散问题：

1. 聊天头部的流式开关已经和实际请求脱钩。
2. 模型高级设置复用了全局聊天流式开关的 localStorage key，造成状态互相污染。
3. `contextWindow <= maxTokens` 时会把 prompt 裁成空数组，直接导致 generation 失败。
4. 当前上下文裁剪策略可能在 system prompt 占满预算时丢掉最新用户输入。

这些都不是样式问题，而是会直接影响聊天行为正确性和用户预期的问题，因此当前结论仍然是：**不建议按现状合入**。

## Validation Performed

已执行并参考以下检查：

- `git diff 06e556264664961120df144f53bdb65ba9b851bd`
- `pnpm vitest run lib/__tests__/model-runtime.test.ts function/dialogue/__tests__/chat-first-message.test.ts lib/workflow/__tests__/dialogue-workflow-validation.test.ts lib/adapters/__tests__/preset-import.property.test.ts lib/slash-command/__tests__/p2-variable-scope.test.ts`

说明：现有测试通过，但这次发现的问题主要集中在状态联动和上下文裁剪边界上，测试尚未把这些回归完整兜住。

## Findings

### [P1] Keep the message header streaming toggle wired to requests

- Location: `/Users/xupeng/mycode/DreamMiniStage/lib/store/dialogue-store/actions/generation-actions.ts:98`

#### Problem

`components/CharacterChatPanel.tsx` 里的消息头部流式开关仍然写入 `streamingEnabled`，但当前发送链路已经改成只看 `llmParams.advanced`：

- `components/CharacterChatPanel.tsx:242`
- `components/CharacterChatPanel.tsx:363`
- `lib/store/dialogue-store/actions/generation-actions.ts:98`

也就是说，用户点击消息头部的“流式输出”开关，只会改本地 UI 偏好，不会改当前请求真正使用的 `advanced.streaming`。

#### Impact

普通发送、继续生成、重新生成这些路径，会继续沿用保存到模型配置里的 `advanced.streaming`，而不是用户刚刚在聊天界面切换的值。

用户会看到一个很直接的回归：明明刚把流式关掉或打开，下一条消息却没有按这个开关工作。

#### Why This Should Be Fixed

这里的问题本质不是“有两个开关”，而是“两个开关现在控制的不是同一个状态源”。

如果聊天头部保留为即时控制项，它就必须重新接到请求链路；否则 UI 会变成误导性的假开关。

---

### [P2] Don't reuse the global chat toggle key for config streaming

- Location: `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:58`

#### Problem

`ModelAdvancedSettings.streaming` 现在被持久化到 `streamingEnabled`：

- `lib/model-runtime.ts:58`

但这个 key 已经被 `CharacterChatPanel` 作为聊天界面的流式开关使用：

- `components/CharacterChatPanel.tsx:242`

与此同时，`syncModelConfigToStorage()` 会在保存配置、切换配置、初始化加载时反复写这个 key：

- `hooks/useModelSidebarConfig.ts:292`
- `hooks/useModelSidebarConfig.ts:347`
- `hooks/useModelSidebarConfig.ts:489`
- `hooks/useApiConfig.ts:193`

#### Impact

一旦用户切换模型、保存模型配置或刷新页面，当前激活配置里的 `advanced.streaming` 就会覆盖聊天头部的 `streamingEnabled`。

结果就是：用户以为自己设置的是聊天 UI 偏好，实际上这个值会被模型配置同步过程静默改写，造成“刚切模型，聊天开关自己跳了”的状态污染。

#### Why This Should Be Fixed

聊天即时偏好和模型配置默认值是两层不同语义，不能复用同一个持久化 key。

如果继续共用 key，就会把“会话/界面状态”和“模型配置状态”搅在一起，后续很难再判断谁才是事实源。

---

### [P1] Reject a zero input budget before dropping all messages

- Location: `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:337`

#### Problem

`applyContextWindowToMessages()` 在 `maxTokens >= contextWindow` 时会让：

- `availableInputBudget = 0`
- 直接返回空数组

位置在：

- `lib/model-runtime.ts:335`
- `lib/model-runtime.ts:337`

但 `LLMNode` 会把这个结果继续传给 `LLMNodeTools.invokeLLM()`，而后者明确要求 `messages[]` 非空：

- `lib/nodeflow/LLMNode/LLMNode.ts:65`
- `lib/nodeflow/LLMNode/LLMNodeTools.ts:224`

#### Impact

这意味着一个当前 UI 可以保存的高级参数组合，会把后续 generation 直接打成运行时错误：`messages[] is required for invokeLLM`。

也就是说，系统不是优雅地 clamp、校验失败或者给出配置错误，而是在真实请求阶段因为空 prompt 崩掉。

#### Why This Should Be Fixed

这是一个典型的边界条件没有被消灭，而是被推进到更深层炸掉的例子。

要么在保存/提交前 fail-fast，要么在裁剪层保证至少留下合法输入；当前这种“返回空数组交给下游报错”的行为既不稳，也不利于定位。

---

### [P1] Preserve the latest user turn when system prompts fill the budget

- Location: `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:354`

#### Problem

当前裁剪逻辑会先顺序保留 `system` 消息；一旦这些 system 消息已经把预算占满，就在这里提前返回：

- `lib/model-runtime.ts:344`
- `lib/model-runtime.ts:354`

这样一来，后面的逆序遍历根本没有机会去保留“最新 user / assistant 对话”。

#### Impact

当 preset/system prompt 很长，而 `contextWindow` 又比较小的时候，最终发给模型的 prompt 可能只剩 system，没有当前用户刚输入的最新消息。

这会造成非常糟糕的行为：模型还能回复，但回复会变得泛化、跑题或像没看到本轮输入一样。对用户来说，这是比直接报错更隐蔽的错误。

#### Why This Should Be Fixed

上下文裁剪的最低语义底线，是不能把“本轮用户输入”悄悄裁掉。

如果预算不足，优先级应该向最新用户回合倾斜，必要时继续压缩 system prompt，而不是在 system 占满预算后直接返回一个缺少当前用户输入的 prompt。

## Conclusion

这批改动在架构方向上是进步的，但当前还没有达到“可以安全合并”的状态。

建议先修掉上面 4 个问题，再补两类回归测试：

1. 聊天头部流式开关与模型高级设置之间的状态优先级测试。
2. `applyContextWindowToMessages()` 在极小预算、超长 system prompt、以及 `maxTokens >= contextWindow` 场景下的行为测试。
