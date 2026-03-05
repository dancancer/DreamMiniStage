# Handoff（2026-03-05）

## 本轮完成

- 完成 P2 聊天编辑高频缺口第一批收敛（对应上一轮 handoff 的第 1 条建议）。
  - 新增命令：`/delchat`、`/delete`、`/delmode`、`/delname`、`/delswipe`。
  - 对齐别名：`/cancel`（`/delname`）、`/swipedel`（`/delswipe`）。
  - 语义策略：坚持单路径 + fail-fast。
    - `/delmode` 与 `/delete` 收敛为“删除最后 N 条消息（默认 1）”。
    - `/delchat`、`/delswipe` 在宿主未注入能力时显式报错。
- 扩展 Slash 执行上下文能力面，补齐命令闭环所需接口：
  - `deleteCurrentChat`
  - `deleteMessagesByName`
  - `deleteSwipe`
- 同步能力矩阵与 gap 报告：
  - 更新 `hooks/script-bridge/capability-matrix.ts` 的 Slash 声明。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}` 最新报告。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `31.22%`（上一轮 `29.58%`，+`1.64`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`：`1 file / 13 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-message-command-aliases.test.ts`：`1 file / 4 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec eslint lib/slash-command/registry/handlers/chat.ts lib/slash-command/registry/index.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts hooks/script-bridge/capability-matrix.ts lib/slash-command/types.ts`：通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`
  - 补 `/delchat` `/delete` `/delmode` `/delname` `/delswipe` 与别名覆盖。
  - 补非法参数与宿主缺失时的 fail-fast 断言。

## 下一步建议

1. 收敛 world/lore 语义别名：补齐 `/getcharbook` `/getchatbook` `/getglobalbooks` `/getpersonabook` 到统一数据路径。
2. 推进消息元数据命令：`/message-name` `/message-role` `/getpromptentry`，补齐脚本端消息运维能力。
3. 把 `deleteCurrentChat/deleteSwipe` 接入真实 UI 回调，实现命令从“可执行”到“可见效果”的闭环验证。
