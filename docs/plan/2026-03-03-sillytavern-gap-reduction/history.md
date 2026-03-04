# SillyTavern Gap Reduction 历史归档（截至 2026-03-04）

> 用途：归档已完成阶段与历史执行细节，主文档聚焦“当前执行 + 后续计划”。
> 归档来源：`tasks.md`、`handoff.md`、`docs/analysis/sillytavern-integration-gap-2026-03.md` 的历史段落。

## 1. 指标演进（历史）

- Slash 覆盖率：`21.71%` -> `31.01%`（`80/258`）
- TavernHelper API 覆盖率：`43.08%` -> `95.38%`（`124/130`）
- P4 回放基线：`p4-session-replay` 已稳定，噪音门禁与 run-index 已落地。

## 2. 已完成里程碑（归档）

### M1（P0 完成）

- `registerFunctionTool` 单路径收敛（注册/调用/清理统一状态源）。
- `LLM tool_calls -> iframe callback -> result` 闭环打通。
- `registerVariableSchema/updateVariablesWith/insertVariables` 已落地并 fail-fast。
- `registerSlashCommand` iframe callback（`SLASH_COMMAND_CALL -> SLASH_COMMAND_RESULT`）闭环修复。

### M2（P1 完成）

- `strictSet/strictTemplate/concatTemplateArray` 从类型位推进到执行位。
- Slash 宏条件流（`{{getvar::}}`）收敛；`st-baseline-slash-command` 相关 skip 清零。
- parser 第一切片（`parser-flag/breakpoint/scopeDepth/parserFlags`）完成。

### M3（P2/P3 达门槛）

- 高频 slash 子族已覆盖：`api/fuzzy/chat-manager/run/trimtokens/reload-page/branch/ui/checkpoint`。
- TavernHelper 高频与关键长尾已补齐：`import_raw`、`extension` 读 API、`displayed_message`、`regex`、`lorebook/global/worldbook`、`inject`、`macro_like`、`raw_character`、`_bind/_th_impl`、音频 helper 别名、preset helper 常量族最小闭环。

### M4（P4 可复用回归基线）

- Playwright MCP E2E 从主链路扩展到故障注入。
- `/session` 链路完成 slash 直达、失败后刷新持久化、跨会话隔离复验。
- 自动回放：`pnpm p4:session-replay`。
- 噪音门禁：`noise-baseline-diff`；新增噪音 fail-fast。
- run-index：连续回放趋势可追踪。

## 3. 历史轮次摘要（12-27 轮）

- 第12轮：`registerSlashCommand` callback 闭环修复。
- 第13轮：`extension-handlers` 与 `slash-runner-shim` 结构拆分。
- 第14轮：`registerSlashCommand` 参数约束与结构化参数透传。
- 第15轮：parser/executor/bridge 参数元数据闭环。
- 第16轮：parser 第一切片（flags/debug/scope chain）。
- 第17轮：真实素材能力清单化。
- 第18轮：regex/worldbook 素材驱动修复（`minDepth/maxDepth`、`useProbability/groupWeight`）。
- 第19轮：util 长尾（`substitudeMacros/getLastMessageId/getMessageId/errorCatched`）。
- 第20轮：regex 长尾（`format/get/enabled`）。
- 第21轮：displayed-message 长尾（`format/retrieve`）。
- 第22轮：`lorebook/global/worldbook` 别名闭环。
- 第23轮：`inject` + `replaceTavernRegexes/updateTavernRegexesWith` 写链路。
- 第24轮：`macro_like/raw_character` 最小读链路。
- 第25轮：`RawCharacter/Character` + `getCharAvatarPath` 深层对象最小闭环。
- 第26轮：`_bind/_th_impl` 最小子集 + `audioEnable/audioImport/audioMode/audioPlay/audioSelect` helper 别名。
- 第27轮：`isPresetNormalPrompt/isPresetSystemPrompt/isPresetPlaceholderPrompt/default_preset` 兼容常量族补齐并固化契约断言。
- 第28轮：parser 第二切片首批落地（escaped quote/pipe + `STRICT_ESCAPING/REPLACE_GETVAR` 交互边界）。

## 4. 历史回归与证据索引

- P4 场景与证据主索引：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
- P4 产物目录：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/`
- 噪音基线：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json`
- run-index：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md`

## 5. 历史固定回归命令（归档）

```bash
pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
pnpm exec eslint public/iframe-libs/slash-runner-shim.js lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
pnpm exec tsc --noEmit
```

> 注：当前执行与后续计划请以 `tasks.md`、`handoff.md` 与压缩版分析文档为准。
