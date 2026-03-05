# Handoff（2026-03-05）

## 本轮完成

- 完成 P1-1：补齐 `/message` 命令别名，复用 `messages` 处理器；新增别名测试覆盖 `/messages` `/mes` `/message` 三条路径。
- 完成 P1-2：补齐 `injectPrompts/uninjectPrompts` 闭环。
  - shim 侧改为真实 API 调用，返回可复用 `uninject` 句柄，支持 `once` 自动解绑。
  - handler 侧新增 `prompt-injection-handlers.ts`，负责参数校验、注入记录与事件广播。
- 完成 P1-3：同步能力矩阵并校验 API facade 变化。
  - 新增 API matrix 项：`injectPrompts/uninjectPrompts`、角色 CRUD 相关 API、`refreshOneMessage`。
  - `pnpm analyze:sillytavern-gap` 结果：API facade 覆盖率提升至 `100.00%`。
- 推进 P2-3：补齐 TavernHelper 角色能力与消息刷新能力。
  - shim 新增：`getCurrentCharacterName/createCharacter/createOrReplaceCharacter/deleteCharacter/replaceCharacter/updateCharacterWith/refreshOneMessage`。
  - handler 新增/补齐：`getCurrentCharacterName/createCharacter/deleteCharacter/replaceCharacter/refreshOneMessage`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `25.35%`（上一轮 `25.12%`）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`（上一轮 `95.04%`）
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts`：通过。
- `pnpm vitest run hooks/script-bridge/__tests__/variable-handlers.test.ts`：通过。
- 本轮新增/更新定向测试：
  - `hooks/script-bridge/__tests__/prompt-injection-handlers.test.ts`
  - `hooks/script-bridge/__tests__/character-handlers-gaps.test.ts`
  - `hooks/script-bridge/__tests__/message-handlers-compat.test.ts`
  - `lib/slash-command/__tests__/p2-message-command-aliases.test.ts`
  - `lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`

## 下一步建议

1. 继续推进 P2-1：补齐 `/world` + `get/set lore*` 命令簇，并为每个命令补契约测试。
2. 推进 P2-2：补齐 `/regex-preset` `/regex-toggle` `/chat-jump` `/chat-render` `/chat-scrollto`，优先实现 fail-fast + 可回放路径。
3. 更新 `docs/analysis/sillytavern-integration-gap-2026-03.md` 的差距分层与短周期目标，使文档与最新 gap report 对齐。
