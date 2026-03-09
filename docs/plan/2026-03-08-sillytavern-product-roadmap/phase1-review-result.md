# Review Report: `codex/phase-1-model-runtime`

- Review target: `codex/phase-1-model-runtime`
- Base branch: `main`
- Merge base: `06e556264664961120df144f53bdb65ba9b851bd`
- Review verdict: **patch is incorrect**

## Executive Summary

这批改动把模型高级参数、预设采样参数和上下文窗口裁剪统一收口到 runtime 层，方向是对的，结构上也比原先分散在页面和 Hook 中更干净。

但当前补丁存在 1 个明确回归和 2 个参数链路/边界实现问题：

1. `streaming` 的优先级被改坏，导致 script bridge 原本期待 JSON 的路径可能收到 SSE 响应并直接解析失败。
2. `timeout` 已进入 UI 和底层模型构造，但没有真正贯穿到对话 workflow，属于“表面可配、实际无效”。
3. `contextWindow` 裁剪函数在关键边界场景下不能真正保证输出不超预算，无法达到它宣称的保护作用。

因此，这个 patch 当前不建议直接合入。

## Validation Performed

已基于目标分支对比审查以下变更：

- `git diff 06e556264664961120df144f53bdb65ba9b851bd`

已执行验证：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm vitest run function/dialogue/__tests__/chat-first-message.test.ts lib/adapters/__tests__/preset-import.property.test.ts lib/slash-command/__tests__/p2-variable-scope.test.ts lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
- `pnpm build`

上述命令均通过，但通过不代表补丁正确；这里的问题属于行为回归和链路不完整，测试尚未完全覆盖。

## Findings

### [P1] Honor the per-request streaming flag before config defaults

- Location: `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:107`
- Related caller: `/Users/xupeng/mycode/DreamMiniStage/hooks/script-bridge/generation-handlers.ts:82`

#### Problem

`handleCharacterChatRequest()` 现在优先使用 `advanced.streaming` 推导 `effectiveStreaming`：

- `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:102`
- `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:107`

但 script bridge 仍然通过顶层 `streaming` 参数决定“这次请求是否应该按 JSON 返回”，并在收到响应后直接执行：

- `/Users/xupeng/mycode/DreamMiniStage/hooks/script-bridge/generation-handlers.ts:106`

也就是说，调用方显式没有请求流式时，只要当前激活配置里 `advanced.streaming === true`，服务端仍会切到 SSE 分支。

#### Impact

这会把原本非流式的 script-bridge `/generate` 调用从 JSON 响应变成 `text/event-stream` 响应，随后在 `response.json()` 处直接失败。

这是明确的行为回归，不依赖猜测，且会影响已有调用方。

#### Why This Should Be Fixed

这里混淆了两个层次：

- 顶层 `streaming`：调用协议层，决定调用方期待 JSON 还是 SSE
- `advanced.streaming`：模型执行层参数，决定底层模型是否尝试流式输出

协议层不应被配置默认值偷偷覆盖。显式请求应优先于会话默认值，否则就是破坏调用契约。

---

### [P2] Thread timeout through the dialogue workflow

- Location: `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:161`
- Related files:
  - `/Users/xupeng/mycode/DreamMiniStage/hooks/useModelSidebarConfig.ts:419`
  - `/Users/xupeng/mycode/DreamMiniStage/lib/nodeflow/LLMNode/LLMNodeTools.ts:487`

#### Problem

本次改动已经把 `timeout` 做进了 UI，并在模型测试路径中使用：

- `/Users/xupeng/mycode/DreamMiniStage/hooks/useModelSidebarConfig.ts:419`

底层 LLM 构造函数也已经支持 `timeout`：

- `/Users/xupeng/mycode/DreamMiniStage/lib/nodeflow/LLMNode/LLMNodeTools.ts:487`

但实际聊天请求并没有把这个参数传入 workflow：

- `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:151`
- `/Users/xupeng/mycode/DreamMiniStage/function/dialogue/chat.ts:455`

同时，`DialogueWorkflow` / `LLMNode` 的字段链路中也没有把 `timeout` 贯穿下去。

#### Impact

结果就是：

- “测试模型”时，超时参数生效
- 真正聊天生成时，超时参数不生效

这会让用户看到一个可配置、可保存、可测试，但实际主流程不起作用的参数。

#### Why This Should Be Fixed

这不是样式或抽象问题，而是功能语义不一致：同一个配置项在测试路径和真实路径上行为不同。对于“超时”这种控制故障边界的参数，这种不一致非常容易误导用户，也会让排障变得困难。

---

### [P2] Make context-window trimming actually enforce the budget

- Location: `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:302`

#### Problem

`applyContextWindowToMessages()` 目前有两个决定性的保留策略：

1. 永远保留所有 `system` 消息  
   `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:308`
2. 即使预算已经不够，也强制至少保留一条非 `system` 消息  
   `/Users/xupeng/mycode/DreamMiniStage/lib/model-runtime.ts:302`

这意味着在下面两种关键场景中，它并不能真的把结果裁到预算以内：

- `system` / preset prompt 本身已经吃光甚至超过预算
- 最新一条 user message 单条就超过剩余预算

#### Impact

函数名字和用途都在表达“基于 `contextWindow` 做输入裁剪”，但返回值在边界场景下仍可能超过预算，于是最应该被保护的场景仍然会触发 provider 的 context length error。

换句话说，这个 helper 在最重要的边界条件下并没有兑现自己的约束。

#### Why This Should Be Fixed

好品味不是“尽量裁剪”，而是“约束成立”。  
如果目标是“输入不得超过预算”，那返回结果就必须满足这个条件；否则调用方会以为自己已经被保护，实际仍然暴露在失败路径上。

## Overall Assessment

当前 patch 的核心问题不是“思路不对”，而是“承诺的行为没有真正闭合”：

- `streaming`：协议层与配置层耦合错位，造成回归
- `timeout`：入口和底层都支持，中间链路缺失
- `contextWindow`：有裁剪实现，但边界约束不成立

从架构角度看，这类问题都属于同一个本质：**参数被收口了，但没有完成从“配置存在”到“语义成立”的全链路闭环**。

因此当前结论仍然是：

> **patch is incorrect**

## Recommended Fix Order

1. 先修 `streaming` 优先级，保证显式请求优先于配置默认值
2. 再把 `timeout` 从 UI -> request -> workflow -> LLMNode 全链路打通
3. 最后重写 `applyContextWindowToMessages()`，让“返回结果不超预算”成为硬约束，而不是软倾向

## Final Verdict

**Do not merge in current form.**

至少应先修复以上 3 个问题中的第 1 个和第 2 个；第 3 个如果保留当前 `contextWindow` 功能对外可见，也应在合入前修正，否则这个功能会在最关键的边界场景下失效。

## Resolution Update（2026-03-09）

> 上文保留的是 review 当时对“未修复补丁”的结论；本节记录当前分支在修复后的实际状态。

- 本文列出的 3 个行为阻塞项均已在 `codex/phase-1-model-runtime` 当前工作树中修复：
  - 协议层 `streaming` 不再被配置默认值偷偷覆盖；配置级默认值由激活模型配置自身承担，调用协议仍由顶层请求参数决定。
  - `timeout` 已贯通真实聊天 workflow 与 Gemini 运行时路径，不再停留在“测试路径可配、主链路无效”。
  - `applyContextWindowToMessages()` 在长 system prompt / 超长最新 user turn 场景下已按硬约束裁剪到预算内。
- 同一轮 follow-up 中还一并完成了 code quality 修复：
  - `function/dialogue/chat.ts` 拆分为 `chat.ts`、`chat-shared.ts`、`chat-streaming.ts`
  - `hooks/useModelSidebarConfig.ts` 拆出 `helpers.ts`、`model-list.ts`、`test-model.ts`
  - `lib/nodeflow/LLMNode/model-invokers.ts` 的 Gemini MVU schema 提取到 `lib/mvu/function-call.ts`
  - `hooks/useApiConfig.ts` 的 stale closure 与空包装问题已清理
- 最新验证（2026-03-09）：
  - `pnpm vitest run lib/__tests__/model-runtime.test.ts hooks/__tests__/useModelSidebarConfig.helpers.test.ts hooks/character-dialogue/__tests__/useDialoguePreferences.test.ts function/dialogue/__tests__/chat-first-message.test.ts components/__tests__/CharacterChatPanel.bridge.test.tsx lib/workflow/__tests__/dialogue-workflow-validation.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm verify:stage`
- 当前状态：上述 review 中的阻塞项在本地已不可复现，且阶段质检门已再次通过。
