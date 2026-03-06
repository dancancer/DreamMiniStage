# Handoff（2026-03-06）

## 本轮完成

- 补齐工具命令簇：`/tools-list|/tool-list`、`/tools-invoke|/tool-invoke`，统一复用 Script Tool Registry 单路径，不再分叉到另一套工具注册表。
- 补齐角色标签命令簇：`/tag-add`、`/tag-remove`、`/tag-exists`、`/tag-list`，统一复用角色元数据存储单路径，默认支持当前角色，按需精确匹配角色名/ID。
- 扩展 Slash 执行上下文与 Script Bridge adapter：新增 `listTools/invokeTool` 与 `add/remove/has/listCharacterTags` 透传位，工具调用走既有 `getRegisteredScriptTools/invokeScriptTool`，标签读写走 `LocalCharacterRecordOperations.updateCharacter`。
- 新增契约/集成测试：
  - `lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts`（5 tests）覆盖 tool/tag 命令的参数校验、返回值契约、别名与 fail-fast。
  - `hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts`（2 tests）覆盖 adapter 真实接线，确认 Slash 经过 Script Bridge 后会命中 tool registry 与角色元数据存储。
- 更新能力矩阵、gap report、分析文档与执行清单，确保文档状态与代码状态一致。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`3 files / 10 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`15 files / 302 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`91.55%`（上一轮 `89.67%`，+`1.88`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`tool-list`、`tool-invoke`、`tag-add`、`tag-remove`、`tag-exists`、`tag-list`

## 下一步建议

1. 继续收口媒体/画廊长尾：`/show-gallery|/sg`、`/expression-upload`。这组现在已经是最干净的一批缺口，但要直接接宿主显式回调，别在 Slash 层伪造 UI。
2. 直接做 `qr-arg` + `{{arg::...}}` 宏解析，不要拆成两轮；否则命令补上了，语义仍然是空的。
3. 顺势补齐工具注册运维：`/tools-register|/tool-register`、`/tools-unregister|/tool-unregister`。本轮已经把查询/调用路径统一了，下一轮只需要把注册/注销也收束到同一 registry。
