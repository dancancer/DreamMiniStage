# Handoff（2026-03-05）

## 本轮完成

- 完成群聊编辑命令簇收敛（对应上一轮 handoff 第 1 条建议）。
  - 新增命令：`/member-get`、`/getmember`、`/memberget`、`/member-add`、`/addmember`、`/memberadd`、`/addswipe`。
  - 语义对齐：`member-get` 支持 `field=name|index|id|avatar`；`addswipe` 支持 `switch=true|false`。
  - 失败策略：缺少宿主能力、参数缺失、字段非法时统一 fail-fast。
- 扩展 Slash 上下文能力面，打通命令到 Script Bridge 的能力声明。
  - `ExecutionContext` 新增 `getGroupMember`、`addGroupMember`、`addSwipe`。
  - `ApiCallContext` / `useScriptBridge` / `CharacterChatPanel` 同步透传上述回调，保持单路径能力声明。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `37.32%`（上一轮 `35.68%`，+`1.64`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`：`1 file / 24 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`
  - 新增 `/member-get`/`/getmember` 字段读取断言与非法字段 fail-fast 断言。
  - 新增 `/member-add`/`/addmember` 成功路径断言。
  - 新增 `/addswipe` 文本来源、`switch` 参数与 fail-fast 断言。
  - 扩展“宿主不支持时 fail-fast”覆盖，纳入 `getmember/addmember/addswipe`。

## 下一步建议

1. 推进脚本运维命令：`/delay`、`/generate-stop`、`/genraw`、`/listchatvar`、`/list-gallery`，继续压缩 P2 Top gaps。
2. 为 `member-*/addswipe` 接入宿主 UI 可见回调（会话页直接 Slash 与 iframe 路径都可见），补齐“可执行 -> 可见效果”闭环。
3. 增加 `member-*/addswipe/delswipe` 的端到端断言，覆盖执行结果与界面状态一致性。
