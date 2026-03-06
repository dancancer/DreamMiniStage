# Handoff（2026-03-06）

## 本轮完成

- 补齐 Secret 命令簇：`/secret-id`、`/secret-rotate`、`/secret-delete`、`/secret-write`、`/secret-rename`、`/secret-read`、`/secret-find`、`/secret-get`，统一到单一路径 `localStorage` secret store。
- Secret 激活项会同步回当前 provider API key：
  - `openaiApiKey`
  - `geminiApiKey`
  - 通用 `apiKey`
- 当前激活模型配置（Zustand `useModelStore` active config）会随 Secret 切换同步更新，避免“Slash 已切 key，但运行时仍拿旧 key”的分叉状态。
- 为现有群聊 swipe 实现补齐别名：`/swipeadd` 现在与 `/addswipe` 共享同一路径实现。
- Secret store 支持从现有 provider key 启动：若用户本地已经有 `openaiApiKey` / `geminiApiKey`，首次执行 `/secret-read` 等命令时会自动引导成一条激活 secret，而不是要求先手工迁移。
- 新增契约测试：`lib/slash-command/__tests__/p3-secret-command-gaps.test.ts`（4 tests），覆盖 bootstrap、读写/切换、重命名/删除、active config 同步与 fail-fast。
- 更新既有别名回归：`lib/slash-command/__tests__/p2-chat-command-gaps.test.ts` 现在直接断言 `/swipeadd` 走通现有 `/addswipe` 逻辑。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p3-secret-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`：`2 files / 30 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-secret-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`：`14 files / 322 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`87.32%`（上一轮 `85.21%`，+`2.11`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`secret-delete`、`secret-find`、`secret-get`、`secret-id`、`secret-read`、`secret-rename`、`secret-rotate`、`secret-write`、`swipeadd`

## 下一步建议

1. 直接做 `sysprompt*` 命令簇：`/sysprompt`、`/sysprompt-on`、`/sysprompt-off`、`/sysprompt-state`、`/sysprompt-toggle`、`/sysname`、`/sysgen`。这簇和本轮 Secret Store 一样，适合走共享存储单路径，一次性拉高覆盖率。
2. 做低耦合媒体/画廊簇：`/show-gallery|/sg`、`/expression-upload`。这两个剩余命令都更适合宿主回调/事件桥接，不该塞进 Slash 层做假 UI。
3. `/qr-arg` 依旧是高价值项，但不要只补命令壳；下一轮应该直接落 `{{arg::...}}` 宏解析与 `*` wildcard 语义，否则只是把复杂度往后拖。
