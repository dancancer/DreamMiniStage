# Handoff（2026-03-04 / 十七轮能力需求清单补齐）

## 本轮完成（文档收敛）

- `docs/analysis/sillytavern-integration-gap-2026-03.md` 新增独立章节：`8. 能力需求清单（真实素材 vs 非素材）`。
- 新章节按列表明确了四类信息：
  - 当前真实素材能力需求；
  - 当前项目已支持能力；
  - 真实素材仍待补充能力；
  - 非真实素材需求之外仍建议补充能力。
- 本轮不涉及代码逻辑变更，仅进行文档结构化收敛，便于后续按清单执行。

## 本轮验证（命令级）

```bash
# 文档改动，本轮未触发代码测试
```

- 结果：文档变更已完成并与当前任务清单对齐。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - 状态不变：`P1` 剩余 2 项（regex 素材驱动回归、worldbook 组合语义回归）。
  - 新增能力清单章节可直接作为这两项的执行输入。

## 下一步建议（主线）

1. 先按新清单落地 regex 素材回归：`V2.0Beta.png + Sgw3.*` 的 `runOnEdit/substituteRegex/minDepth/maxDepth` 组合断言。
2. 再按新清单落地 worldbook 组合回归：`probability/useProbability/depth/group/groupWeight` 一致性检查。
3. 每个切片完成后按需复跑 `pnpm p4:session-replay`，仅作为守卫基线，不扩展 CI 能力面。

---

## 历史记录（简版）

- 十七轮：补齐“真实素材 vs 非素材”能力需求清单，形成可执行列表（已支持/待补充/额外补充）。
- 十六轮：完成 `flags/debug/scope chain` 第一切片（`parser-flag + breakpoint + scopeDepth/parserFlags`）并固化基线断言。
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
