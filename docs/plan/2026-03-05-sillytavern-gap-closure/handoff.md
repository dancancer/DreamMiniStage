# Handoff（2026-03-06）

## 本轮完成

- 补齐 10 个 slash 命令缺口：`/sd`、`/sd-source`、`/sd-style`、`/speak`、`/tts`、`/qrset`、`/summarize`、`/start-reply-with`、`/reroll-pick`、`/test`。
- 别名命令全部收口到已有单路径：`/sd*` 复用 `imagine`/image config，`/speak|/tts` 复用 `narrateText`，`/qrset` 复用 `qr-set`，避免再造第二套分支。
- 新增低耦合运行时实现：`/summarize` 直接复用 `generateRaw` 做文本/当前聊天摘要；`/start-reply-with` 统一落 `localStorage`；`/reroll-pick` 以 `dialogueId` 为作用域持久化 reroll seed；`/test` 复用现有 regex 解析器返回 ST 对齐的 `true|false` JSON 字符串。
- 扩展 Slash 执行上下文：`ExecutionContext` 补齐 `dialogueId`，并在 `hooks/script-bridge/slash-context-adapter.ts` 透传，避免 `/reroll-pick` 退化成全局状态。
- 新增/扩展测试：
  - `lib/slash-command/__tests__/p3-summary-command-gaps.test.ts`：覆盖 `/summarize` 文本摘要、聊天回退与 fail-fast。
  - `lib/slash-command/__tests__/p3-chat-config-command-gaps.test.ts`：覆盖 `/start-reply-with`、`/reroll-pick` 的存储语义。
  - `lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts`：补齐 `sd*` 别名契约。
  - `lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts`：补齐 `/speak|/tts` 别名契约。
  - `lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts`：补齐 `/qrset` 兼容别名契约。
  - `lib/slash-command/__tests__/p2-operators.test.ts`：补齐 `/test` regex 布尔语义。
- gap report 已更新；本轮新增 10 个命令后，Top25 只剩 7 个命令：`floor-teleport`、`proxy`、`tempchat`、`translate`、`wi-get-timed-effect`、`wi-set-timed-effect`、`yt-script`。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts lib/slash-command/__tests__/p3-chat-config-command-gaps.test.ts lib/slash-command/__tests__/p3-summary-command-gaps.test.ts`：`6 files / 48 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-operators.test.ts lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts lib/slash-command/__tests__/p3-chat-config-command-gaps.test.ts lib/slash-command/__tests__/p3-summary-command-gaps.test.ts`：`18 files / 340 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`98.36%`（上一轮 `96.01%`，+`2.35`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`sd`、`sd-source`、`sd-style`、`speak`、`tts`、`qrset`、`summarize`、`start-reply-with`、`reroll-pick`、`test`

## 下一步建议

1. 继续优先收口 timed effect：`/wi-get-timed-effect`、`/wi-set-timed-effect`。这批命令仍然最需要守住“不要新造状态源”的约束，优先挂到现有 worldbook advanced runtime / chat turn 语义。
2. 用显式宿主回调吃掉剩余低耦合长尾：`/tempchat`、`/proxy`、`/yt-script`、`/translate`。这四个命令都不值得在 Slash 层伪造 UI 或网络副作用，应该直接暴露宿主接口。
3. 如果想尽快把 slash coverage 顶到 99%+，下一轮就做“2 + 1”组合：先拿掉 `tempchat/proxy/yt-script` 三个薄命令，再集中处理 timed effect 这一块深水区。
