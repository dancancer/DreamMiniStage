# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1 项：`bgcol + bubble|bubbles|buttons` 命令簇收敛，并额外完成注入清理命令闭环。
  - 新增命令：`/bgcol`、`/bubble`、`/bubbles`、`/flat`、`/default`、`/single`、`/story`、`/buttons`、`/flushinject`、`/flushinjects`。
  - 语义对齐：
    - `/bgcol` 统一收敛到 `setAverageBackgroundColor` 单路径回调（支持显式颜色参数）。
    - `/bubble|/bubbles`、`/flat|/default`、`/single|/story` 统一收敛到 `setChatDisplayMode` 单路径回调。
    - `/buttons` 统一收敛到 `showButtonsPopup` 单路径回调，支持 `labels` 与 `multiple` 参数。
    - `/flushinject|/flushinjects` 统一收敛到 `removePromptInjections` 单路径回调，支持按 ID 或全量清理。
  - 失败策略：宿主回调缺失、参数非法、宿主返回值类型异常全部显式 fail-fast。
- 补齐 Slash 上下文透传与默认宿主闭环。
  - `ExecutionContext` 新增 `setAverageBackgroundColor`、`setChatDisplayMode`、`showButtonsPopup`、`removePromptInjections` 回调定义。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传能力。
  - 在宿主未注入时，`slash-context-adapter` 为 `setChatDisplayMode/bgcol/buttons/removePromptInjections` 提供默认实现（浏览器环境）。
- 同步能力矩阵与文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts`（登记新增命令）。
  - 更新 `hooks/script-bridge/README.md`（补充新的 Slash 注入回调）。
  - 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `60.80%`（上一轮 `58.45%`，+`2.35`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除 `bgcol`、`bubble|bubbles`、`buttons`、`flat|default`、`flushinject|flushinjects`。
- `pnpm vitest run lib/slash-command/__tests__/p3-ui-style-command-gaps.test.ts`：`1 file / 5 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts lib/slash-command/__tests__/p3-caption-audio-command-gaps.test.ts`：`2 files / 11 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/slash-command/__tests__/p3-ui-style-command-gaps.test.ts`：`4 files / 16 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。

## 本轮新增/更新测试

- 新增 `lib/slash-command/__tests__/p3-ui-style-command-gaps.test.ts`
  - 覆盖 `/bgcol` 参数透传与返回值校验。
  - 覆盖 `/bubble|/bubbles`、`/flat|/default`、`/single|/story` 统一 display-mode 透传。
  - 覆盖 `/buttons` 的 `labels/multiple` 参数与返回值序列化。
  - 覆盖 `/flushinject|/flushinjects` 的按 ID/全量清理路径。
  - 覆盖无宿主、参数非法、宿主返回值异常的 fail-fast 场景。
- 复跑 `p2-branch-ui`、`p3-caption-audio`、`material-replay`、`api-surface-contract` 与 baseline，确认既有命令簇无回退。

## 下一步建议

1. 推进会话运维长尾：`/closechat`、`/count`、`/countmember`、`/cut`（优先复用现有消息/群聊上下文，降低回归面）。
2. 推进图像命令首批：`/image|/img` 与 `imagine*` 的最小可用实现（先打通“可执行 + 可断言返回”）。
3. 为 `member-*/addswipe`、`data-bank-search`、`vector-worldinfo-state` 增加 UI/结果可见断言，继续收紧端到端回归面。
