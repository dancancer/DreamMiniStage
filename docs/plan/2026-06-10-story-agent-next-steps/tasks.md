# 执行清单（2026-06-10）

> 配套 `plan.md`。方向见 ADR-0009 / ADR-0010；invariant 见 docs/adr/INV-1…8。

## 0. 热身（可先做）

- [x] NS-3.0 render-helpers：抽 `isStatusJsonSourcePattern` / `isSfwStatusSourcePattern` 到 `lib/story-agent/render-intent/status-pattern.ts`，classifier/extractor 改 import。（✅ 28 测试绿）

## 1. NS-Phase 1：MVU / 状态能力广度（主干 #1）

- [x] 1.1 把约定识别重构成可扩展 `VARIABLE_CONVENTIONS` 注册表（行为保持，15 测试绿）。
- [ ] 1.1 按 gap 补充常见变量声明约定（识别一种 → 覆盖所有同约定卡；需真实目标卡）。
- [ ] 1.2a（precursor）接入导入期 QA-repair LLM：model-gateway 调用 → `validateRepairOutput` → low-risk auto-apply / medium-high 用户确认。（1.2 前置）
- [ ] 1.2b 未知约定走 QA-repair LLM 推断隐含变量模型（typed patch；仅编译期，INV-6）。
- [x] 1.3 `bundle-diagnostics.ts` 新增 `extension.mvu_replay_mutation_unsupported`。
- [x] 1.3 `bundle-builder.ts` 加 `hasReplayMutationFields`，在 `variable-convention` 前提下收窄选码；同步改 `unsupportedExtensionDiagnostic` / `createExtensionArtifact`。
- [x] 1.3 更新 `bundle-builder.test.ts` / `initial-state.test.ts` 期望为新码（35 测试绿）。
- [ ] 1.4 可见 reasoning/planning 文本归入 thinkingContent 通道（tag-based 检测，待实施）。
- [ ] 验收：已知约定新卡零代码 seed；未知格式产出推断 initial 或诊断；浏览器 E2E 对照真实 MVU。

## 2. NS-Phase 2：记忆能力 + story-memory 架构债

- [ ] 删 `MemoryRetrievalManager`（`lib/vectors/memory-retrieval.ts` + barrel 导出）。
- [ ] `VectorMemoryManager` 新增 `ingestStoryMemory(sessionId, facts, relationships)`。
- [ ] `consolidateStoryMemory` 接入向量化（可选 `memoryPolicy.vectorizeMemory`），Facts/Relationships 带 `{type}` 元数据。
- [ ] 保留 fail-safe（INV-7），retrieve 可拉 dialogue + facts + world。

## 3. NS-Phase 3：RenderIntent 广度 + renderer 收尾

- [ ] 3.1 gap-driven 拓宽白名单：world/map、media/opening player、card-specific action widget、可折叠长摘要。
- [ ] 3.1 unsupported UI 一律转显式 Import Diagnostic（ADR-0005）。
- [ ] 3.2 补对称 legacy-mode 渲染边界测试（普通消息仍走 RegexProcessor），守护 ADR-0008。

## 4. 正交架构债（独立小 PR）

- [ ] persist-leak：persist 事件 + 调用点持久化适配器；runtime 不再 import `function/dialogue`；护栏（events.ts schema / 适配器边界 / commitSession 后持久化）。
- [ ] self-sinks：出站序列化推进各 sink，入站 parser 保留/改名；加 round-trip 测试。

## 5. 收尾债

- [ ] `.husky/pre-commit` `chmod +x`。
- [ ] `.playwright-mcp/` 加入 `.gitignore`。
- [ ] push 本地 commits。

## 6. 后置（非主干，待主干收口）

- [ ] branch capabilities：per-node `StorySessionSnapshot` 写入 `DialogueNode.extra`；head 退化为缓存；接通 swipe/branch-switch/regenerate；退役 branch-policy fail-fast；连续性回归测试。（需新 ADR 承接）
- [ ] MVU A2 import-time fold：需新 ADR 拍板是否改叙事起点后再做。
- [ ] state-parser 共享解析器：hold，等真实 bug 证据。

## 质检门

- [ ] 每阶段 POC/实现先定向 vitest，阶段完成跑 `pnpm verify:stage` 并清理生成物。
- [ ] 关闭一条 gap 即更新对照真实 ST+MVU 的 gap audit。
