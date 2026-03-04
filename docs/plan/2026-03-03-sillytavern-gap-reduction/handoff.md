# Handoff（2026-03-04 / 聚焦版）

> 历史完成项已归档：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`

## 1) 当前执行结果

- 本轮已完成 `raw_character` 深层对象最小闭环：`RawCharacter/Character` + `getCharAvatarPath`。
- TavernHelper API 覆盖率提升到 `113 / 130 = 86.92%`。
- 指定回归保持全绿：`3 files / 22 tests`，并通过 `eslint + tsc`。

## 2) 当前主线焦点

1. parser 深语义第二切片（严格转义 + parser 指令交互）。
2. TavernHelper 长尾 helper 能力（`_bind/_th_impl`、音频 helper 别名）。
3. 低频 slash 按真实触发失败机会性补齐。

## 3) 下一步建议

1. 先补 parser 断言，再补行为实现（避免语义回退）。
2. 以 fail-fast 方式补 `_bind/_th_impl` 与 `audioEnable/audioImport/audioMode/audioPlay/audioSelect`。
3. 每轮主线增量后按需执行 `pnpm p4:session-replay` 作为守卫。

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
