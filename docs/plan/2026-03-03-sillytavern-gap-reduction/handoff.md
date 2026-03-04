# Handoff（2026-03-04 / 十六轮 parser 深语义第一切片）

## 本轮完成（主线优先）

- 已完成 `flags/debug/scope chain` 最小可复现语义落地：
  - `lib/slash-command/core/parser.ts` 接入 `/parser-flag` 指令（`STRICT_ESCAPING`、`REPLACE_GETVAR`）。
  - `STRICT_ESCAPING=on` 时未闭合引号改为显式 fail-fast；`REPLACE_GETVAR=on` 时统一归一 `{{getvar::}}/{{getglobalvar::}}`。
  - debug 开启时 `/breakpoint` 转换为可执行 `breakpoint` 节点；关闭时安全忽略。
- 已完成 parser -> executor 执行期元数据透传增强：
  - `CommandNode` 新增 `parserFlags/scopeDepth`；
  - `CommandInvocationMeta` 新增 `parserFlags/scopeDepth` 并透传到 handler。
- 已完成 debug 监控增强：
  - `lib/slash-command/core/debug.ts` 新增 `debug:breakpoint` 事件；
  - `lib/slash-command/core/executor.ts` 命中断点时发射事件，且不中断主流程。
- 已完成基线断言固化：
  - `lib/slash-command/__tests__/kernel-core.test.ts` 新增 parser flag、生效顺序、scopeDepth 与 breakpoint 事件断言。
  - `lib/core/__tests__/st-baseline-slash-command.test.ts` 新增 `STRICT_ESCAPING`、`/breakpoint`、`/let` scope chain 行为断言。

## 本轮验证（命令级）

```bash
pnpm exec eslint lib/slash-command/core/parser.ts lib/slash-command/core/executor.ts lib/slash-command/core/debug.ts lib/slash-command/core/types.ts lib/slash-command/executor.ts lib/slash-command/parser.ts lib/slash-command/types.ts lib/slash-command/index.ts lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
pnpm exec tsc --noEmit
```

- 结果：全部通过（`vitest: 2 files / 74 tests`，`eslint` 无告警，`tsc` 通过）。

## 计划状态同步

- `docs/plan/2026-03-03-sillytavern-gap-reduction/tasks.md`
  - `P1` 首项（`flags/debug/scope chain`）已勾选完成。
  - `P1` 仍待推进 2 项：regex 素材驱动回归、worldbook 组合语义回归。

## 下一步建议（主线）

1. 执行 P1 第二切片：新增 `V2.0Beta.png + Sgw3.*` 的 `regex_scripts` 组合回归（`runOnEdit/substituteRegex/minDepth/maxDepth`）。
2. 执行 P1 第三切片：补 `worldbook` 组合语义断言（`probability/useProbability/depth/group/groupWeight`）。
3. 每个切片完成后按需复跑 `pnpm p4:session-replay`，仅作为守卫基线，不扩展 CI 能力面。

---

## 历史记录（简版）

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
