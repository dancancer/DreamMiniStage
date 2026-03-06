# Handoff（2026-03-06）

## 本轮完成

- 已完成上一轮建议第 1 项，并完成第 2 项中的主体命令：Quick Reply 第二批 + 第三批（除 `/qr-arg`）以及 set/preset 运维命令已收敛。
- 新增 Quick Reply 第二/三批命令：
  - `/qr-set`
  - `/qr-set-on`
  - `/qr-set-off`
  - `/qr-chat-set`
  - `/qr-chat-set-on`
  - `/qr-chat-set-off`
  - `/qr-set-list`
  - `/qr-update`
  - `/qr-contextadd`
  - `/qr-contextdel`
  - `/qr-contextclear`
- 新增 Quick Reply set/preset 运维命令：
  - `/qr-set-create`
  - `/qr-presetadd`
  - `/qr-set-update`
  - `/qr-presetupdate`
  - `/qr-set-delete`
  - `/qr-presetdelete`
- 语义对齐（单路径 + fail-fast）：
  - `/qr-set|/qr-set-on|/qr-chat-set|/qr-chat-set-on` 统一透传 `visible` 布尔参数，默认 `true`，非法值显式报错。
  - `/qr-set-list` 支持 `all|global|chat` 三种来源，宿主返回 `string[]` 或 `[{ name }]` 时统一输出 JSON 名称数组。
  - `/qr-update` 统一透传 `updateQuickReply(set, target, options)`，`id` 优先于 `label`，补齐 `newlabel/message/icon/showlabel/hidden/startup/user/bot/load/new/group/generation/title/automationId` 契约校验。
  - `/qr-contextadd|/qr-contextdel|/qr-contextclear` 统一透传上下文菜单集合增删清；`chain` 布尔参数显式校验，`id` 继续优先于 `label`。
  - `/qr-set-create|/qr-set-update|/qr-set-delete` 与 `qr-preset*` 别名统一到 set 运维单路径，收敛 `nosend/before/inject` 三个布尔参数语义。
- Slash 上下文透传扩展：
  - `ExecutionContext` 新增能力位：
    - `toggle/add/removeGlobalQuickReplySet`
    - `toggle/add/removeChatQuickReplySet`
    - `listQuickReplySets`
    - `updateQuickReply`
    - `add/remove/clearQuickReplyContextSet(s)`
    - `create/update/deleteQuickReplySet`
  - `ApiCallContext` / `useScriptBridge` / `adaptSlashExecutionContext` 新增对应透传位：
    - `onToggle/Add/Remove(Global|Chat)QuickReplySet`
    - `onListQuickReplySets`
    - `onUpdateQuickReply`
    - `onAdd/Remove/ClearQuickReplyContextSet(s)`
    - `onCreate/Update/DeleteQuickReplySet`
- 新增契约测试：
  - `lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts`（6 tests），覆盖 Quick Reply 第二/三批与 set/preset 运维命令的主路径、别名、参数校验与 fail-fast 场景。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `83.33%`（上一轮 `79.34%`，+`3.99`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
  - Top25 已移除：`qr-set`、`qr-set-on`、`qr-set-off`、`qr-chat-set`、`qr-chat-set-on`、`qr-chat-set-off`、`qr-set-list`、`qr-update`、`qr-contextadd`、`qr-contextdel`、`qr-contextclear`、`qr-presetadd`、`qr-presetupdate`、`qr-presetdelete`、`qr-set-create`、`qr-set-update`、`qr-set-delete`。
- `pnpm vitest run lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`3 files / 19 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts lib/slash-command/__tests__/p3-quickreply-set-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`15 files / 311 tests` 全通过。

## 下一步建议

1. 推进 `/qr-arg`，但这轮不要只补 handler；直接补到 `{{arg::...}}` 宏解析与 `*` wildcard 语义，避免留下“命令存在但宏不可用”的半成品。
2. 收敛低耦合剩余长尾（`/forcesave`、`/hide`、`/expression-upload`、`/proxy`），这批命令对 Slash coverage 提升仍然划算，而且宿主回调形态相对简单。
3. 继续推进当前 Top25 中的轻量配置命令（`/reasoning-formatting`、`/reasoning-preset`、`/reasoning-template`、`/rename-char`、`/renamechat`）；`/qrset` 属于已废弃旧语法，受仓库“禁止新增兼容分支”约束，除非当前会话得到明确批准，否则继续保持不实现。
