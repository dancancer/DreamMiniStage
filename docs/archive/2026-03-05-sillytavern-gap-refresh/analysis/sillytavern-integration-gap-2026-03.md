# DreamMiniStage 对齐审计（压缩版）

> 更新日期：2026-03-04  
> 历史明细归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1. 当前结论（主线导向）

- 项目已从“能力面扩张”切回“真实迁移阻塞收敛”。
- P2/P3 覆盖门槛长期达标，P4 保留为守卫基线，不再扩 CI 能力面。
- 最近三轮 parser 语义边界已形成稳定守卫线，当前边际收益明显下降。
- Round 34 已完成真实迁移素材复验，当前主要风险转为“后续真实脚本新增触发点的机会性语义偏差”。

## 2. 核心指标（当前快照）

### 2.1 Slash 覆盖

- 上游命令总量：`258`
- 当前交集：`80`
- 覆盖率：`31.01%`

### 2.2 TavernHelper API 覆盖

- 上游聚合 API：`130`
- 当前 shim 顶层 API：`171`
- 当前交集：`130`
- 覆盖率：`100.00%`

### 2.3 P4 回归基线

- `pnpm p4:session-replay`：可复用
- 噪音基线：已启用差分门禁
- run-index：已启用趋势记录

## 3. 本轮主线执行（Round 34）

### 3.1 变更摘要

- 本轮新增真实素材回放基线：`hooks/script-bridge/__tests__/material-replay-round34.test.ts` + `hooks/script-bridge/__tests__/fixtures/round34-migration-material.json`。
- 本轮回放覆盖 `rotateChatMessages` 四个上游示例区间（来自 JS-Slash-Runner 变更日志语义）与 script tree helper 的 `get/replace/updateWith` 组合链路。
- 本轮确认 scope 隔离与持久化语义：`character/preset/all` 读取结果一致，跨 context 重建后数据可复现。

### 3.2 回归结果

- parser 守卫回归：`2 files / 24 tests` 通过。
- script-bridge / shim 回归：`5 files / 33 tests` 通过（含新增 `material-replay-round34.test.ts`）。
- 合并回归总计：`7 files / 57 tests` 通过。
- 静态检查：`eslint`（8 files）+ `tsc --noEmit` 全绿。

## 4. 当前剩余 gap（按优先级）

### 4.1 P1（最高）能力面阻塞清零

- 状态：长尾能力面实现 + 真实迁移素材复验均已落地。
- 策略：保持守卫模式，仅在真实脚本触发偏差时做单路径最小修复与回归补强。

### 4.2 P2（高）TavernHelper helper 长尾

- 已补齐：`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`。
- 已补齐：`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`。
- 剩余工作：仅保留真实脚本触发下的语义细节修正。

### 4.3 P2（中）parser 深语义守卫

- 策略：仅在真实缺陷触发时补断言/修复，不主动扩覆盖面。

### 4.4 P3（中）低频 slash 命令

- 改为机会性补齐：只有真实素材触发失败才推进。

## 5. 执行策略（不变约束）

- 单路径优先：同能力只保留一个主入口。
- fail-fast：不做静默兜底。
- 指标驱动：每轮同步覆盖率与回归结论。
- 小步快跑：每轮只改一个能力面，改完立即回归。

## 6. 下一步计划（短周期）

1. 持续接入新增真实迁移脚本素材；若触发 `rotateChatMessages` / script tree 语义偏差，按“单路径最小修复 + 契约测试”补齐。
2. parser 仅在真实缺陷触发时再扩断言/修复，保持守卫模式。
3. 主线变更后按需执行 `pnpm p4:session-replay`，仅作守卫不扩面。

## 7. 归档入口

- 轮次历史与完成明细：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`
- 当前执行清单：`docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
- 当前交接摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/handoff.md`
- P4 场景与证据索引：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
