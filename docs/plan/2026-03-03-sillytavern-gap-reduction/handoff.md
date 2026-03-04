# Handoff（2026-03-04 / 二十轮 regex 长尾 API 收口）

## 本轮完成（代码 + 回归）

- 落地 TavernHelper regex 长尾 API 最小读取闭环：
  - 新增 `hooks/script-bridge/compat-regex-handlers.ts`，提供 `formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes`；
  - `formatAsTavernRegexedString` 复用 `RegexProcessor` 执行 `source + destination + depth + character_name` 语义；
  - `getTavernRegexes` 支持 `scope(all|global|character)` 与 `enable_state(all|enabled|disabled)` 过滤，并输出 tavern regex 结构；参数异常统一 fail-fast。
- shim 侧能力补齐：
  - `public/iframe-libs/slash-runner-shim.js` 新增 `formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes` API_CALL 入口；
  - 继续保持“能力存在即执行，不存在即显式失败”的单路径策略。
- 能力矩阵与测试同步：
  - `hooks/script-bridge/capability-matrix.ts` 新增 3 个 regex API 声明；
  - `hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts` 新增 regex API 语义与 fail-fast 断言；
  - `hooks/script-bridge/__tests__/api-surface-contract.test.ts`、`lib/script-runner/__tests__/slash-runner-shim-contract.test.ts` 复验通过。
- 结构收敛：
  - `hooks/script-bridge/compat-handlers.ts` 回到门面聚合职责，通过 `...compatRegexHandlers` 合并 regex 分支，避免单文件继续膨胀。
- 文档同步：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md` 新增二十轮执行记录与指标；
  - `docs/analysis/sillytavern-integration-gap-2026-03.md` 新增 `1.27` 章节并更新覆盖率指标。

## 本轮验证（命令级）

```bash
pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec tsc --noEmit
```

- 结果：全部通过（`17` tests passed，`tsc` 全绿）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - `P2` 继续按“真实触发失败”推进，本轮完成 regex 读取子簇收口；
  - TavernHelper API 覆盖率更新为 `86 / 130 = 66.15%`（shim 顶层 API `124`）；
  - 当前未完成项主要在：
    - parser 深语义第二切片；
    - `P2` 剩余 displayed-message 子簇与低频 slash 的机会性补齐。

## 下一步建议（主线）

1. 继续推进 parser 深语义第二切片（严格转义与 parser 指令交互），先补可复现断言再扩行为面。
2. 按“真实触发失败”推进 TavernHelper 长尾 API 下一批：优先补 `displayed-message` 子簇，不新增兼容分支，保持 fail-fast。
3. 主线改动后按需复跑 `pnpm p4:session-replay` 作为守卫基线，继续冻结 CI 能力面扩展。

---

## 历史记录（简版）

- 二十轮：补齐 regex 长尾 API（`formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes`），新增 `compat-regex-handlers`；能力矩阵与回归同步，TavernHelper API 覆盖提升到 `66.15%`。
- 十九轮：补齐 util 长尾 API（`substitudeMacros/getLastMessageId/getMessageId`）+ shim `errorCatched`；能力矩阵与回归同步，TavernHelper API 覆盖提升到 `63.85%`。
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
- P2/P3 指标门槛维持达标：Slash `31.01%`（`80/258`），TavernHelper API `66.15%`（`86/130`）。
