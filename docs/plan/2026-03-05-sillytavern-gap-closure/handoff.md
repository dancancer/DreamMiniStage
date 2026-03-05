# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1、2 项：profile 命令簇 + prompt 长尾命令收敛。
- 新增 profile 命令簇：
  - `/profile`
  - `/profile-list`
  - `/profile-create`
  - `/profile-update`
  - `/profile-get`
- 新增 prompt 长尾命令：
  - `/prompt`
  - `/prompt-post-processing|/ppp`
- 语义对齐（单路径 + fail-fast）：
  - `/profile` 统一走 `getCurrentProfileName/setCurrentProfileName`，支持 `await` 与 `timeout` 参数校验，`<None>` 走显式清空路径。
  - `/profile-list`、`/profile-create`、`/profile-update`、`/profile-get` 全量校验宿主返回契约（profile 必须包含 `id/name`）。
  - `/prompt` 复用既有 prompt entry 通道：无 state 走 `getpromptentry` 语义，有 state 走 `setpromptentry` 语义，避免并行状态源。
  - `/prompt-post-processing|/ppp` 统一走 `get/setPromptPostProcessing`，读取默认回 `none`，写入 `none` 归一化为 `""`。
- Slash 上下文透传与默认实现补齐：
  - `ExecutionContext` 新增 profile/prompt-post-processing 能力位：`get/setCurrentProfileName`、`list/create/update/getConnectionProfile`、`get/setPromptPostProcessing`。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传位。
  - `slash-context-adapter` 新增默认本地实现：
    - profile：`localStorage` 持久化 `connection-profiles + selected-profile`。
    - prompt-post-processing：`localStorage` 持久化 `prompt-post-processing`。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts`（7 tests），覆盖 profile/prompt 主路径、别名、参数校验和 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `76.06%`（上一轮 `74.18%`，+`1.88`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`profile`、`profile-create`、`profile-get`、`profile-list`、`profile-update`、`prompt`、`prompt-post-processing`、`ppp`。
- `pnpm vitest run lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts`：`1 file / 7 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-prompt-entry-command-gaps.test.ts lib/slash-command/__tests__/p3-note-persona-command-gaps.test.ts`：`2 files / 10 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-profile-prompt-command-gaps.test.ts`：`13 files / 299 tests` 全通过。

## 下一步建议

1. 推进低耦合工具命令簇（`/dupe`、`/length`、`/is-mobile`、`/newchat`），优先复用 utility/chat 现有上下文回调，快速清理 Top25。
2. 推进导入/弹窗命令簇（`/import`、`/popup`、`/pick-icon`），先补宿主透传能力，再补最小契约测试。
3. 为 `member-*/addswipe`、`data-bank-search`、`vector-worldinfo-state` 增加端到端“结果可见”断言，避免功能存在但不可见的回归。
