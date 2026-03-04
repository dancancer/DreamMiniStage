# Handoff（2026-03-04 / Round 28）

> 历史完成项已归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前执行结果

- 本轮完成 parser 深语义第二切片首批落地：`STRICT_ESCAPING` 下 escaped quote/pipe 解析与 parser-flag（`STRICT_ESCAPING/REPLACE_GETVAR`）交互边界收敛。
- 变更文件：
  - `lib/slash-command/core/parser.ts`：`splitTopLevel/tokenize` 按反斜杠计数识别被转义引号，避免误分段。
  - `lib/slash-command/__tests__/kernel-core.test.ts`：新增 2 条断言覆盖 strict 开关切换与宏替换联动。
- 覆盖率指标本轮保持不变：Slash `80 / 258 = 31.01%`、TavernHelper API `124 / 130 = 95.38%`。
- 回归结果：`kernel-core 1 file / 18 tests` 全绿；固定回归 `3 files / 24 tests` 全绿；`eslint + tsc` 全绿。

## 2) 当前主线焦点

1. parser 深语义第二切片剩余边界（block 嵌套 + 混合引号）。
2. TavernHelper 长尾 helper 能力（`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`、`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）。
3. 低频 slash 按真实触发失败机会性补齐。

## 3) 下一步建议

1. 在 parser 继续按“先断言后实现”推进剩余 strict 边界，优先补 block 嵌套里的引号/管道交互。
2. 用真实迁移素材先验证 `builtin/setChatMessage/rotateChatMessages` 是否构成阻塞；有阻塞再补单路径实现，无阻塞保持显式 fail-fast。
3. 对 script tree helper（`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）做触发性验证，触发失败再补实现。
4. 主线修复后按需执行 `pnpm p4:session-replay` 作为守卫，不扩能力面。

## 4) 固定验证命令

```bash
pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts

pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec eslint \
  lib/slash-command/core/parser.ts \
  lib/slash-command/__tests__/kernel-core.test.ts \
  public/iframe-libs/slash-runner-shim.js \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts

pnpm exec tsc --noEmit
```
