# Handoff（2026-03-05）

## 本轮完成

- 完成 P2 world/lore 语义别名收敛（对应上一轮 handoff 的第 1 条建议）。
  - 新增命令：`/getcharbook`、`/getchatbook`、`/getglobalbooks`、`/getpersonabook`。
  - 统一到既有 lore 数据路径，不引入第二实现分支。
- 完成消息元数据命令补齐（对应上一轮 handoff 的第 2 条建议）。
  - 新增命令：`/message-role`、`/message-name`。
  - 支持 `at=<index>`（含负索引）定位，默认作用于最后一条消息。
  - 保持 fail-fast：非法索引/非法 role 立即报错。
- 完成 prompt entry 开关命令闭环（扩展上一轮第 2 条建议）。
  - 新增命令：`/getpromptentry`、`/getpromptentries`、`/setpromptentry`、`/setpromptentries`。
  - 支持 `identifier`/`name` 双路径定位与 `simple/list/dict` 返回模式。
  - 在 Script Bridge 上下文中接入 active preset 的 prompt 状态读写（`listPromptEntries` + `setPromptEntriesEnabled`）。
- 同步能力矩阵与 gap 报告。
  - 更新 `hooks/script-bridge/capability-matrix.ts`、`lib/slash-command/registry/index.ts`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `33.57%`（上一轮 `31.22%`，+`2.35`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p2-message-command-aliases.test.ts lib/slash-command/__tests__/p2-prompt-entry-command-gaps.test.ts`：`3 files / 15 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec eslint hooks/script-bridge/capability-matrix.ts hooks/script-bridge/slash-context-adapter.ts lib/slash-command/registry/handlers/generation.ts lib/slash-command/registry/handlers/messages.ts lib/slash-command/registry/index.ts lib/slash-command/types.ts lib/slash-command/__tests__/p2-message-command-aliases.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p2-prompt-entry-command-gaps.test.ts`：通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 新增 `lib/slash-command/__tests__/p2-prompt-entry-command-gaps.test.ts`
  - 覆盖 `/getpromptentry*` 与 `/setpromptentry*` 的返回形态、状态切换与 fail-fast 场景。
- 更新 `lib/slash-command/__tests__/p2-message-command-aliases.test.ts`
  - 补充 `/message-role`、`/message-name` 的读取/写入/非法参数断言。
- 更新 `lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts`
  - 补充 `get*book` 别名命令与既有 lore 命令的统一路径断言。

## 下一步建议

1. 补齐 world-info 字段别名命令：`/getentryfield`、`/setentryfield`，与现有 `get/setlorefield` 语义统一。
2. 推进会话运维命令：`/getchatname`、`/setinput`，继续削减 P2 顶部缺口。
3. 将 `delchat/delswipe/message-*` 接入真实 UI 回调，补“命令执行 -> 界面可见”闭环验证。
