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
- [x] 固化失败截图/日志与复现步骤，纳入回归文档。
  - 场景映射与执行记录：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
  - 运行截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`

## 每轮完成后的固定动作

- [x] 更新分析文档：`docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 更新本计划执行状态（勾选完成项 + 补充 blocker）。
