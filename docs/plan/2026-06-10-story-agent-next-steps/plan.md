# Story Agent 下一阶段规划（2026-06-10）

> 范围：在 Story Agent 资产编译路线已跑通的基础上，规划"主干能力对齐 + 架构债清理"的下一阶段工作。
> 方向已通过 grill-with-docs 与用户逐层澄清并落档：见 [[ADR-0009]]（主干 = 能力对齐 gap-driven，分支能力后置）、[[ADR-0010]]（变量提取 = 约定注册表 + LLM 兜底）。
> 编号命名空间：本文阶段用 `NS-Phase`（Next Stage），避免与 SAC-Phase 混淆。

## 1. 方向（已锁定）

- **主干 = 对真实 SillyTavern + 常用插件（尤其 MVU）做能力 / 语义对齐**（ADR-0009），gap-driven；实现仍走自有编译架构，ADR-0001/0002 不变。
- 技术债 / 架构债清理与能力对齐**并行**。
- 分支能力（swipe / regenerate / branch-switch）**非主干、后置**（设计已存档，见 §5）。
- 上游决策约束：INV-1…INV-8（见 `docs/adr/`）。新增 [[Variable Convention]] 术语（`CONTEXT.md`）。

## 2. Gap 盘点（对照真实 ST + JS-Slash-Runner + MagVarUpdate）

基线：`docs/analysis/2026-05-31-sillytavern-plugin-e2e-gap-audit.md`，叠加 6/1–6/4 工作与 6/10 grounding 核验。

| 原 gap | 当前状态 | 仍开放 |
|--------|----------|--------|
| #1 status/render 契约泄漏 | 基本关闭（unsafe-html → diagnostic 已 landed，三层 strip + 测试） | theater 无 status contract；更多卡族兜底 |
| #2 MVU / 状态能力广度 | 部分（5 种约定 + replay 已诊断） | 拓宽约定 + 未知格式兜底 + replay 专门码 + 可见 reasoning 文本策略 |
| #3 RenderIntent 白名单广度 | 部分（dashboard/meters 已加） | world/map、media/opening player、card-specific action widget、可折叠长摘要 |
| #4 渲染链与 legacy 拆分 | 基本关闭（renderMode='story' 已落） | 缺对称 legacy-mode 测试 + 边界守护 |

## 3. 分阶段计划

### NS-Phase 1：MVU / 状态能力广度（主干 #1）

目标：任意遵循已知约定的角色卡**自动 seed 初始 Story State，零逐卡代码**；未知格式有兜底；不静默丢。落实 [[ADR-0010]]。

- **1.1 拓宽确定性 Variable Convention 注册表**：`collectInitSources` 已重构为遍历显式 `VARIABLE_CONVENTIONS` 注册表（✅ 行为保持，已落地）；后续按 gap 补充常见声明约定（需真实目标卡）。识别一种约定 → 所有同约定卡自动适配。
- **1.2a（precursor）接入导入期 QA-repair LLM**：发现 `repair-patch.ts` 的 typed patch / risk / validator / apply 已就绪但**无 live 调用点**。先把导入期 QA-repair LLM 调用接进 import flow（model-gateway 调用 → `validateRepairOutput` → low-risk auto-apply / medium-high 用户确认）。这是 1.2 的前置子项目。
- **1.2b 未知约定 → LLM 推断兜底**：在 1.2a 之上，未匹配任何已知约定的变量声明由 QA-repair LLM 推断隐含变量模型（typed patch，仅编译期、不进运行时，INV-6；[[ADR-0010]]）。
- **1.3 replay mutation 专门诊断码（A1）** ✅ 已落地：`bundle-diagnostics.ts` 新增 `extension.mvu_replay_mutation_unsupported`；`hasReplayMutationFields` 在 `variable-convention` 前提下收窄选码；不执行、不折叠。
- **1.4 可见 reasoning/planning 文本输出策略**：把上游风格 prompt 触发的可见思考/计划文本归入 thinkingContent 通道（折叠），不作为故事正文。**待确认**（推荐此策略）。

验收：已知约定新卡零代码 seed；未知格式产出推断 initial 或可审计诊断；replay 命中专门码；定向 vitest + 浏览器 E2E 对照真实 MVU。
不做：state-parser 共享解析器（`hold`）；A2 import-time fold（deferred，需 ADR）。

### NS-Phase 2：记忆能力 + story-memory 架构债（主干 + 架构候选 #4）

目标：补上"Story Memory 算了却不可检索"的真实记忆能力缺口，同时清掉死码。一举两得。

- 删 `MemoryRetrievalManager`（grep 确认无活调用者，旧 roadmap 残留，INV-2 单轨化）。
- `consolidateStoryMemory` 接入 `VectorMemoryManager`：Facts / Relationships 带 `{type}` 元数据 ingest，retrieve 可拉 dialogue + facts + world。
- 护栏：可选 `memoryPolicy.vectorizeMemory`（记忆策略仍在 SAC-Phase 6b deferred 边界内，别越界设计）；保留 `formatStoryMemoryMessages` 的 fail-safe（INV-7）。

### NS-Phase 3：RenderIntent 能力广度（主干 #2）+ 同区架构债

- **3.0 render-helpers 去重**（架构候选 #5，纯 `proceed`、零护栏）：把逐字重复的 `isStatusJsonSourcePattern` / `isSfwStatusSourcePattern` 抽到 `lib/story-agent/render-intent/status-pattern.ts`。作为该区热身，**可作为整轮第一步**。
- **3.1 gap-driven 拓宽白名单**：按真实卡需求补 world/map、media/opening player、card-specific action widget、可折叠长摘要；unsupported 一律转显式诊断（[[ADR-0005]]）。
- **3.2 收尾 renderer isolation**（待完成项）：补对称的 legacy-mode 渲染边界测试（验证普通消息仍走 `RegexProcessor`），守护 [[ADR-0008]]。

### 正交架构债（独立小 PR，穿插推进）

- **persist-leak**（架构候选 #1，proceed-with-guardrail）：runtime 以 persist 事件收尾 + 调用点持久化适配器，runtime 不再 import `function/dialogue`。护栏见 `docs/analysis/2026-06-10-story-agent-grounding-and-remaining-work.md` §2.1。
- **self-sinks**（架构候选 #2，proceed-with-guardrail）：出站序列化推进各 sink，入站 parser 保留；加 round-trip 测试。

## 4. 收尾债（低成本，一次性处理）

- `.husky/pre-commit` 补可执行位（`chmod +x`）。
- `.playwright-mcp/` 加入 `.gitignore`。
- 61 个本地 commit 适时 push。

## 5. 后置（非主干，设计已存档）

- **branch capabilities（swipe / regenerate / branch-switch）**：推荐 per-node 状态快照——`StorySessionSnapshot` 写进 `DialogueNode.extra.storySnapshot`，head 退化为派生缓存；切换 = 读快照重水化，regenerate = 从父快照起真正调 LLM。effort L。完整步骤见本目录 scoping 产出 / grounding 记录。**待主干收口后实施**。
- **MVU A2 import-time fold**：把 replay 最终态折叠成静态初始态——需新 ADR 拍板"是否改变叙事起点"。
- **state-parser 共享解析器**（架构候选 #6）：`hold`，等真实 bug 证据（Story State 与 MVU 的隔离是有意设计，见 [[ADR-0007]]）。

## 6. 验证策略

- 每阶段：定向 `pnpm vitest run <files>` + 真实资产 / 浏览器 E2E；阶段完成跑 `pnpm verify:stage`。
- 主干能力验收以 gap audit 对照真实 ST + MVU 为基准（沿用 `docs/analysis/*gap*` 方法），关闭一条 gap 即更新审计。

## 7. 建议推进顺序

1. （热身）NS-3.0 render-helpers —— 纯 proceed、零风险，验证流程。
2. NS-Phase 1 MVU/状态能力广度 —— 主干 #1。
3. NS-Phase 2 记忆能力 + 删死码 —— 主干 + 架构债两得。
4. NS-Phase 3 RenderIntent 广度 + renderer 收尾。
5. 穿插：persist-leak、self-sinks（正交架构债，独立小 PR）。
6. 收尾债；之后再开后置项（branch capabilities）。
