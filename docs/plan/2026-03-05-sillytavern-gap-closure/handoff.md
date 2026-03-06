# Handoff（2026-03-06）

## 本轮完成

- 已完成上一轮建议第 1、2 项：低耦合工具命令簇 + 导入/弹窗命令簇收敛。
- 新增工具命令：
  - `/dupe`
  - `/length`（`/len` 语义别名）
  - `/is-mobile`
  - `/newchat`
- 新增导入/弹窗命令：
  - `/import`
  - `/popup`
  - `/pick-icon`
- 语义对齐（单路径 + fail-fast）：
  - `/dupe` 统一走 `duplicateCharacter` 回调，宿主缺失显式报错。
  - `/newchat` 统一走 `createNewChat({ deleteCurrentChat })`，`delete` 参数严格布尔校验。
  - `/length` 统一映射到 `handleLen`，消除重复实现分支。
  - `/is-mobile` 统一走 `isMobileDevice` 回调；宿主未注入时降级为 user-agent 单路径检测。
  - `/import` 统一走 `importVariables(from, mappings)`，支持 `x as y` 映射，宿主返回值契约强校验（非负整数）。
  - `/popup` 支持 `scroll/large/wide/wider/transparent/okButton/cancelButton/result` 参数并透传 `showPopup`。
  - `/pick-icon` 统一走 `pickIcon`，取消返回 `"false"` 字符串对齐上游语义。
- Slash 上下文透传与默认实现补齐：
  - `ExecutionContext` 新增能力位：`duplicateCharacter`、`createNewChat`、`importVariables`、`showPopup`、`pickIcon`、`isMobileDevice`。
  - `ApiCallContext` / `useScriptBridge` / `adaptSlashExecutionContext` 新增对应透传位：`onDuplicateCharacter`、`onNewChat`、`onImportVariables`、`onShowPopup`、`onPickIcon`、`onIsMobile`。
  - `slash-context-adapter` 新增默认宿主实现：
    - `popup`：浏览器 `confirm/alert` 单路径默认回调。
    - `pick-icon`：浏览器 `prompt` 单路径默认回调。
    - `is-mobile`：UA 正则单路径检测。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-tooling-command-gaps.test.ts`（12 tests），覆盖 `/dupe`、`/newchat`、`/length`、`/is-mobile`、`/import`、`/popup`、`/pick-icon` 主路径、别名、参数校验和 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `77.70%`（上一轮 `76.06%`，+`1.64`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`dupe`、`import`、`is-mobile`、`length`、`newchat`、`pick-icon`、`popup`。
- `pnpm vitest run lib/slash-command/__tests__/p3-tooling-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 15 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-tooling-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`14 files / 307 tests` 全通过。

## 下一步建议

1. 推进推理解析命令簇（`/reasoning-parse|/parse-reasoning`），先落地 strict/return 双分支，再补 regex 开关契约测试。
2. 推进 Quick Reply 命令簇第一批（`/qr`、`/qr-list`、`/qr-get`、`/qr-create`、`/qr-delete`），优先单路径透传回调，宿主缺失保持 fail-fast。
3. 推进低耦合剩余长尾（`/forcesave`、`/hide`、`/expression-upload`），补齐最小可见结果断言，继续压缩 Top25。
