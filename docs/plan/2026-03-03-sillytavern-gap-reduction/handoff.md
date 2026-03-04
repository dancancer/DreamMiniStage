# Handoff（2026-03-04 / 二十三轮 inject + regex 写链路收口）

## 本轮完成（代码 + 回归）

- 落地 TavernHelper 低频长尾 API 最小闭环（保持单路径 + fail-fast）：
  - 在 `public/iframe-libs/slash-runner-shim.js` 补齐 `replaceTavernRegexes` 与 `updateTavernRegexesWith`；其中 `updateTavernRegexesWith` 采用 shim 侧 updater 包装（先 `getTavernRegexes`，再执行本地 updater，最后统一走 `replaceTavernRegexes` 持久化）。
  - 在 `hooks/script-bridge/compat-regex-handlers.ts` 新增 `replaceTavernRegexes` handler：支持 `scope=all|global|character`，并对 scope/字符上下文/参数类型做显式 fail-fast 校验。
  - 在 `public/iframe-libs/slash-runner-shim.js` 补齐 `injectPrompts/uninjectPrompts` 入口；当前宿主模式显式 fail-fast，避免静默 no-op。
- 契约与能力矩阵同步：
  - `hooks/script-bridge/capability-matrix.ts` 新增 `replaceTavernRegexes`，继续保持 shim/handler 单一声明面。
  - `lib/script-runner/__tests__/slash-runner-shim-contract.test.ts` 增加低频 API 暴露断言（inject/uninject + regex 写链路）。
  - `hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts` 增加 `replaceTavernRegexes` 的 scope 路径与 fail-fast 断言。
- 计划文档同步：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`、`docs/analysis/sillytavern-integration-gap-2026-03.md` 已更新二十三轮记录与覆盖率指标。

## 本轮验证（命令级）

```bash
pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec eslint \
  public/iframe-libs/slash-runner-shim.js \
  hooks/script-bridge/compat-regex-handlers.ts \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts \
  hooks/script-bridge/capability-matrix.ts

pnpm exec tsc --noEmit
```

- 结果：全部通过（`3` files / `22` tests passed，`eslint + tsc` 全绿）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - `P2` 长尾 API 延续“真实触发失败驱动”策略，本轮完成 inject 入口显式能力声明与 regex 写链路收口；
  - TavernHelper API 覆盖率更新为 `105 / 130 = 80.77%`（shim 顶层 API `143`）；
  - 当前未完成项主要在：
    - parser 深语义第二切片；
    - `macro_like/raw_character` 等剩余低频 API 与低频 slash 的机会性补齐。

## 下一步建议（主线）

1. 继续推进 parser 深语义第二切片（严格转义与 parser 指令交互），先补可复现断言再扩行为面。
2. 按“真实触发失败”继续推进 TavernHelper 长尾 API：优先 `macro_like`（`registerMacroLike/unregisterMacroLike`）与 `raw_character`（`getCharData/getChatHistory*`）簇，保持 fail-fast 与单路径。
3. 每次主线增量后按需复跑 `pnpm p4:session-replay` 作为守卫基线，继续冻结 CI 能力面扩展。

---

## 历史记录（简版）

- 二十三轮：补齐 `injectPrompts/uninjectPrompts` 入口与 `replaceTavernRegexes/updateTavernRegexesWith` 写链路；新增 scope/fail-fast 回归，TavernHelper API 覆盖提升到 `80.77%`。
- 二十二轮：补齐 `lorebook/global/worldbook` 长尾别名 API（含 `initializeGlobal/waitGlobalInitialized/getWorldbook`）；新增 shim 契约断言，TavernHelper API 覆盖提升到 `77.69%`。
- 二十一轮：补齐 displayed-message 长尾 API（`formatAsDisplayedMessage/retrieveDisplayedMessage`），新增 `compat-displayed-message-handlers`；能力矩阵与回归同步，TavernHelper API 覆盖提升到 `67.69%`。
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
- P2/P3 指标门槛维持达标：Slash `31.01%`（`80/258`），TavernHelper API `80.77%`（`105/130`）。
