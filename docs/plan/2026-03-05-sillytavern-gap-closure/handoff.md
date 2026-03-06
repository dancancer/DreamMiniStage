# Handoff（2026-03-06）

## 本轮完成

- 补齐 sysprompt 命令簇：`/sysprompt`、`/system-prompt`、`/sysprompt-on`、`/sysprompt-enable`、`/sysprompt-off`、`/sysprompt-disable`、`/sysprompt-state`、`/sysprompt-toggle`，统一到单一路径 `localStorage` sysprompt store。
- 补齐 `sysname` 与 `sysgen`：
  - `/sysname` 读写系统旁白显示名。
  - `/sysgen` 复用现有 `generateQuiet/generate` 生成路径，并把结果通过 `onSendSystem` 单路径写回会话。
- `/sys` 现在会复用系统旁白显示名，并支持与 `/sysgen` 一致的消息插入选项（`at` / `name` / `compact` / `return`），不再分叉成第二套发送逻辑。
- 会话消息写入路径已补齐 role-message 选项透传：`onSendSystem`、Dialogue Store `addRoleMessage` 现在都支持 `at/name/compact`，系统消息可正确保留显示名并按位置插入。
- 系统/旁白/自定义角色消息头现在会显示 `message.name`，因此 `sysname`/`sysgen name=` 写入的显示名在 UI 中可见。
- 新增契约测试：`lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts`（4 tests），覆盖 sysprompt 状态切换、`sysname -> /sys` 联动、`/sysgen` trim/插入选项与 fail-fast。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts lib/slash-command/__tests__/p1-messages.test.ts lib/slash-command/__tests__/p2-message-command-aliases.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 19 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts lib/slash-command/__tests__/p1-messages.test.ts lib/slash-command/__tests__/p2-message-command-aliases.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`16 files / 311 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`89.67%`（上一轮 `87.32%`，+`2.35`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`sysprompt`、`sysprompt-enable`、`sysprompt-disable`、`sysprompt-on`、`sysprompt-off`、`sysprompt-state`、`sysprompt-toggle`、`sysname`、`sysgen`

## 下一步建议

1. 直接收口媒体/画廊长尾：`/show-gallery|/sg`、`/expression-upload`。这组和本轮一样，适合走宿主回调单路径，能继续以较低回归面换覆盖率。
2. 做 `qr-arg`，但不要只补命令壳；下一轮应直接落 `{{arg::...}}` 宏解析与 `*` wildcard 语义，否则只是把复杂度后移。
3. 收敛工具/标签簇：`/tool-list`、`/tool-invoke`、`/tag-add`、`/tag-remove`、`/tag-list`、`/tag-exists`。仓内已经有工具注册表与角色元数据存储，这组命令能复用现有结构，不需要新造系统。
