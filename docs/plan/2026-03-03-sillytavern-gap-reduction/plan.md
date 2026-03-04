# SillyTavern 整合增量计划（聚焦版）

> 更新时间：2026-03-04  
> 历史细节归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前状态

- Slash 覆盖：`80/258 = 31.01%`（已达原 P2 门槛）
- TavernHelper API 覆盖：`130/130 = 100.00%`（P3 缺口清零）
- P4：`p4-session-replay` 可作为稳定守卫基线（维持，不扩面）

## 2) 当前目标（主线）

- 主目标：继续收敛真实迁移阻塞，避免能力面无效扩张。
- 次目标：保持回归稳定，不引入兼容分支和隐式兜底。

## 3) 执行约束

- 单路径优先：同类能力只保留一个主入口。
- fail-fast：未支持能力明确报错。
- 指标驱动：每轮更新覆盖率 + 回归结果。
- 小步快跑：每轮聚焦一个能力面。

## 4) 当前优先级路线

### P1（最高）能力面阻塞清零（真实触发驱动）

- 已补齐低频常量/API：`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`。
- 已补齐 script tree helper：`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`（最小存储链路）。
- 已完成一轮真实迁移素材复验（Round 34），`rotateChatMessages` 与 script tree helper 语义在素材回放中保持一致。
- 下一步仅在真实脚本触发缺陷时进行单路径最小修复，并继续按需执行守卫回归。

### P2（中）parser 深语义守卫

- 现有语义边界断言进入守卫模式，除非真实缺陷触发，不主动扩展边界测试面。
- 若出现 parser 回归，仍按“先断言后实现”修复。

### P3（中）低频 slash 命令

- 改为机会性补齐（仅处理真实素材触发失败）。

### P4（守卫）回归基线

- 每轮按需执行 `pnpm p4:session-replay`。
- 出现新增噪音签名时，先修复再决定是否更新基线。

## 5) 完成标准

- 新增能力有对应回归测试。
- shim/handler/能力矩阵保持一致。
- 文档同步：`tasks.md`、`handoff.md`、分析文档。
