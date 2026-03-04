# Handoff（2026-03-04 / 十五轮参数语义闭环）

## 本轮完成（主线优先）

- 已完成 parser -> executor -> slash bridge 的参数元数据透传闭环：
  - `lib/slash-command/core/parser.ts` 与 `lib/slash-command/parser.ts` 统一产出
    `namedArgumentList/unnamedArgumentList`（保序、保留重复命名参数、保留 `rawValue/wasQuoted`）。
  - `lib/slash-command/core/executor.ts` 与 `lib/slash-command/executor.ts` 已将 `CommandInvocationMeta` 透传到命令 handler。
  - `hooks/script-bridge/slash-command-bridge.ts` 基于上述元数据完成执行期收敛：
    - `acceptsMultiple` 命名参数聚合（callback 收到数组）
    - `defaultValue` 注入（命名/位置参数）
    - `rawQuotes` + `raw=false` 覆盖行为
    - 重复命名参数“列表保序 + 运行态 last-write”双轨语义
- 已补齐专项回归：
  - `hooks/script-bridge/__tests__/extension-lifecycle.test.ts` 新增 `acceptsMultiple/defaultValue/rawQuotes/重复命名参数` 断言。
  - `lib/slash-command/__tests__/kernel-core.test.ts` 新增 parser 保序/quote 元数据断言（内核 parser + 兼容 parser）。
- 文档状态与代码状态保持一致：
  - `docs/analysis/sillytavern-integration-gap-2026-03.md` 与 `docs/plan/.../tasks.md` 已同步为 `Slash 31.01%`、P0 语义等价条目完成。

## 本轮验证（命令级）

```bash
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
pnpm exec eslint hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/slash-command/core/parser.ts lib/slash-command/core/executor.ts lib/slash-command/core/types.ts lib/slash-command/parser.ts lib/slash-command/executor.ts lib/slash-command/types.ts lib/slash-command/__tests__/kernel-core.test.ts
pnpm exec tsc --noEmit
```

- 结果：全部通过（`vitest: 3 files / 82 tests`，`eslint` 无告警，`tsc` 通过）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - 当前状态保持一致：P0 语义等价 3 项均已完成，P1（`flags/debug/scope chain` + regex/worldbook 组合验证）仍待推进。

## 下一步建议（主线）

1. 进入 P1 第一个切片：先补 `flags/debug/scope chain` 最小可复现行为，并在 `st-baseline-slash-command` 增量加断言，不并行扩能力面。
2. 基于素材优先级执行第二个切片：围绕 `V2.0Beta.png` 与 `Sgw3.*` 的 `regex_scripts` 组合（`runOnEdit/substituteRegex/minDepth/maxDepth`）补专项回归。
3. 保持 P4 策略不变：仅作为守卫基线，在 P1 每个切片收敛后按需复跑 `pnpm p4:session-replay`，不新增 CI 扩展项。

---

## 历史记录（简版）

- 十五轮：完成 parser/executor/bridge 参数元数据闭环与 `acceptsMultiple/defaultValue/rawQuotes` 语义复核，定向回归全绿。
- 十四轮：`registerSlashCommand` 执行期参数约束 + 结构化参数上下文透传落地，指定回归全绿。
- 十三轮：`extension-handlers + slash-runner-shim` 结构拆分完成，指定回归全绿。
- 十二轮：`registerSlashCommand` iframe callback 闭环修复 + 方向回归主线。
- 十一轮 P4：新增 run-index 与规则健康审计，`11/11` 通过，新增噪音 `0`、stale 规则 `0`。
- 十轮 P4：新增噪音基线差分门禁，`11/11` 通过，新增噪音 `0`。
- 九轮 P4：round7+8 自动回放脚本落地并接入 CI，`10/10` 通过。
- 八轮 P4：普通输入 `401` 失败链路独立证据补齐，刷新后用户输入持久化通过。
- 七轮 P4：`/session` 修复复验 `3/3` 通过（slash 直达、刷新持久化、会话隔离）。
- 六轮 P4：审计链路 `3/3` 已执行，确认两项缺口（slash 直达未命中、失败后输入未持久化）。
- 五轮 P4：`/session` 真实 UI 场景 `1/1` 通过。
- P2/P3 指标门槛维持达标：Slash `31.01%`（`80/258`），TavernHelper API `60.77%`（`79/130`）。
