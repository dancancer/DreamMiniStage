# 执行清单（按优先级）

## P0 - 工具调用闭环（先做）

- [x] 收敛 `registerFunctionTool` 注册表为单路径（注册/调用/卸载共用一套状态源）。
- [x] 打通 `LLMNodeTools` 的 `tool_calls` 到脚本工具回调执行。
- [x] 在 shim + handler 补齐 `registerVariableSchema`、`updateVariablesWith`、`insertVariables`。
- [x] 为函数工具新增端到端单测（同步/异步 callback + 超时/异常返回）。
- [x] 十二轮主线修复：补齐 `registerSlashCommand` 的 iframe 回调闭环（`SLASH_COMMAND_CALL -> SLASH_COMMAND_RESULT`），修复 `hasCallback + iframeId` 路径不可执行的迁移阻塞。
- [x] 十二轮主线回归：`pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`。
- [x] 十三轮结构拆分（主线优先）：将 `hooks/script-bridge/extension-handlers.ts` 按职责拆分为函数工具桥接与 slash 回调桥接子模块，保持行为不变、消除单文件膨胀。
- [x] 十三轮结构拆分（主线优先）：将 `public/iframe-libs/slash-runner-shim.js` 的 slash 回调与消息分发逻辑拆出独立分块，减少跨能力耦合（不引入新能力）。
- [x] 十三轮拆分验收：拆分后执行 `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts` 全绿。
- [x] 十四轮主线语义收敛：为 `registerSlashCommand` 增加 `namedArgumentList/unnamedArgumentList` 执行期约束（缺失必填、未知命名参数、位置参数溢出统一 fail-fast）。
- [x] 十四轮主线语义收敛：为 slash callback 上下文补齐结构化参数视图（`namedArgumentList/unnamedArgumentList`），并透传到 iframe 回调消息。
- [x] 十四轮主线回归：`pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts` 全绿。
- [x] 回归：
  - `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts`
  - `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`
  - `pnpm vitest run hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`

## P1 - MVU strict 语义 + Slash 宏条件流

- [x] 在 `lib/mvu/core/executor.ts` 落地 `strictSet` 执行语义。
- [x] 落地 `strictTemplate` 与 `concatTemplateArray` 执行行为，并补冲突测试。
- [x] 为 Slash 条件流增加宏预处理（`{{getvar::}}` 相关）。
- [x] 解除 `st-baseline-slash-command` 中与宏条件流相关的 skip。
- [x] 回归：
  - `pnpm vitest run lib/mvu/__tests__/executor-option-semantics.test.ts`
  - `pnpm vitest run lib/core/__tests__/st-baseline-mvu.test.ts`
  - `pnpm vitest run lib/core/__tests__/st-baseline-slash-command.test.ts`
  - `pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts`

## P2 - 高频 Slash 命令族扩展

- [x] 从 `test-baseline-assets` 与现有脚本样本统计 Top N 高频缺失命令。
- [x] 每次仅补一个命令族（参数签名 + 错误语义 + 测试）。
- [x] 每次补齐后更新覆盖率快照（总量/交集/覆盖率）。
- [x] 二轮增量：补齐 `api / api-url / server` 最小只读子集，并为写路径显式 fail-fast。
- [x] 二轮回归：`pnpm vitest run lib/slash-command/__tests__/p2-api-command-gaps.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`。
- [x] 二轮指标：Slash 覆盖率更新为 `65 / 258 = 25.19%`。
- [x] 三轮增量：补齐 `fuzzy` 命令最小子集（`list + threshold + mode(first|best)`），参数错误显式 fail-fast。
- [x] 三轮回归：`pnpm vitest run lib/slash-command/__tests__/p2-fuzzy-command-gaps.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`。
- [x] 三轮指标：Slash 覆盖率更新为 `66 / 258 = 25.58%`。
- [x] 四轮增量：补齐 `chat-manager / chat-history / manage-chats / chat-reload` 最小子集，宿主缺回调路径显式 fail-fast。
- [x] 四轮回归：`pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`。
- [x] 四轮指标：Slash 覆盖率更新为 `68 / 258 = 26.36%`。
- [x] 五轮增量：补齐 `run / trimtokens / reload-page` 最小子集（`run` 支持变量脚本与 `{{arg::}}` 注入；`trimtokens` 支持 `limit + direction` 并在无 tokenizer 时按比例降级；`reload-page` 走宿主回调，缺失时 fail-fast）。
- [x] 五轮回归：`pnpm vitest run lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`。
- [x] 五轮指标：Slash 覆盖率更新为 `71 / 258 = 27.52%`。
- [x] 六轮增量：补齐 `branch-create / panels / bg / theme / movingui / css-var / vn / resetpanels / ?` 最小子集（UI 命令统一走宿主回调注入，缺失时显式 fail-fast；`branch-create` 复用 checkpoint 状态并自动进入分支会话）。
- [x] 六轮回归：`pnpm vitest run lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts lib/slash-command/__tests__/p2-checkpoint-command-gaps.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`。
- [x] 六轮指标：Slash 覆盖率更新为 `78 / 258 = 30.23%`。
- [x] 目标：Slash 覆盖率提升到 `>= 30%`。

## P3 - TavernHelper API 缺口收敛

- [x] 优先补 import_raw / script buttons / version 相关 API。
- [x] 按需补 extension 管理 API（不支持路径需 fail-fast）。
- [x] 保持 shim 与 capability matrix 同步更新。
- [x] 目标：TavernHelper API 覆盖率提升到 `>= 55%`。

## P4 - Playwright MCP E2E（满足门槛后执行）

- [x] 准备 `test-baseline-assets` 场景映射（脚本、会话、变量链路）。
- [x] 编写并执行 Playwright MCP E2E（脚本工具、Slash 控制流、MVU 更新、音频事件）。
- [x] 二轮增量：新增故障注入场景（`tool-timeout-failfast`、`macro-unknown-failfast`、`reload-page-failfast`）。
- [x] 二轮执行：Playwright MCP 实跑 `7/7` 通过（`4` 主链路 + `3` 故障注入）。
- [x] 三轮增量：新增 `audio-callback-missing-failfast` 场景，并将 `/audioplay` 缺失宿主回调路径收敛为显式 fail-fast。
- [x] 三轮执行：Playwright MCP 实跑 `8/8` 通过（`4` 主链路 + `4` 故障注入）。
- [x] 四轮增量：新增 `chain-failfast-consistency` 场景，验证串联脚本在中段 fail-fast 时的状态一致性（前置副作用保留、后续命令截断）。
- [x] 四轮执行：Playwright MCP 实跑 `9/9` 通过（`4` 主链路 + `5` 故障注入）。
- [x] 五轮增量：补齐 `/session` 真实 UI 场景（输入提交 + 消息渲染 + 会话切换隔离），并记录 API 未配置下的 fail-fast 行为。
- [x] 五轮执行：Playwright MCP 实跑通过（`session-a` 输入后渲染消息，切换到 `session-b` 后无跨会话污染）。
- [x] 五轮清理固化：新增 `scripts/p4-playwright-preflight.sh`，执行前自动回收 `mcp-chrome/Playwright` 残留进程。
- [x] 六轮增量：补充 `/session` slash 直达与失败后刷新一致性审计（`/send ...|/trigger` 输入路径 + `401` 后刷新）。
- [x] 六轮执行：审计链路全部执行完成，确认 `session-b` 隔离仍通过，同时暴露两项缺口（slash 直达未命中、失败后输入未持久化）。
- [x] 七轮增量：在 `SessionPage` 接入 slash 直达分流，并在 `chat.ts` 收敛“先落库 user 节点，再回填 assistant”失败路径持久化单路径。
- [x] 七轮执行：`/session` 修复复验 `3/3` 通过（slash 直达、刷新后用户输入保留、`session-b` 隔离保持）。
- [x] 七轮回归：`pnpm vitest run function/dialogue/__tests__/chat-first-message.test.ts app/session/__tests__/session-switch.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`；`pnpm exec eslint app/session/page.tsx function/dialogue/chat.ts function/dialogue/__tests__/chat-first-message.test.ts`；`pnpm exec tsc --noEmit`。
- [x] 八轮增量：补齐“普通输入触发 `401` 后刷新仍保留用户输入”浏览器独立证据（与七轮 slash 场景分离），并同步 pre/post 日志。
- [x] 八轮固化：新增 `pnpm p4:preflight` / `pnpm p4:session-dev` 固定入口，收敛 preflight + 本地调试启动路径。
- [x] 九轮增量：新增 `scripts/p4-session-replay-e2e.mjs` + `scripts/p4-session-replay-lib.mjs`，将 round7/round8 `/session` 复验收敛为单命令自动回放（自动注入 IndexedDB、自动断言、自动产物落盘）。
- [x] 九轮执行：`pnpm p4:session-replay` 实跑通过（`10` checkpoints 全绿：slash 直达、刷新持久化、会话隔离、普通输入 `401`）。
- [x] 九轮 CI 接入：新增 `.github/workflows/p4-session-replay.yml`，在 workflow 中接入 `pnpm p4:preflight` + `pnpm p4:session-replay` + 产物上传。
- [x] 十轮增量：在 `p4-session-replay` 增加“噪音基线差分”门禁（console/network 白名单 + 新增签名 fail-fast）。
- [x] 十轮执行：`pnpm p4:session-replay` 实跑通过（`11` checkpoints：原 `10` 项 + `noise-baseline-diff`，新增噪音签名 `0`）。
- [x] 十轮固化：新增基线文件 `docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json`，回放产物新增 `round10-noise-baseline-report.{md,json}`。
- [x] 十一轮增量：为 `p4-session-replay` 新增 run 聚合索引与规则健康审计（每次回放自动更新 `run-index`，并按连续 miss 阈值提示可清理规则）。
- [x] 十一轮执行：`pnpm vitest run scripts/__tests__/p4-session-replay-lib.test.ts`、`pnpm p4:session-replay` 实跑通过（`11/11` checkpoints，`unknownSignatureCount=0`）。
- [x] 十一轮固化：新增 `scripts/__tests__/p4-session-replay-lib.test.ts`、`artifacts/p4-session-replay-run-index.{json,md}`，并在 replay `summary` 中注入 run-index 引用与 `staleRuleCount`。
- [x] 十二轮方向收敛：暂停新增 CI 自动化能力，保留现有 `p4-session-replay` 可监测回归基线，回归主线 gap 收敛。
- [x] 固化失败截图/日志与复现步骤，纳入回归文档。
  - 场景映射与执行记录：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
  - 运行截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`
  - 二轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-pass.png`
  - 二轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-console-network.md`
  - 三轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-pass.png`
  - 三轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-console-network.md`
  - 四轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-pass.png`
  - 四轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-console-network.md`
  - 五轮截图（输入提交）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-input-pass.png`
  - 五轮截图（会话切换）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-pass.png`
  - 五轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console-network.md`
  - 五轮原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-network.log`
  - 六轮截图（slash 输入现状）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-slash-input-raw-path.png`
  - 六轮截图（刷新后状态）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-refresh-state.png`
  - 六轮截图（会话隔离复验）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-session-b-isolation-pass.png`
  - 六轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console-network.md`
  - 六轮原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-network.log`
  - 七轮截图（slash 直达通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-slash-direct-pass.png`
  - 七轮截图（刷新持久化通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-refresh-persistence-pass.png`
  - 七轮截图（会话隔离复验）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-session-b-isolation-pass.png`
  - 七轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-console-network.md`
  - 七轮原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-network.log`
  - 八轮截图（失败后刷新持久化通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-plain-refresh-pass.png`
  - 八轮 console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-console-network.md`
  - 八轮原始日志（刷新前）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-network.log`
  - 八轮原始日志（刷新后）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-network.log`
  - 九轮自动回放产物目录（示例 run）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/summary.md`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round7-slash-direct-pass.png`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round7-refresh-persistence-pass.png`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round7-session-b-isolation-pass.png`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round8-plain-refresh-pass.png`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round8-pre-refresh-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round8-pre-refresh-network.log`
  - 十一轮自动回放产物目录（正式 run）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r11-1772588355116/summary.md`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r11-1772588355116/round10-noise-baseline-report.md`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md`

## 每轮完成后的固定动作

- [x] 更新分析文档：`docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 更新本计划执行状态（勾选完成项 + 补充 blocker）。
