# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 3 项的 `extension-*` 命令簇收敛，并落地执行闭环。
  - 新增命令：`/extension-enable`、`/extension-disable`、`/extension-toggle`、`/extension-state`、`/extension-exists|/extension-installed`。
  - 语义对齐：统一收敛到 extension callback 单路径（`isExtensionInstalled / getExtensionEnabledState / setExtensionEnabled`），命令层不再分叉。
  - 失败策略：宿主回调缺失、扩展未安装、`state/reload` 布尔参数非法、宿主返回值类型异常全部显式 fail-fast。
- 补齐 Slash 上下文透传链路。
  - `ExecutionContext` 新增 extension 相关回调定义。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增 `onIsExtensionInstalled`、`onGetExtensionEnabledState`、`onSetExtensionEnabled` 透传能力。
  - 宿主默认路径：当未显式注入 callback 时，`slash-context-adapter` 尝试走 `window.pluginRegistry` 单路径适配；不可用时保持显式 fail-fast。
- 同步能力矩阵与文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts`（登记 extension 命令与别名）。
  - 更新 `hooks/script-bridge/README.md`（补充 extension 回调注入说明）。
  - 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `57.75%`（上一轮 `56.34%`，+`1.41`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除 `extension-enable/disable/toggle/state/exists/installed`。
- `pnpm vitest run lib/slash-command/__tests__/p3-extension-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 16 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。

## 本轮新增/更新测试

- 新增 `lib/slash-command/__tests__/p3-extension-command-gaps.test.ts`
  - 覆盖 `extension-*` 主命令与别名执行路径。
  - 覆盖 `state/reload` 参数语义、宿主回调参数透传与 reload 行为。
  - 覆盖无宿主、扩展不存在、参数非法、宿主返回类型异常的 fail-fast 场景。
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts` 随能力矩阵更新完成对齐校验（断言逻辑无改动）。

## 下一步建议

1. 推进 `caption + beep/ding` 命令簇，优先补齐“可执行 + 可见效果”最小闭环。
2. 为 `member-*/addswipe` 增加端到端 UI 可见断言，验证宿主状态与界面状态一致性。
3. 为 `data-bank-search` 与 `vector-worldinfo-state` 增加可见结果断言，继续收紧回归面。
