# Handoff（2026-03-06）

## 本轮完成

- 已完成上一轮建议第 1、2 项：推理解析命令簇 + Quick Reply 第一批命令收敛。
- 新增推理解析命令：
  - `/reasoning-parse`
  - `/parse-reasoning`
- 新增 Quick Reply 第一批命令：
  - `/qr`
  - `/qr-list`
  - `/qr-get`
  - `/qr-create`
  - `/qr-delete`
- 语义对齐（单路径 + fail-fast）：
  - `/reasoning-parse|/parse-reasoning` 支持 `strict` / `return=reasoning|content` / `regex` 参数，默认 strict=true、regex=true。
  - `parseReasoningBlock` 宿主回调可覆写推理块提取；返回值契约强校验（必须含 `reasoning/content` 字符串字段）。
  - `applyReasoningRegex` 宿主回调用于 `regex=true` 时后处理；返回非字符串显式报错。
  - `/qr` 统一透传 `executeQuickReplyByIndex(index)`，索引参数严格整数校验。
  - `/qr-list` 统一透传 `listQuickReplies(set)`，返回值支持 `string[]` 或 `[{ label }]`，统一输出 JSON 标签数组。
  - `/qr-get` 统一透传 `getQuickReply(set, { label|id })`，支持 `id/label` 双定位，命中后返回 JSON。
  - `/qr-create` 统一透传 `createQuickReply(set, label, message, options)`，补齐 `showlabel/hidden/startup/user/bot/load/new/group/generation` 布尔参数强校验。
  - `/qr-delete` 统一透传 `deleteQuickReply(set, { label|id })`，支持命名/位置参数双路径。
- Slash 上下文透传扩展：
  - `ExecutionContext` 新增能力位：
    - `parseReasoningBlock` / `applyReasoningRegex`
    - `executeQuickReplyByIndex` / `listQuickReplies` / `getQuickReply` / `createQuickReply` / `deleteQuickReply`
  - `ApiCallContext` / `useScriptBridge` / `adaptSlashExecutionContext` 新增对应透传位：
    - `onParseReasoningBlock` / `onApplyReasoningRegex`
    - `onExecuteQuickReplyByIndex` / `onListQuickReplies` / `onGetQuickReply` / `onCreateQuickReply` / `onDeleteQuickReply`
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts`（10 tests），覆盖推理解析 strict/return/regex 语义、Quick Reply 第一批命令主路径、参数校验与 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `79.34%`（上一轮 `77.70%`，+`1.64`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`parse-reasoning`、`qr`、`qr-list`、`qr-get`、`qr-create`、`qr-delete`。
- `pnpm vitest run lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 13 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`14 files / 305 tests` 全通过。

## 下一步建议

1. 推进 Quick Reply 第二批命令（`/qr-set`、`/qr-set-on`、`/qr-set-off`、`/qr-chat-set`、`/qr-chat-set-on`、`/qr-chat-set-off`、`/qr-set-list`），优先复用本轮 set/label/id 参数解析和 fail-fast 模板。
2. 推进 Quick Reply 第三批命令（`/qr-update`、`/qr-contextadd`、`/qr-contextdel`、`/qr-contextclear`、`/qr-arg`），补齐 id 优先级与布尔参数契约测试。
3. 补齐低耦合剩余长尾（`/forcesave`、`/hide`、`/expression-upload`、`/proxy`），并维持每轮 gap 分析 + 定向回归闭环。
