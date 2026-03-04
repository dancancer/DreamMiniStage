# Handoff（2026-03-04 / 十八轮素材驱动组合回归）

## 本轮完成（代码 + 回归）

- 落地 regex 素材驱动回归：
  - 新增 `lib/core/__tests__/st-baseline-regex-material.test.ts`；
  - 覆盖 `Sgw3.card.json` 与 `Sgw3.png` 的关键字段分布一致性；
  - 覆盖 `Sgw3.*` 的 `minDepth/maxDepth` 边界过滤；
  - 覆盖 `V2.0Beta.png` 的 `runOnEdit/substituteRegex` 元信息保真。
- 落地 worldbook 组合回归：
  - 新增 `lib/core/__tests__/st-baseline-worldbook-material.test.ts`；
  - 覆盖 `服装随机化.json` 导入后的 `useProbability/depth/groupWeight` 字段保真；
  - 覆盖 `probability/useProbability/depth/group/groupWeight` 执行链一致性（分组选择 + depth 注入）。
- 修复语义缺口：
  - `lib/models/regex-script-model.ts`：将 `minDepth/maxDepth=null` 归一为 `undefined`，消除深度过滤误判。
  - `lib/core/world-book-advanced.ts`：`applyProbability` 接入 `useProbability`；group 评分接入 `groupWeight/group_weight`；并补齐 `extensions` 回退读取。
  - `lib/adapters/import/worldbook-import.ts`、`function/worldbook/import.ts`、`lib/data/roleplay/world-book-operation.ts`：补齐 `useProbability/groupWeight` 导入与存储链路，收敛到单一路径。
- 文档同步：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`：P1 两个剩余项已勾选完成，并记录十八轮回归命令。
  - `docs/analysis/sillytavern-integration-gap-2026-03.md`：更新“仍待补充”状态，新增“9. 十八轮执行结果”。

## 本轮验证（命令级）

```bash
pnpm vitest run \
  lib/core/__tests__/st-baseline-regex-material.test.ts \
  lib/core/__tests__/st-baseline-worldbook-material.test.ts \
  lib/core/__tests__/st-baseline-worldbook.test.ts \
  lib/core/__tests__/world-book-advanced-features.test.ts \
  lib/models/__tests__/regex-script-model.property.test.ts

pnpm exec tsc --noEmit
```

- 结果：全部通过（`81` tests passed，`tsc` 全绿）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - `P1` 两项素材驱动回归已完成（regex + worldbook）。
  - 当前未完成项主要在：
    - parser 深语义第二切片；
    - `P2` 长尾 API/低频命令机会性收口。

## 下一步建议（主线）

1. 继续推进 parser 深语义第二切片（严格转义与 parser 指令交互），优先补素材可复现断言后再扩能力面。
2. 按“真实触发失败”推进 `P2` 长尾 API，保持 fail-fast，不新增兼容分支。
3. 主线改动后按需复跑 `pnpm p4:session-replay` 作为守卫基线，继续冻结 CI 能力面扩展。

---

## 历史记录（简版）

- 十八轮：完成 regex/worldbook 素材驱动回归；修复 `minDepth/maxDepth=null` 归一、`useProbability/groupWeight` 执行语义与导入存储映射；定向回归 + `tsc` 全绿。
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
