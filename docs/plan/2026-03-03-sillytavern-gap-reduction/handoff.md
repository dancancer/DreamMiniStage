# Handoff（2026-03-04 / 十三轮结构拆分验收）

## 本轮完成（主线优先）

- 已完成 `tasks.md` 中十三轮 3 项待办：`extension-handlers` 子模块拆分、shim 内部解耦、指定回归验收。
- 拆分结果（行为保持不变）：
  - `hooks/script-bridge/extension-handlers.ts`
    - 从“实现 + 门面”收敛为纯门面层。
    - 保持原有对外导出不变（`registerIframeDispatcher`、`handleFunctionToolResult`、`handleSlashCommandResult` 等）。
  - 新增 `hooks/script-bridge/function-tool-bridge.ts`
    - 承载函数工具注册表、`invokeFunctionTool` 回调等待、超时与清理。
  - 新增 `hooks/script-bridge/slash-command-bridge.ts`
    - 承载 `registerSlashCommand` 回调桥接、pending 管理、iframe 清理。
  - 新增 `hooks/script-bridge/iframe-dispatcher-registry.ts`
    - 统一管理 iframe dispatcher 注册与消息派发。
  - `public/iframe-libs/slash-runner-shim.js`
    - 抽离 `createSlashCommandBridge`（slash 回调注册与执行）。
    - 抽离 `createMessageDispatcher`（消息路由分发），移除巨型 switch 中的跨能力耦合。
  - `hooks/script-bridge/README.md`
    - 已同步文件清单与门面/子模块职责说明。

## 本轮验证（命令级）

```bash
pnpm exec eslint hooks/script-bridge/extension-handlers.ts hooks/script-bridge/function-tool-bridge.ts hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/iframe-dispatcher-registry.ts public/iframe-libs/slash-runner-shim.js
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：全部通过（`4 files / 66 tests`）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - 十三轮三项待办已全部勾选完成。

## 下一步建议（主线）

1. 继续推进 `registerSlashCommand` 参数语义等价性：补齐 `namedArgumentList/unnamedArgumentList` 在执行期的约束与错误语义。
2. 进入 parser 深语义收敛：`flags/debug/scope chain`，优先以 `st-baseline-slash-command` 可复现样本驱动。
3. 维持当前策略：不扩展 CI 能力面，仅在主线修复后按需复跑 `pnpm p4:session-replay` 做回归守卫。

---

## 历史记录（简版）

- 十三轮：`extension-handlers + slash-runner-shim` 结构拆分完成，指定回归全绿。
- 十二轮：`registerSlashCommand` iframe callback 闭环修复 + 方向回归主线。
- 十一轮 P4：新增 run-index 与规则健康审计，`11/11` 通过，新增噪音 `0`、stale 规则 `0`。
- 十轮 P4：新增噪音基线差分门禁，`11/11` 通过，新增噪音 `0`。
- 九轮 P4：round7+8 自动回放脚本落地并接入 CI，`10/10` 通过。
- 八轮 P4：普通输入 `401` 失败链路独立证据补齐，刷新后用户输入持久化通过。
- 七轮 P4：`/session` 修复复验 `3/3` 通过（slash 直达、刷新持久化、会话隔离）。
- 六轮 P4：审计链路 `3/3` 已执行，确认两项缺口（slash 直达未命中、失败后输入未持久化）。
- 五轮 P4：`/session` 真实 UI 场景 `1/1` 通过。
- P2/P3 指标门槛维持达标：Slash `30.23%`，TavernHelper API `60.77%`。
