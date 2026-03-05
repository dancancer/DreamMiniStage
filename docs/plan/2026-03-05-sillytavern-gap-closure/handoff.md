# Handoff（2026-03-05）

## 本轮完成

- 完成 P2-1：补齐 world/lore 命令簇第一批。
  - 新增命令：`/world`、`/getcharlore`、`/getchatlore`、`/getgloballore`、`/getpersonalore`、`/getlorefield`、`/setlorefield`。
  - 对齐别名：`getcharwi/getchatwi/getglobalwi/getpersonawi/getwifield/setwifield`。
  - `slash-handlers` 新增 world/lore 上下文适配能力（全局绑定、角色绑定、聊天绑定、字段读写）。
- 完成 P2-2：补齐 regex/chat 命令簇第二批。
  - 新增命令：`/regex-preset`、`/regex-toggle`、`/chat-jump`、`/chat-render`、`/chat-scrollto`。
  - `useScriptBridge`/`ApiCallContext` 新增聊天跳转与渲染回调注入位。
- 为控制文件复杂度，重构 Slash 适配层拆分：
  - `slash-handlers.ts` 收敛为薄桥接；
  - 新增 `slash-context-adapter.ts`（核心上下文适配）；
  - 新增 `slash-context-lore-regex.ts`（world/lore/regex 专项适配）。
- 同步能力单源与文档状态。
  - 更新 `hooks/script-bridge/capability-matrix.ts`，补齐本轮新增 Slash 命令声明。
  - 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md` 差距分层与短周期目标。
  - 更新执行清单：`tasks.md` 中 P2 待办全部打勾。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `29.58%`（上一轮 `25.35%`）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/slash-command/__tests__/p2-regex-command-gaps.test.ts`：`3 files / 17 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`1 file / 3 tests` 全通过。
- `pnpm vitest run hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`：`1 file / 18 tests` 全通过。
- `pnpm lint` 与 `pnpm exec tsc --noEmit`：均通过。

## 本轮新增/更新测试

- 新增 `lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts`
- 新增 `lib/slash-command/__tests__/p2-regex-command-gaps.test.ts`
- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`（补 `/chat-jump` `/chat-render` `/chat-scrollto`）

## 下一步建议

1. 推进聊天编辑类高频缺口：`/delchat` `/delete` `/delmode` `/delname` `/delswipe`，优先保持 fail-fast 与无静默回退。
2. 收敛 world/lore 语义别名：补齐 `/getcharbook` `/getchatbook` `/getglobalbooks` `/getpersonabook` 到统一数据路径。
3. 继续用真实素材驱动回归：每个新命令簇绑定至少一个契约测试或 material replay 场景。
