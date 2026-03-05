# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1 项：清理 Top25 中 `/disable` 语义差距并落地命令闭环。
  - 新增命令：`/member-disable`、`/disable`、`/disablemember`、`/memberdisable`、`/member-enable`、`/enable`、`/enablemember`、`/memberenable`。
  - 语义对齐：统一收敛到 `setGroupMemberEnabled(target, enabled)` 单路径，不再分叉实现。
  - 失败策略：宿主回调缺失、成员目标缺失、宿主返回类型异常，全部显式 fail-fast。
- 补齐 Slash 上下文的群成员启停回调透传。
  - `ExecutionContext` 新增 `setGroupMemberEnabled(target, enabled)`。
  - `ApiCallContext` / `adaptSlashExecutionContext` / `useScriptBridge` / `CharacterChatPanel` 新增 `onSetGroupMemberEnabled` 透传链路。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts`（登记 `member-enable/disable` 及别名）。
  - 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `53.52%`（上一轮 `51.64%`，+`1.88`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除 `/disable`、`/enable`、`/disablemember`、`/enablemember`。
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 29 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 37 tests` 全通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`
  - 新增 `member-enable/disable` 命令簇覆盖（含别名与 enabled 布尔透传断言）。
  - 新增缺参/非法宿主返回的 fail-fast 覆盖。
  - 扩展“宿主不支持时 fail-fast”用例，纳入 `/disable` 与 `/enable`。
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts` 随能力矩阵变更完成对齐校验（断言逻辑无改动）。

## 下一步建议

1. 为 `member-*/addswipe` 补齐“命令执行 + UI 可见变化”的端到端断言，验证宿主界面状态一致性。
2. 为 `data-bank-search` 与 `vector-worldinfo-state` 增加可见结果断言，收紧回归面。
3. 按素材驱动挑选一个 UI/多媒体 P3 命令簇（建议 `expression-*`）做小步收敛，避免回归面扩散。
