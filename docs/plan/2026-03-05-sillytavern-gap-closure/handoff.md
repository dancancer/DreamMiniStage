# Handoff（2026-03-05）

## 本轮完成

- 完成会话推理命令收敛（对应上一轮 handoff 第 1 条建议）。
  - 新增命令：`/reasoning-get`、`/get-reasoning`、`/reasoning-set`、`/set-reasoning`。
  - 语义对齐：默认操作末条消息，支持 `at=` 索引定位，非法索引 fail-fast。
- 完成注入运维命令收敛（对应上一轮 handoff 第 1 条建议）。
  - 新增命令：`/listinjects`。
  - 打通 `/inject` 与 `injectPrompts/uninjectPrompts` 的共享注入存储，保证单路径数据来源。
- 打通命令到宿主上下文的读写闭环。
  - 在 Slash 上下文适配器接入 `get/setMessageReasoning`、`injectPrompt`、`listPromptInjections`。
  - 在会话页直接 Slash 执行上下文同步接入上述能力，避免仅 iframe 路径可用。
- 同步能力矩阵与分析文档。
  - 更新 `hooks/script-bridge/capability-matrix.ts` 与 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
  - 重新生成 `docs/analysis/sillytavern-gap-report-*.{md,json}`。

## 回归结果

- `pnpm analyze:sillytavern-gap`
  - slash coverage: `35.68%`（上一轮 `34.51%`，+`1.17`pp）
  - api matrix coverage: `100.00%`
  - api facade coverage: `100.00%`
- `pnpm vitest run lib/slash-command/__tests__/p2-chat-command-gaps.test.ts hooks/script-bridge/__tests__/prompt-injection-handlers.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`3 files / 25 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts`：`10 files / 284 tests` 全通过。
- `pnpm vitest run lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`：`2 files / 8 tests` 全通过。
- `pnpm exec tsc --noEmit`：通过。

## 本轮新增/更新测试

- 更新 `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`
  - 补充 `/reasoning-get`、`/get-reasoning`、`/reasoning-set`、`/set-reasoning` 的默认索引/宿主覆写/fail-fast 断言。
  - 补充 `/listinjects` 的 JSON 返回与宿主缺失 fail-fast 断言。
- 更新 `hooks/script-bridge/__tests__/prompt-injection-handlers.test.ts`
  - 增加共享注入存储清理，确保注入相关测试互不污染。

## 下一步建议

1. 推进群聊编辑命令：`/addmember`、`/addswipe`、`/getmember`，优先补齐多人会话主流程。
2. 推进脚本运维命令：`/delay`、`/generate-stop`、`/genraw`、`/listchatvar`，继续压缩 P2 Top gaps。
3. 为 `set-reasoning/delchat/delswipe/message-*` 增加 “命令执行 -> UI 可见变化” 的集成断言，强化端到端守卫。
