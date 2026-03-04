# Handoff（2026-03-04 / 十四轮参数语义收敛）

## 本轮完成（主线优先）

- 已完成 `registerSlashCommand` 参数语义收敛（执行期）：
  - 在 `hooks/script-bridge/slash-command-bridge.ts` 增加 `namedArgumentList/unnamedArgumentList` 约束校验。
  - 当命令定义包含参数声明时，以下路径统一显式 fail-fast：
    - 缺失必填命名参数
    - 出现未声明命名参数
    - 位置参数数量超出定义上限（未声明 `acceptsMultiple`）
- 已补齐 callback 参数视图透传：
  - 本地 callback 上下文新增结构化 `namedArgumentList/unnamedArgumentList`。
  - iframe 桥接消息 `SLASH_COMMAND_CALL` 新增 `unnamedArgs` 与结构化参数列表载荷。
  - `public/iframe-libs/slash-runner-shim.js` 已接入并将结构化参数注入 callback 的运行时上下文。
- 已补齐专项回归：
  - 扩展 `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`，新增参数约束失败路径与结构化上下文断言。
- 已同步文档：
  - `hooks/script-bridge/README.md` 增加参数约束与上下文透传说明。
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md` 增加并勾选十四轮 3 项执行条目。

## 本轮验证（命令级）

```bash
pnpm exec eslint hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/__tests__/extension-lifecycle.test.ts public/iframe-libs/slash-runner-shim.js
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：全部通过（`3 files / 67 tests`）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - 新增并完成十四轮 3 项待办（参数约束、上下文透传、专项回归）。

## 下一步建议（主线）

1. 进入 parser 深语义收敛：`flags/debug/scope chain`，以 `st-baseline-slash-command` 的可复现样本增量推进。
2. 继续收敛 `registerSlashCommand` 余量语义：`acceptsMultiple/defaultValue/rawQuotes` 与重复命名参数行为（当前 parser 对重复命名参数仍会覆盖）。
3. 维持当前策略：不扩展 CI 能力面，仅在主线修复后按需复跑 `pnpm p4:session-replay` 做回归守卫。

---

## 历史记录（简版）

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
- P2/P3 指标门槛维持达标：Slash `30.23%`，TavernHelper API `60.77%`。
