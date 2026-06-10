# 执行清单（2026-06-10，状态更新 2026-06-10 晚）

> 配套 `plan.md`。方向见 ADR-0009 / ADR-0010 / ADR-0011；invariant 见 docs/adr/INV-1…8。
> 状态：可执行的主体工作已完成（见下）。剩余为「需真实凭证的验收」「环境/发布动作」「需新 ADR 的后置项」。

## 0. 热身

- [x] NS-3.0 render-helpers：抽 `isStatusJsonSourcePattern` / `isSfwStatusSourcePattern` 到 `status-pattern.ts`。

## 1. NS-Phase 1：MVU / 状态能力广度（主干 #1）

- [x] 1.1 把约定识别重构成可扩展 `VARIABLE_CONVENTIONS` 注册表（行为保持）。
- [x] 1.1 gap 复核：分析器跑过 `/Users/xupeng/Desktop/card` 4 张卡，注册表已覆盖（Sgw3 seed 12 / V2.0Beta seed 52，零 per-card 代码）。**当前无缺失约定**；后续有新卡再重跑 `scripts/analyze-card-gaps.ts` 补充。
- [x] 1.2a 导入期 QA-repair LLM：prod adapter（`createQaModelAdapter` + `cleanModelCallConfig`）+ 编排器（low-risk auto-apply / med-high 待确认 + allowlist）+ **wizard「AI 增强」接线**。
- [x] 1.2b 未知约定 → QA-repair 推断：`diagnoseInitialStateSources` 喂给 QA 模型（typed patch，仅编译期，INV-6）。
- [x] 1.3 `extension.mvu_replay_mutation_unsupported` 诊断 + `hasReplayMutationFields` 收窄选码。
- [x] 1.4 可见 reasoning/planning 文本归入 thinkingContent 通道（`extractStoryThinkingContent` + 对称 stripHiddenTags）。
- [ ] 验收（需真实凭证 / 浏览器）：已知约定新卡零代码 seed ✓（已验）；未知格式产出推断 initial 或诊断 → 需真实模型跑 QA 增强对照真实 MVU 的 E2E。

## 2. NS-Phase 2：记忆能力 + story-memory 架构债

- [x] 删 `MemoryRetrievalManager`（死代码 + barrel 导出）。
- [x] `storyMemoryToVectorEntries` + `ingestStoryMemory`（session-scoped id、保留 createdAt、best-effort）。
- [x] `consolidateStoryMemory` 接入向量化：`prepare-dialogue-execution` 在 `memoryPolicy.vectorizeMemory===true && status==="active"` 时 ingest。
- [x] 保留 fail-safe（INV-7）。

## 3. NS-Phase 3：RenderIntent 广度 + renderer 收尾

- [x] 3.1 广度策略改向：纯 script-driven 富 UI 不再靠扩白名单（ADR-0005 阻断），改由 NS-Phase 4 Render Intent Synthesis 复现。
- [x] 3.1 unsupported UI → 显式 Import Diagnostic（合成失败落 `render.widget_synthesis_failed`）。
- [x] 3.2 对称 legacy-mode 渲染边界测试（守护 ADR-0008）。

## 4. NS-Phase 4：Render Intent Synthesis（ADR-0011，富 UI 复现）

- [x] 4.1 安全地基：`RenderIntentSpec` + `validateRenderIntentSpec`（白名单 kind / isSafeText / isSafeTag / Array.isArray 形状守护）+ `compileRenderIntentSpec`（option.id 确定性生成）。
- [x] 4.2 编排器 `synthesizeRenderIntent`（异常安全降级）+ prod adapter `createWidgetSynthesisModel`。
- [x] 4.2 import-flow 接入 `synthesizeUnsupportedWidgets` / `synthesizeImportWidgets`（追加进 blueprint.renderRules，失败落诊断）。
- [x] 4.2 wizard 接线：`repairImportPreview` + `enrichStoryAgentPreview` + 「AI 增强」按钮（客户端用 active 模型跑 QA + 合成）。
- [x] Codex review 硬化（形状崩溃、option.id 污染、config 覆盖、诊断重复）。
- [ ] 4.4 逐卡浏览器验收（需真实凭证）：对 Sgw3（34 widget）/ V2.0Beta（2）跑 AI 增强，核对复现的面板。

## 5. 正交架构债

- [x] persist-leak：注入 `DialogueTurnPersister` 端口，runtime 不再 import `function/dialogue`。
- [x] self-sinks：评估后 skip-with-justification（Codex 认可——拆分会引入 sink→sink 耦合）。

## 6. 收尾债（用户环境/发布动作）

- [x] `.playwright-mcp/` 加入 `.gitignore`。
- [ ] `.husky/pre-commit` `chmod +x`（用户本机执行）。
- [ ] push 本地 commits（领先 origin/main，待用户发布）。

## 7. 后置（非主干，待新 ADR 承接）

- [ ] branch capabilities：per-node `StorySessionSnapshot`、退役 branch-policy fail-fast、连续性回归。（需新 ADR）
- [ ] MVU A2 import-time fold：需新 ADR 拍板是否改叙事起点。
- [ ] state-parser 共享解析器：hold，等真实 bug 证据。

## 质检门

- [x] 每阶段定向 vitest（TDD RED→GREEN）+ 全量绿（2097）+ typecheck 净。
- [x] 分阶段 Codex review（QA-repair 一轮 + 合成/富化/向导链一轮，均已修复）。
- [ ] 关闭真实卡 gap 后更新 gap audit（待 AI 增强 E2E）。
