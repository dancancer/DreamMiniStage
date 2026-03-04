# DreamMiniStage 对齐审计（压缩版）

> 更新日期：2026-03-04  
> 历史明细归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1. 当前结论（主线导向）

- 项目已从“能力面扩张”切回“真实迁移阻塞收敛”。
- P2/P3 覆盖门槛长期达标，P4 保留为守卫基线，不再扩 CI 能力面。
- 当前主要风险已从高频命令缺失，转移到 parser 深语义边界与少量 TavernHelper 低频 helper 常量/API 兜底。

## 2. 核心指标（当前快照）

### 2.1 Slash 覆盖

- 上游命令总量：`258`
- 当前交集：`80`
- 覆盖率：`31.01%`

### 2.2 TavernHelper API 覆盖

- 上游聚合 API：`130`
- 当前 shim 顶层 API：`162`
- 当前交集：`124`
- 覆盖率：`95.38%`

### 2.3 P4 回归基线

- `pnpm p4:session-replay`：可复用
- 噪音基线：已启用差分门禁
- run-index：已启用趋势记录

## 3. 本轮主线执行（Round 31）

### 3.1 变更摘要

- 本轮按“先断言后实现”推进 parser 第二切片，在 `lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts` 新增 nested block + `REPLACE_GETVAR` 语义断言：
  - `REPLACE_GETVAR + STRICT_ESCAPING` 在 nested block 内同时覆盖 named/unnamed 参数替换，并验证引号字面量中的 `{:/:}` 不破坏 block 解析。
  - even-backslash quote 边界在 nested strict block 下维持 `Unclosed quote under STRICT_ESCAPING` fail-fast。
- 代码行为面本轮未扩展，重点是先固化 parser-flag 组合边界，避免后续修复回归。

### 3.2 回归结果

```bash
pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts
pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
pnpm exec eslint lib/slash-command/core/parser.ts lib/slash-command/__tests__/kernel-core.test.ts lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts public/iframe-libs/slash-runner-shim.js lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
pnpm exec tsc --noEmit
```

- 结果：parser 回归 `2 files / 24 tests` 全绿（`kernel-core 22 + nested-flags 2`）；固定回归 `3 files / 24 tests` 全绿，`eslint + tsc` 全绿。

## 4. 当前剩余 gap（按优先级）

### 4.1 P1（最高）parser 深语义第二切片

- 目标：严格转义与 parser 指令交互边界对齐。
- 策略：先补断言，再补实现；保持 fail-fast。

### 4.2 P2（高）TavernHelper helper 长尾

- 低频常量/API 余量：`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`。
- script tree helper（`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）按“真实触发失败”推进。

### 4.3 P2（中）低频 slash 命令

- 改为机会性补齐：只有真实素材触发失败才推进。

## 5. 执行策略（不变约束）

- 单路径优先：同能力只保留一个主入口。
- fail-fast：不做静默兜底。
- 指标驱动：每轮同步覆盖率与回归结论。
- 小步快跑：每轮只改一个能力面，改完立即回归。

## 6. 下一步计划（短周期）

1. 继续补齐 parser 第二切片剩余边界（parser-flag 在更深层 block 的开关切换组合）。
2. 按真实迁移阻塞评估 `builtin/setChatMessage/rotateChatMessages` 三项低频 API 是否需要补齐到可执行路径。
3. 评估 script tree helper（`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）是否存在真实迁移阻塞。
4. 每轮主线变更后按需执行 `pnpm p4:session-replay`，仅作守卫不扩面。

## 7. 归档入口

- 轮次历史与完成明细：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`
- 当前执行清单：`docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
- 当前交接摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/handoff.md`
- P4 场景与证据索引：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
