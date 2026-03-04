# 执行清单（聚焦版）

> 说明：本文件只保留“当前执行与后续计划”。
> 历史完成项与轮次细节已归档到：`docs/plan/2026-03-03-sillytavern-gap-reduction/history.md`。

## 1. 当前状态快照（2026-03-04）

- Slash 覆盖率：`80 / 258 = 31.01%`（已达 P2 门槛）
- TavernHelper API 覆盖率：`120 / 130 = 92.31%`（已达 P3 门槛）
- P4：`p4-session-replay`、噪音门禁、run-index 均可用（维持基线，不扩能力面）

## 2. 当前执行主线（进行中）

### P1 - parser 深语义第二切片（主优先）

- [ ] 补齐严格转义与 parser 指令交互边界（在第一切片基础上继续对齐上游）。
- [ ] 为以上语义补齐可复现断言，先测试再扩行为面。
- [ ] 维持 fail-fast：不做静默兼容分支。

### P2 - TavernHelper 长尾 API（真实阻塞驱动）

- [x] 补齐 `_bind/_th_impl` 最小可运行子集（仅实现真实触发能力，未实现项显式 fail-fast）。
- [x] 补齐音频 helper 别名：`audioEnable/audioImport/audioMode/audioPlay/audioSelect`。
- [ ] 评估并按需补齐 preset helper 常量族（`default_preset/isPreset*`），以真实脚本触发失败为准。

### P2 - 低频 slash（机会性）

- [ ] 仅在真实素材/脚本触发失败时补齐，不再按命令总数推进。

## 3. 本轮固定回归（每轮增量后执行）

- [ ] `pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- [ ] `pnpm exec eslint public/iframe-libs/slash-runner-shim.js lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- [ ] `pnpm exec tsc --noEmit`

## 4. 守卫基线（按需）

- [ ] 主线修复后按需执行：`pnpm p4:session-replay`
- [ ] 若出现新增 console/network 签名，先更新修复再决定是否刷新噪音基线。

## 5. 完成定义（DoD）

- [ ] 新增/变更能力有对应回归测试。
- [ ] shim/handler/能力矩阵无漂移。
- [ ] 文档同步更新：`handoff.md` + `docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [ ] 历史细节归档到 `history.md`，主文档保持聚焦。
