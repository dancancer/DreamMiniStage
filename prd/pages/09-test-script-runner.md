# 09. Test Script Runner

> 路由：`/test-script-runner`
> 类型：内部验证页面，不属于普通用户主流程。

## 1. 用户目标

工程/QA 用户在浏览器内手动运行 P4 Playwright/MCP E2E 场景，验证 script bridge、slash command、MVU、audio host 与 fail-fast 行为。

## 2. 页面结构

- 标题：`SillyTavern P4 Playwright E2E 控制台`。
- 汇总区：运行全部、执行进度、started/finished 时间。
- 场景卡片：主链路/故障注入、单独执行按钮、状态、耗时。
- JSON report：输出本次运行详情。

## 3. 场景清单

| ID | 类型 | 期望 |
|----|------|------|
| `script-tool-loop` | 主链路 | function tool 注册和 iframe 回调闭环 |
| `slash-control-flow` | 主链路 | while/if 宏条件稳定输出 |
| `mvu-variable-chain` | 主链路 | MVU 变量 replace/update/insert 链路一致 |
| `audio-event-chain` | 主链路 | audio command + event emit 可观测 |
| `tool-timeout-failfast` | 故障注入 | tool call 超时显式失败 |
| `macro-unknown-failfast` | 故障注入 | 未知宏表达式显式失败 |
| `reload-page-failfast` | 故障注入 | 缺少 reload-page 回调显式失败 |
| `audio-callback-missing-failfast` | 故障注入 | 缺少 audio host 回调显式失败 |
| `chain-failfast-consistency` | 故障注入 | 中段失败后后续命令不继续执行 |

## 4. 数据与依赖

- `app/test-script-runner/scenarios.ts`
- `app/test-script-runner/scenario-helpers.ts`
- `hooks/script-bridge/extension-handlers.ts`
- `lib/slash-command/executor.ts`
- `hooks/script-bridge/scoped-variables.ts`

## 5. 业务规则

- 运行中禁用按钮，避免并行场景污染全局桥接状态。
- 单个场景结果按 ID 覆盖旧结果。
- 报告必须能被自动测试通过 `data-testid="p4-e2e-report"` 读取。
- 不应将该页面放入普通用户主导航。
