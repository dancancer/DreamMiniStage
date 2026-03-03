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

- [ ] 从 `test-baseline-assets` 与现有脚本样本统计 Top N 高频缺失命令。
- [ ] 每次仅补一个命令族（参数签名 + 错误语义 + 测试）。
- [ ] 每次补齐后更新覆盖率快照（总量/交集/覆盖率）。
- [ ] 目标：Slash 覆盖率提升到 `>= 30%`。

## P3 - TavernHelper API 缺口收敛

- [x] 优先补 import_raw / script buttons / version 相关 API。
- [x] 按需补 extension 管理 API（不支持路径需 fail-fast）。
- [x] 保持 shim 与 capability matrix 同步更新。
- [x] 目标：TavernHelper API 覆盖率提升到 `>= 55%`。

## P4 - Playwright MCP E2E（满足门槛后执行）

- [ ] 准备 `test-baseline-assets` 场景映射（脚本、会话、变量链路）。
- [ ] 编写并执行 Playwright MCP E2E（脚本工具、Slash 控制流、MVU 更新、音频事件）。
- [ ] 固化失败截图/日志与复现步骤，纳入回归文档。

## 每轮完成后的固定动作

- [x] 更新分析文档：`docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 更新本计划执行状态（勾选完成项 + 补充 blocker）。
