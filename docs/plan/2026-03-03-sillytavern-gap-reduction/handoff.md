# Handoff（2026-03-04 / 聚焦版）

> 历史完成项已归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前执行结果

- 本轮已完成 preset helper 常量族闭环：`isPresetNormalPrompt/isPresetSystemPrompt/isPresetPlaceholderPrompt/default_preset`。
- TavernHelper API 覆盖率提升到 `124 / 130 = 95.38%`（较上一轮 +4）。
- 指定回归保持全绿：`3 files / 24 tests`，并通过 `eslint + tsc`。

## 2) 当前主线焦点

1. parser 深语义第二切片（严格转义 + parser 指令交互）。
2. TavernHelper 长尾 helper 能力（`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`、`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）。
3. 低频 slash 按真实触发失败机会性补齐。

## 3) 下一步建议

1. 先补 parser 断言，再补行为实现（避免语义回退）。
2. 评估 `builtin/setChatMessage/rotateChatMessages` 是否存在真实阻塞，阻塞存在时优先走单路径实现；无阻塞时维持显式 fail-fast。
3. 评估 script tree helper 是否存在真实触发失败，再决定是否补齐。
4. 每轮主线增量后按需执行 `pnpm p4:session-replay` 作为守卫。

## 4) 固定验证命令

```bash
pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec eslint \
  public/iframe-libs/slash-runner-shim.js \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec tsc --noEmit
```
