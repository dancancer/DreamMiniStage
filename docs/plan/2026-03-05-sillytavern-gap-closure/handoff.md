# Handoff（2026-03-05）

## 本轮完成

- 完成脚本运维命令簇收敛（对应上一轮 handoff 第 1 条建议）。
  - 新增命令：`/delay`、`/wait`、`/sleep`、`/generate-stop`、`/genraw`、`/list-gallery`（含 `lg` 别名）。
  - 语义对齐：`/delay` 支持毫秒延迟；`/generate-stop` 返回 `true/false` 字符串；`/genraw` 支持 `lock/instruct/as/system/prefill/length/trim/stop` 参数并统一校验。
  - 失败策略：参数非法、宿主能力缺失、返回值类型异常时统一 fail-fast。
- 补齐变量别名命令缺口。
  - 新增注册：`/listchatvar` → `handleListVar` 单路径复用，无重复实现。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `39.20%`（上一轮 `37.32%`，+`1.88`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`：`1 file / 17 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`
  - 新增 `/delay|/wait|/sleep` 成功路径与非法毫秒 fail-fast 断言。
  - 新增 `/generate-stop` 成功路径与返回类型异常断言。
  - 新增 `/genraw` 参数透传断言（含 `stop` JSON 解析）与 fail-fast 断言。
  - 新增 `/list-gallery|/lg` 过滤参数断言与宿主返回类型校验断言。
  - 新增 `/listchatvar` 别名覆盖断言。

## 下一步建议

1. 在宿主层接入 `stopGeneration / generateRaw / listGallery` 回调（会话页直接 Slash 与 iframe 路径都可见），补齐“命令可执行 -> UI 可见”闭环。
2. 启动 P3 命令簇机会性收敛，优先 `createlore/findlore/vector-worldinfo-state`，每轮只推进一个命令簇并绑定回归。
3. 增加 `/generate-stop` 与 `/genraw` 的端到端断言，覆盖命令结果与对话状态一致性。
