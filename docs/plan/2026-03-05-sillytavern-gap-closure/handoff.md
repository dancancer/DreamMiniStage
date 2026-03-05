# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 3 项：推进 `expression-*` 命令簇的小步收敛并落地闭环。
  - 新增命令：`/expression-set|/sprite|/emote`、`/expression-folder-override|/spriteoverride|/costume`、`/expression-last|/lastsprite`、`/expression-list|/expressions`、`/expression-classify|/classify`。
  - 语义对齐：统一收敛到 expression callback 单路径（`setExpression / setExpressionFolderOverride / getLastExpression / listExpressions / classifyExpression`），避免命令侧分叉。
  - 失败策略：宿主回调缺失、参数非法（`type/filter/return`）、宿主返回类型异常全部显式 fail-fast。
- 补齐 Slash 上下文透传链路。
  - `ExecutionContext` 新增 expression 相关回调定义。
  - `ApiCallContext` / `adaptSlashExecutionContext` / `useScriptBridge` / `CharacterChatPanel` 新增 `onSetExpression*`、`onGetLastExpression`、`onListExpressions`、`onClassifyExpression` 透传能力。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts`（登记 expression 命令及别名）。
  - 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `56.34%`（上一轮 `53.52%`，+`2.82`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除 `expression-*`、`/classify`、`/emote`、`/costume`。
- `pnpm vitest run lib/slash-command/__tests__/p3-expression-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 7 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-expression-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 15 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。

## 本轮新增/更新测试

- 新增 `lib/slash-command/__tests__/p3-expression-command-gaps.test.ts`
  - 覆盖 `expression-*` 主命令与别名（含 `type/filter/return` 语义）。
  - 覆盖 expression 宿主回调参数透传与返回值断言。
  - 覆盖无宿主、无参数、非法参数、宿主返回异常的 fail-fast 场景。
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts` 随能力矩阵更新完成对齐校验（断言逻辑无改动）。

## 下一步建议

1. 为 `member-*/addswipe` 增加“命令执行 + UI 可见变化”的端到端断言，验证宿主状态与界面状态一致性。
2. 为 `data-bank-search` 与 `vector-worldinfo-state` 增加可见结果断言，收紧回归面。
3. 选择一个新的 P3 命令簇继续小步收敛，建议优先 `caption + beep/ding` 或 `extension-*`（命中当前 Top25）。
