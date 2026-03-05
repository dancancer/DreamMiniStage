# Handoff（2026-03-05）

## 本轮完成

- 完成 world-info 字段别名命令收敛（对应上一轮 handoff 第 1 条建议）。
  - 新增命令：`/getentryfield`、`/setentryfield`。
  - 统一复用既有 `get/setlorefield` 处理器，保持单路径实现与 fail-fast 错误语义。
- 完成会话运维命令补齐（对应上一轮 handoff 第 2 条建议）。
  - 新增命令：`/getchatname`、`/setinput`。
  - `/setinput` 支持位置参数、`text=` 命名参数与 pipe 三种输入来源；无输入时清空输入框。
- 打通命令到宿主上下文的可见闭环。
  - 在 Script Bridge 注入 `onGetChatName/onSetInput`，并透传到 Slash 执行上下文。
  - 在会话页与聊天面板接入回调：`/getchatname` 可读取当前会话名，`/setinput` 可直接改写 UI 输入框。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `34.51%`（上一轮 `33.57%`，+`0.94`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`：`2 files / 20 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec eslint app/session/page.tsx components/CharacterChatPanel.tsx hooks/script-bridge/capability-matrix.ts hooks/script-bridge/slash-context-adapter.ts hooks/script-bridge/types.ts hooks/useScriptBridge.ts lib/slash-command/registry/handlers/chat.ts lib/slash-command/registry/index.ts lib/slash-command/types.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts`：通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts`
  - 补充 `/getentryfield` 与 `/setentryfield` 别名闭环断言。
- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`
  - 补充 `/getchatname` 与 `/setinput` 的功能/输入来源/fail-fast 断言。

## 下一步建议

1. 推进会话运维命令：`/set-reasoning`、`/get-reasoning`、`/listinjects`，继续削减 P2 Top gaps。
2. 推进群聊编辑命令：`/addmember`、`/addswipe`、`/getmember`，补齐多人会话主流程能力。
3. 为 `delchat/delswipe/message-*` 增加 “命令执行 -> UI 可见变化” 的集成级断言，强化端到端守卫。
