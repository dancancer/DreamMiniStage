# 执行清单（聚焦版）

> 说明：本文件只保留“当前执行与后续计划”。
> 历史完成项与轮次细节已归档到：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`。

## 1. 当前状态快照（2026-03-04）

- Slash 覆盖率：`80 / 258 = 31.01%`（已达 P2 门槛）
- TavernHelper API 覆盖率：`124 / 130 = 95.38%`（已达 P3 门槛）
- P4：`p4-session-replay`、噪音门禁、run-index 均可用（维持基线，不扩能力面）

## 2. 当前执行主线（进行中）

### P1 - 能力面阻塞清零（主优先，真实触发驱动）

- [ ] 先以真实迁移素材触发验证 `builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order`。
- [ ] 先以真实迁移素材触发验证 script tree helper（`getScriptTrees/replaceScriptTrees/updateScriptTreesWith`）。
- [ ] 对触发失败项补最小单路径可执行实现（保持 fail-fast，不做静默兼容）。
- [ ] 为新增能力补契约/集成回归，并同步 shim/handler/能力矩阵。

### P2 - parser 深语义守卫（按缺陷触发）

- [x] 完成首批边界：`STRICT_ESCAPING` 下 escaped quote/pipe 解析 + parser-flag（`STRICT_ESCAPING/REPLACE_GETVAR`）交互断言与实现。
- [x] 补齐 block 嵌套 + 混合引号边界：引号内 `{:/:}` 不再误判为 block 分隔符（含 `STRICT_ESCAPING` 组合路径）。
- [x] 补齐多层 block + 反斜杠逃逸断言：覆盖 odd/even backslash quote 边界与 strict fail-fast。
- [x] 补齐 nested block 中 `REPLACE_GETVAR` + 转义链路断言：覆盖 named/unnamed 参数混合 + strict fail-fast。
- [ ] 仅在真实缺陷触发时补 `parser-flag` 更深层开关切换边界并修复行为。
- [x] 维持 fail-fast：不做静默兼容分支。

### P2 - TavernHelper 长尾 API（与 P1 联动）

- [x] 补齐 `_bind/_th_impl` 最小可运行子集（仅实现真实触发能力，未实现项显式 fail-fast）。
- [x] 补齐音频 helper 别名：`audioEnable/audioImport/audioMode/audioPlay/audioSelect`。
- [x] 评估并补齐 preset helper 常量族（`default_preset/isPreset*`），并固化契约测试。
- [ ] 跟随 P1 触发验证结果推进 `builtin/setChatMessage/rotateChatMessages/tavern_events/iframe_events/builtin_prompt_default_order` 实现。

### P3 - 低频 slash（机会性）

- [ ] 仅在真实素材/脚本触发失败时补齐，不再按命令总数推进。

## 3. 本轮固定回归（每轮增量后执行）

- [x] `pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts`
- [x] `pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- [x] `pnpm exec eslint lib/slash-command/core/parser.ts lib/slash-command/__tests__/kernel-core.test.ts lib/slash-command/__tests__/kernel-parser-flags-nested.test.ts public/iframe-libs/slash-runner-shim.js lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- [x] `pnpm exec tsc --noEmit`

## 4. 守卫基线（按需）

- [ ] 主线修复后按需执行：`pnpm p4:session-replay`
- [ ] 若出现新增 console/network 签名，先更新修复再决定是否刷新噪音基线。

## 5. 完成定义（DoD）

- [x] 新增/变更能力有对应回归测试。
- [x] shim/handler/能力矩阵无漂移。
- [x] 文档同步更新：`handoff.md` + `docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 历史细节归档到 `history.md`，主文档保持聚焦。
