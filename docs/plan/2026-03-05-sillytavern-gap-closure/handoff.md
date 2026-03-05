# Handoff（2026-03-05）

## 本轮完成

- 已完成上一轮建议第 1、2 项：note 命令簇 + persona 命令簇收敛。
- 新增 note 命令簇：
  - `/note`
  - `/note-depth|/depth`
  - `/note-frequency|/note-freq|/freq`
  - `/note-position|/note-pos|/pos`
  - `/note-role`
- 新增 persona 命令簇：
  - `/persona-set|/persona`
  - `/persona-lock`
  - `/persona-sync|/sync`
- 语义对齐（单路径 + fail-fast）：
  - note 命令统一走 `getAuthorNoteState/setAuthorNoteState`，字段（`text/depth/frequency/position/role`）全部做严格返回值校验。
  - `/note-position` 兼容 `before_scenario/scenario` 语义别名并归一化到 `before|after|chat`。
  - `/persona-set|/persona` 统一走 `getPersonaName/setPersonaName`；`mode` 严格限制 `lookup|temp|all`。
  - `/persona-lock` 在“查询”路径走 `getPersonaLockState`，在“写入”路径走 `setPersonaLock`，并严格要求布尔返回。
  - `/persona-sync|/sync` 统一走 `syncPersona`，宿主缺失时显式报错。
- Slash 上下文透传与默认实现补齐：
  - `ExecutionContext` 新增 `get/setAuthorNoteState`、`get/setPersonaName`、`getPersonaLockState`、`syncPersona`。
  - `ApiCallContext` / `adaptSlashExecutionContext` 新增对应透传位。
  - `slash-context-adapter` 新增默认本地实现：
    - note：localStorage 持久化 + 固定作用域注入 ID，与注入存储 `upsert/remove` 联动。
    - persona：本地 persona 名称存储 + lock 状态存储；当宿主实现 `setPersonaLock` 时自动回写 lock 快照。
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-note-persona-command-gaps.test.ts`（7 tests），覆盖 note/persona 主路径、别名和 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `74.18%`（上一轮 `70.66%`，+`3.52`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`note*`、`depth`、`freq`、`pos`、`persona*`。
- `pnpm vitest run lib/slash-command/__tests__/p3-note-persona-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`2 files / 10 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p3-closure-bind-command-gaps.test.ts lib/slash-command/__tests__/p3-stop-model-member-command-gaps.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`3 files / 20 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-note-persona-command-gaps.test.ts`：`13 files / 299 tests` 全通过。

## 下一步建议

1. 推进 profile 命令簇（`/profile`、`/profile-create`、`/profile-get`、`/profile-list`、`/profile-update`、`/ppp`），优先复用已落地的 localStorage 单路径与 strict return contract。
2. 推进 `/prompt` 与 `/prompt-post-processing`，复用现有 prompt entry 通道，减少并行状态源。
3. 推进低耦合工具命令（`/dupe`、`/length`、`/is-mobile`、`/newchat`），并为其补最小契约测试，继续提升 Top25 清理速度。
