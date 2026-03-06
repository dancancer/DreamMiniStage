# Handoff（2026-03-06）

## 本轮完成

- 补齐 4 个 slash 命令缺口：`/tempchat`、`/translate`、`/wi-get-timed-effect`、`/wi-set-timed-effect`。
- `tempchat/translate` 统一走显式宿主回调单路径：Slash 层只做参数校验、上下文透传与返回值 fail-fast，不在本地伪造 UI/网络副作用。
- `wi-get/set-timed-effect` 同样收敛到宿主 timed-effect runtime：新增 active chat 校验、`sticky|cooldown|delay` effect 解析，以及 `format=bool|number` 输出语义。
- 扩展 Slash 执行上下文与 Script Bridge：`ExecutionContext` / `ApiCallContext` 新增 `openTemporaryChat`、`translateText`、`getWorldInfoTimedEffect`、`setWorldInfoTimedEffect`，并在 `slash-context-adapter.ts` 单路径透传。
- 更新契约测试与能力矩阵：
  - `lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts` 覆盖 `/tempchat`。
  - `lib/slash-command/__tests__/p3-extension-command-gaps.test.ts` 覆盖 `/translate`。
  - `lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts` 覆盖 `wi-get/set-timed-effect`。
  - `hooks/script-bridge/capability-matrix.ts` / `hooks/script-bridge/README.md` 同步最新命令与上下文注入位。
- gap report 已更新；Top25 现只剩 3 个命令：`floor-teleport`、`proxy`、`yt-script`。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 36 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts lib/slash-command/__tests__/p3-session-maintenance-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`16 files / 328 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`99.30%`（上一轮 `98.36%`，+`0.94`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`tempchat`、`translate`、`wi-get-timed-effect`、`wi-set-timed-effect`

## 下一步建议

1. 直接收掉最后 3 个薄命令：`/proxy`、`/yt-script`、`/floor-teleport`。它们都更像宿主/扩展侧能力开关，不值得在 Slash 层新造状态源。
2. 对 `proxy` 先确认上游真实语义来源；如果它不是主仓内建 slash 命令，就应该顺手修正 gap 数据源，避免分析报告继续把不存在的命令计入缺口。
3. `floor-teleport` 若确属扩展命令，建议和 `yt-script` 一起按“宿主显式回调 + 参数 fail-fast”模板一次性做完，下一轮就能把 slash coverage 推到 `100%`。
