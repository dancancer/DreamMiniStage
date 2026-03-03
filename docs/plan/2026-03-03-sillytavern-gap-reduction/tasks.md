# 执行清单（按优先级）

## P0 - 工具调用闭环（先做）

- [x] 收敛 `registerFunctionTool` 注册表为单路径（注册/调用/卸载共用一套状态源）。
- [x] 打通 `LLMNodeTools` 的 `tool_calls` 到脚本工具回调执行。
- [x] 在 shim + handler 补齐 `registerVariableSchema`、`updateVariablesWith`、`insertVariables`。
- [x] 为函数工具新增端到端单测（同步/异步 callback + 超时/异常返回）。
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

## 每轮完成后的固定动作

- [x] 更新分析文档：`docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 更新本计划执行状态（勾选完成项 + 补充 blocker）。
