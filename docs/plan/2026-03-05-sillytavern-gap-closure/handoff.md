# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1、2 项：图像命令簇 + instruct 命令簇收敛。
  - 新增图像命令：`/imagine`、`/image`、`/img`、`/imagine-source`、`/img-source`、`/imagine-style`、`/img-style`、`/imagine-comfy-workflow`、`/icw`。
  - 新增 instruct 命令：`/instruct`、`/instruct-on`、`/instruct-off`、`/instruct-state`、`/instruct-toggle`。
- 语义对齐（单路径 + fail-fast）：
  - `/imagine|/image|/img` 统一走 `generateImage(prompt, options)`；命名参数（`quiet/extend/edit/multimodal/snap/seed/width/height/steps/cfg/...`）统一做严格解析，非法值直接报错。
  - `/imagine-source|/img-source`、`/imagine-style|/img-style`、`/imagine-comfy-workflow|/icw` 统一走 `getImageGenerationConfig/setImageGenerationConfig`，并校验宿主返回快照结构（`source/style/comfyWorkflow`）。
  - `/instruct*` 统一走 `getInstructMode/setInstructMode`，并校验返回契约（`enabled:boolean`、`preset:string|null`）；`forceGet/quiet/state` 参数均为严格布尔语义。
- 补齐 Slash 上下文透传与能力声明闭环：
  - `ExecutionContext` 新增 `generateImage/getImageGenerationConfig/setImageGenerationConfig/getInstructMode/setInstructMode`。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传能力。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `hooks/script-bridge/README.md`。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts`（6 tests），覆盖 image/instruct 命令主路径、别名与 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `65.73%`（上一轮 `62.44%`，+`3.29`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`image|img|imagine*`、`instruct*`、`icw`。
- `pnpm vitest run lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts`：`1 file / 6 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/slash-command/__tests__/p3-caption-audio-command-gaps.test.ts`：`2 files / 22 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-image-instruct-command-gaps.test.ts`：`3 files / 14 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。

## 下一步建议

1. 推进 `/custom-stop-strings|/custom-stopping-strings`（可先对齐到单一路径 stop-strings 状态读写）。
2. 推进群聊成员编排长尾（`/member-up|/member-down|/member-peek|/member-remove` 及其别名），复用现有 `member-*` 回调能力。
3. 补齐 `/model` 与 `/name|/nar|/narrate` 的最小可执行闭环，并为成员编排命令增加结果可见断言。
