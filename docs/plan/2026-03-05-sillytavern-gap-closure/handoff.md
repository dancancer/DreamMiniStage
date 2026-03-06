# Handoff（2026-03-06）

## 本轮完成

- 补齐低耦合 utility 命令簇：`/random`、`/sort`、`/tokens`、`/trimstart`、`/trimend`。实现策略保持单路径：`/random` 直接复用 `listCharacters + switchCharacter`，`/sort` 对齐 SillyTavern 的“数组按值排序 / 对象返回排序后的 key 列表”，`/tokens` 与 `trim*` 继续复用现有 tokenizer/文本处理语义，不额外引入宿主分支。
- 补齐 vector 状态命令簇：`/vector-chats-state`、`/vector-files-state`、`/vector-max-entries`、`/vector-query`、`/vector-threshold`。为这批命令新增 `lib/vector-memory/settings.ts` 作为宿主 runtime settings 单一存储入口，并在 `hooks/script-bridge/slash-context-adapter.ts` 中统一挂到 ExecutionContext，避免把 worldinfo/chat/files 三套状态拆散到不同 localStorage key。
- 扩展上下文与类型：`lib/slash-command/types.ts` 为 vector 状态读写补齐上下文回调定义；`CharacterSummary` 新增可选 `tags`，让 `/random <tag>` 可以在本地角色元数据上做过滤，不需要重新发明额外角色索引。
- 新增/扩展测试：
  - `lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`：新增 `/sort`、`/tokens`、`/trimstart`、`/trimend` 契约测试。
  - `lib/slash-command/__tests__/p2-character-command-gaps.test.ts`：新增 `/random` 的标签过滤、结构化返回与 fail-fast 测试。
  - `lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts`：新增 vector 状态簇读写与参数校验测试。
  - `lib/vector-memory/__tests__/settings.test.ts`：新增 runtime settings 持久化与越界回退测试，专门守住 threshold=0 这类边界语义。
- 更新能力矩阵、gap report、分析文档与执行清单；本轮新增 10 个 slash 命令后，gap Top25 已移除 `random`、`sort`、`tokens`、`trimstart`、`trimend`、`vector-chats-state`、`vector-files-state`、`vector-max-entries`、`vector-query`、`vector-threshold`。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/slash-command/__tests__/p2-character-command-gaps.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/vector-memory/__tests__/settings.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`5 files / 48 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-utility-command-gaps.test.ts lib/slash-command/__tests__/p2-character-command-gaps.test.ts lib/slash-command/__tests__/p2-world-lore-command-gaps.test.ts lib/vector-memory/__tests__/settings.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`17 files / 340 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`96.01%`（上一轮 `93.66%`，+`2.35`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 已移除：`random`、`sort`、`tokens`、`trimstart`、`trimend`、`vector-chats-state`、`vector-files-state`、`vector-max-entries`、`vector-query`、`vector-threshold`

## 下一步建议

1. 直接收口 timed effect：`/wi-get-timed-effect`、`/wi-set-timed-effect`。这里不要新造状态源，优先复用现有 `world-book-advanced` 的 sticky/cooldown/delay runtime 字段与当前 chat 轮次语义。
2. 从媒体生成长尾里二选一推进：要么 `sd`/`sd-source`/`sd-style`，要么 `tts`/`speak`/`translate`。原则不变，必须走显式宿主回调，不在 Slash 层伪造 UI。
3. 如果想继续快速抬升 coverage，就拿参数简单的残余命令：`/qrset`、`/reroll-pick`、`/tempchat`、`/summarize`、`/yt-script`。这批命令比 timed effect/媒体更低耦合，但业务价值略低。
