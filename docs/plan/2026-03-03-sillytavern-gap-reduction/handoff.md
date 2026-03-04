# Handoff（2026-03-04 / Round 29）

> 历史完成项已归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前执行结果

- 本轮完成 parser 深语义第二切片的 block/quote 交互边界：`{: :}` block 内部引号文本出现 `{:/:}` 时不再误判为 block 分隔符。
- 变更文件：
  - `lib/slash-command/core/parser.ts`：`readBlock` 新增引号/转义感知；仅在非引号上下文识别 `{:/:}`。
  - `lib/slash-command/__tests__/kernel-core.test.ts`：新增 2 条断言覆盖
    1) block 内引号字面量包含 `{:/:}`；
    2) `STRICT_ESCAPING` + 混合引号下的 block 解析稳定性。
- 覆盖率指标本轮保持不变：Slash `80 / 258 = 31.01%`、TavernHelper API `124 / 130 = 95.38%`。
- 回归结果：`kernel-core 1 file / 20 tests` 全绿（较上轮新增 2 条）；固定回归 `3 files / 24 tests` 全绿；`eslint + tsc` 全绿。

## 2) 当前主线焦点

1. parser 深语义第二切片剩余边界（多层 block + 反斜杠逃逸组合）。
2. TavernHelper 长尾 helper 能力（`builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`、`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）。
3. 低频 slash 按真实触发失败机会性补齐。

## 3) 下一步建议

1. parser 继续按“先断言后实现”推进，优先补 `block-depth > 1` 且包含 escaped quote/escaped backslash 的语义断言。
2. 对 `builtin/setChatMessage/rotateChatMessages` 做真实素材触发验证；只在出现迁移阻塞时补最小单路径实现。
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
