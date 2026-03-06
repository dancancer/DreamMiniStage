# Handoff（2026-03-06）

## 本轮完成

- 补齐媒体/画廊命令：`/show-gallery|/sg`、`/expression-upload|/uploadsprite`，统一走显式宿主回调；`show-gallery` 只负责打开画廊，`expression-upload` 只负责把 URL+label+folder/spriteName 交给宿主上传，不在 Slash 层伪造 UI。
- 补齐工具注册运维：`/tools-register|/tool-register`、`/tools-unregister|/tool-unregister`。注册命令复用 Script Tool Registry 单路径，把 closure block 序列化为 action script，并在 adapter 中临时注入 `arg.*` 变量后执行，避免再造第二套工具注册表。
- 补齐 `qr-arg`，并在 Slash 内核执行期打通 `{{arg::...}}` 宏替换、`*` wildcard 回退，以及 `{{var::...}}`/`{{globalvar::...}}` 的统一宏展开逻辑。
- 扩展 Script Bridge / UI 接线：
  - `hooks/script-bridge/slash-context-adapter.ts` 新增 `registerTool/unregisterTool/showGallery/uploadExpressionAsset` 透传。
  - `hooks/script-bridge/tool-handlers.ts`、`hooks/script-bridge/function-tool-bridge.ts` 支持在既有 registry 中注册本地 handler。
  - `hooks/useScriptBridge.ts`、`hooks/script-bridge/types.ts`、`components/CharacterChatPanel.tsx` 补齐对应宿主注入位。
- 新增/扩展测试：
  - `lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`：新增 `/show-gallery|/sg`。
  - `lib/slash-command/__tests__/p3-expression-command-gaps.test.ts`：新增 `/expression-upload|/uploadsprite`。
  - `lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts`：新增 tool register/unregister 契约测试。
  - `lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts`：新增 `/qr-arg` + 宏/wildcard。
  - `hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts`：新增 adapter 到 registry 的真实注册/调用/注销闭环。
- 更新能力矩阵、gap report、分析文档与执行清单，确保文档与代码状态同步。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/slash-command/__tests__/p3-expression-command-gaps.test.ts lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`6 files / 49 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/slash-command/__tests__/p3-expression-command-gaps.test.ts lib/slash-command/__tests__/p3-tool-tag-command-gaps.test.ts lib/slash-command/__tests__/p3-reasoning-quickreply-command-gaps.test.ts hooks/script-bridge/__tests__/slash-tool-tag-integration.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`18 files / 341 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`93.66%`（上一轮 `91.55%`，+`2.11`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`qr-arg`、`show-gallery`、`expression-upload`、`tool-register`、`tool-unregister`、`tools-register`、`tools-unregister`

## 下一步建议

1. 继续拿低耦合 utility 长尾提速：`/random`、`/sort`、`/tokens`、`/trimstart`、`/trimend`。这批命令主要是参数处理，最容易在不扩大回归面的前提下继续抬升 coverage。
2. 然后收口 vector 状态簇：`/vector-chats-state`、`/vector-files-state`、`/vector-max-entries`、`/vector-query`、`/vector-threshold`、`/wi-get-timed-effect`，尽量直接复用现有 worldinfo / vector adapter。
3. 若还要继续冲一轮高价值缺口，就在媒体生成里二选一：`sd` 系列或 `tts` 系列；原则不变，必须是宿主显式回调，不在 Slash 层伪造 UI。
