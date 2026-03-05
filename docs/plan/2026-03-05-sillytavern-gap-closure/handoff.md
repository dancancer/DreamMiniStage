# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1、2、3 项：stop/model 长尾 + 群聊成员编排长尾 + `/name|/nar|/narrate` 最小闭环。
- 新增 stop/model/narrator 命令簇：
  - `/stop-strings`、`/stopping-strings`、`/custom-stopping-strings`、`/custom-stop-strings`
  - `/model`
  - `/name`、`/nar`、`/narrate`
- 新增群聊成员编排命令簇：
  - `/member-remove|/removemember|/memberremove`
  - `/member-up|/upmember|/memberup`
  - `/member-down|/downmember|/memberdown`
  - `/member-peek|/peek|/memberpeek|/peekmember`
- 语义对齐（单路径 + fail-fast）：
  - `custom-stop-strings*` 统一走 `getStopStrings/setStopStrings`；读取返回 JSON 数组字符串，设置严格要求 JSON 数组，`force=true` 允许强制清空。
  - `/model` 统一走 `getModel/setModel`；`quiet` 参数严格布尔解析，宿主返回值强制 string。
  - 成员编排命令统一走 `removeGroupMember/moveGroupMember/peekGroupMember`，并复用现有 target 解析与返回值契约校验。
  - `/narrate` 优先走 `narrateText(text, { voice })`；无宿主回调时回退到 `/sys` 单路径。
  - `/name` 作为 `/message-name` 语义别名接入（默认作用于末条消息）。
- Slash 上下文透传与默认实现补齐：
  - `ExecutionContext` 新增 `get/setStopStrings`、`get/setModel`、`narrateText`、`removeGroupMember`、`moveGroupMember`、`peekGroupMember`。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传位。
  - `slash-context-adapter` 为 `stop/model` 提供 localStorage 单路径默认实现（宿主未注入时仍可执行）。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts`（8 tests），覆盖 stop/model/member/narrator/name 命令主路径、别名与 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `70.66%`（上一轮 `65.73%`，+`4.93`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`custom-stop-strings*`、`member-(up|down|peek|remove)*`、`model/name/nar/narrate`。
- `pnpm vitest run lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts`：`1 file / 8 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`3 files / 35 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts`：`13 files / 300 tests` 全通过。

## 下一步建议

1. 推进 note 长尾命令簇（`/note`、`/note-depth`、`/note-frequency|/note-freq`、`/note-position|/note-pos`、`/note-role`），复用现有注入存储与 fail-fast 语义。
2. 推进 persona 长尾命令簇（`/persona`、`/persona-lock`、`/persona-set`、`/persona-sync`），复用已落地 `/lock|/bind` 的状态通道。
3. 为 `member-*/addswipe`、`data-bank-search` 与 `vector-worldinfo-state` 补端到端结果可见断言，继续收紧回归面。
