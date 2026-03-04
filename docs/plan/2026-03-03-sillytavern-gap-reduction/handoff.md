# Handoff（2026-03-04 / Round 31）

> 历史完成项已归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前执行结果

- 本轮继续按“先断言后实现”推进 parser 深语义第二切片，聚焦 nested block 中 `REPLACE_GETVAR` + strict 转义链路组合。
- 变更文件：
  - `lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts`（新增）：新增 2 条断言覆盖
    1) `REPLACE_GETVAR + STRICT_ESCAPING` 在 nested block 内对 named/unnamed 参数都能稳定替换 `{{getvar::...}}/{{getglobalvar::...}}`，且引号字面量中的 `{:/:}` 不破坏 block 解析；
    2) even-backslash quote 边界在 nested strict block 下保持 fail-fast（`Unclosed quote under STRICT_ESCAPING`）。
- 覆盖率指标本轮保持不变：Slash `80 / 258 = 31.01%`、TavernHelper API `124 / 130 = 95.38%`。
- 回归结果：parser 回归 `2 files / 24 tests` 全绿（`kernel-core 22 + nested-flags 2`）；固定回归 `3 files / 24 tests` 全绿；`eslint + tsc` 全绿。

## 2) 当前主线焦点

1. parser 深语义第二切片剩余边界（parser-flag 在更深层 block 的开关切换组合）。
2. TavernHelper 长尾 helper 能力（`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`、`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）。
3. 低频 slash 按真实触发失败机会性补齐。

## 3) 下一步建议

1. 在 `block-depth >= 2` 场景补 parser-flag 动态切换断言（`STRICT_ESCAPING`/`REPLACE_GETVAR` 在同一脚本不同层级切换），再决定是否需要收敛 flag 传播语义。
2. 对 `builtin/setChatMessage/rotateChatMessages` 做真实素材触发验证；只在出现迁移阻塞时补最小单路径实现。
3. 对 script tree helper（`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）做触发性验证，触发失败再补实现。
4. 主线修复后按需执行 `pnpm p4:session-replay` 作为守卫，不扩能力面。

## 4) 固定验证命令

```bash
pnpm vitest run \
  lib/slash-command/__tests__/kernel-core.test.ts \
  lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts

pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec eslint \
  lib/slash-command/core/parser.ts \
  lib/slash-command/__tests__/kernel-core.test.ts \
  lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts \
  public/iframe-libs/slash-runner-shim.js \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec tsc --noEmit
```
