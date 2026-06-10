# Story Agent 决策接地与待完成核对（2026-06-10）

## 来源

- 立项会话：Codex session `019e725e-3e06-7833-b0db-d3efe91f32ed`（2026-05-29 → 2026-06-01）。
- 计划与任务：`docs/plan/2026-05-29-story-agent-asset-compiler/`（`plan.md` 561 行 + `tasks.md` 全 [x]）。
- 决策已沉淀为 ADR：`docs/adr/0001`–`0008`（用户意图 + 决策 + 被否决方案 + 核心 invariant INV-1…INV-8）。
- 深化候选：上一轮架构评审的 6 个候选（已过对抗式 deletion-test verifier）。

本文回答两件事：(1) work-summary 的「待完成工作」在当前代码里到底落地到什么程度；(2) 用原始设计 invariant 给 6 个深化候选"接地"——它们会不会违反当初的决策。证据由 12 个并行只读 agent grep/实读核验。

---

## 一、待完成项 × 当前代码状态（任务 2）

| # | 待完成项 | 状态 | 还差什么 |
|---|----------|------|----------|
| 1 | MVU `update`/`insert` replay mutation 长期语义 | `partial` | 已按 [[ADR-0007]] 把 replay mutation 诊断为 unsupported，但用的是通用 `extension.unsupported` 码，**无专门 replay-mutation diagnostic**；replay 语义本身仍未执行 |
| 2 | StoryState branch replay/rebase → 重开 regenerate/swipe/branch switch | `outstanding` | branch replay **完全未实现**；三操作经 `assertStoryBranchOperationSupported()` 一律 fail-fast。新增 `branch-policy.ts`（untracked）。work-summary 列为第 2 优先级 |
| 3 | Broaden MVU state schema extraction | `partial` | 已支持 5 种初始状态源；仍需覆盖更多 card-specific 声明方式 |
| 4 | unsafe HTML/script dashboard 保留在 import diagnostics | `landed` | 已完整落地 + 单测/端到端测试齐，无缺口 |
| 5 | Story Agent renderer isolation 回归测试 | `partial` | story render mode 隔离测试已新增；**缺对称的 legacy-mode 测试**（验证普通消息仍走 `RegexProcessor`） |
| 6 | 仓库卫生项 | `partial` | 三件都还在：见下 |

### 1.1 逐项证据

**① MVU replay mutation（partial）** — 边界正是 [[ADR-0007]] 的显式 deferred。
- `lib/story-agent/runtime/state/update.ts:3` — `StoryStateCommandName` 只支持 `set/add/remove/assign/insert` 作为 `<UpdateVariable>` 命令，不处理 MVU replay 的 `update/insert` 字段语义。
- `lib/adapters/import/bundle-builder.ts:336-354` — `shouldPreserveUnsupportedExtension()` 识别 `update/insert/expect` 字段并经 `unsupportedExtensionDiagnostic()` 生成 `extension.unsupported`。
- `lib/story-agent/blueprint/initial-state.ts:96-102` — `readExtensionInitSource()` 只取 `.initial`，不处理 `update/insert`。
- 测试 `lib/adapters/import/__tests__/bundle-builder.test.ts:111-162` 证明 `mvu_replay` 整体 `supported:false`、`mvu_replay.initial` `supported:true`。
- **缺口**：诊断码不区分"replay mutation"与其它不支持扩展；replay 长期语义（真正执行 update/insert 序列）仍待设计。

**② StoryState branch replay（outstanding）** — 第二优先级，未动。
- `lib/story-agent/session/branch-policy.ts:14`（untracked 新文件）— `assertStoryBranchOperationSupported` / `getStoryBranchOperationUnsupportedMessage` fail-fast，文案："Story Agent {regenerate|swipe|branch-switch} is disabled until StoryState branch replay is implemented."
- `function/dialogue/story-turn-lifecycle.ts:73` `assertLinearStoryTurn()` 在有 `parentNodeId` 时抛错；`swipe.ts:33`、`truncate.ts:18` 调用前置断言。
- 测试 `function/dialogue/__tests__/story-branch-policy.test.ts:49,57,66,73` 全在验证 fail-fast。
- 未发现任何 `replayState`/`replayBranch`/`rebaseState` 实现。

**③ Broaden MVU schema（partial）** — 已支持 5 种源：
- `lib/story-agent/blueprint/initial-state.ts:50-62` `collectInitSources`：`[InitVar]` 条目、`<status_current_variables>`、`<StoryState>`、`first_mes` 内的 `<initvar>`、extension artifacts。
- `lib/adapters/import/bundle-builder.ts:300-324` `readExtensionVariables`：`direct.initial`、`direct.variables`、pair-list `[key,value]`。
- 测试 `lib/story-agent/blueprint/__tests__/initial-state.test.ts` 覆盖以上。仍需扩更多 card 约定。

**④ unsafe HTML 诊断（landed）** — 落实 [[ADR-0005]]：
- `lib/story-agent/render-intent/classifier.ts:123-132` `findUnsafeHtmlReason` 识别 `<script>`/`<iframe>`/inline handler/DOM access 四类；`:47-51` 白名单前置校验 `!unsafe`。
- `lib/story-agent/blueprint/render/diagnostics.ts:13-20` 产 `render.status_contract_unsupported`；`compiler.ts:362-363` `isHtmlUiConversion` 把 unsafe HTML 规则挡在 `renderRules` 外。
- runtime 三层清理：`runtime.ts:28-40,98-100` `stripRenderIntentSources` / `stripUnsafeJsonSources`。
- 测试 `render-intent/__tests__/regex-classifier.test.ts:106-162` + `blueprint/__tests__/render-diagnostics.test.ts:10-24`。

**⑤ renderer isolation（partial）** — 落实 [[ADR-0008]]，但测试不对称：
- `components/MessageBubble.tsx:37-40` `renderMode: 'story'|'legacy'`；`character-chat/MessageItem.tsx:282` 按 `isStoryAgent` 分发；`message-bubble/useMessageRenderPipeline.ts:44-46` story→`parseContent`(sync)、legacy→`parseContentAsync`(走 `RegexProcessor`)。
- 新增测试 `components/__tests__/MessageBubble.streaming.test.tsx:166-183` 验证 story mode 调 `parseContent` 而**不**调 `parseContentAsync`。
- **缺口**：没有对称测试断言 legacy mode 仍调用 `RegexProcessor`——边界回归只守住了一半。

**⑥ 仓库卫生（partial）**
- `.husky/pre-commit` 为 `-rw-r--r--`（缺 executable 位，`git commit` 钩子被忽略）。
- `.gitignore:75` 有 `/.playwright-cli/`，但**无** `/.playwright-mcp/`；后者当前 untracked。
- `git log origin/main..HEAD`：**61 个本地 commit 未 push**；工作区另有约 36 modified + 18 untracked。

---

## 二、深化候选 × 原始 invariant 接地（任务 3）

12 个 agent 中 6 个专做接地：读候选相关文件，对照 INV-1…INV-8 判断是否违反、是否合意图。**结论：6 个候选都不违反任何 invariant**；强度按"与意图一致性"分化。

| 候选 | 违反 invariant？ | 与原始意图一致？ | 关联 ADR | 调整后建议 |
|------|:---:|:---:|----------|------------|
| #1 persist-leak（runtime 不反向依赖 server store） | 否 | 是 | [[ADR-0001]] · [[ADR-0003]] | `proceed-with-guardrail` |
| #2 self-sinks（sink 自拥 wire format） | 否 | 是 | — | `proceed-with-guardrail` |
| #3 world-matcher（共享 keyword matcher） | 否 | 是（印证 [[ADR-0006]]） | [[ADR-0006]] | `proceed-with-guardrail`（仅 matching） |
| #4 story-memory（索引 + 删死 retriever） | 否 | 是（删死码即 hard-replace 单轨化） | [[ADR-0003]] | `proceed-with-guardrail` |
| #5 render-helpers（status-pattern 去重） | 否 | 是 | [[ADR-0005]] · [[ADR-0008]] | **`proceed`（唯一无护栏）** |
| #6 state-parser（MVU/Story State 共享解析器） | 否 | **否（有意隔离）** | [[ADR-0007]] | **`hold`** |

### 2.1 逐候选接地与护栏

**#1 persist-leak — `proceed-with-guardrail`**
与 [[ADR-0001]]/[[ADR-0003]]"runtime 是纯编排、不留双轨"一致；反而强化 hard-replace 边界。护栏：
- persist 事件 schema 写进 `lib/generation-runtime/events.ts`，不要私有格式泄漏。
- 消费 persist 的持久化适配器放在 `app/session` 或 `function` 层，`LocalCharacterDialogueOperations.updateNodeInDialogueTree` 只许在适配器调用，禁止回流 runtime。
- 持久化必须发生在 `finalizeStoryTurn` 的 `commitSession` 之后，避免二次提交。

**#2 self-sinks — `proceed-with-guardrail`**
纯传输层重构，与所有 invariant 无交集。护栏：
- 各 sink 内化序列化后，加 round-trip 测试（emit→parse→serialize→parse）保证与入站 parser 一致。
- 共享 `type`/`reason` 等字段用共享常量定义。
- 入站 parser（`legacy-dialogue-response.ts` 的 `parseLegacyDialogue*`）必须保留（被 legacy stream/transport 使用）；改名非必须。

**#3 world-matcher — `proceed-with-guardrail`（仅 matching）**
直接由 [[ADR-0006]] 背书并划界：
- 抽出 `WorldKeywordMatcher` 只含纯函数 `matchesKey`/`matchesRegex`/`matchesEntry`/`evaluateSecondaryKeys`。
- **time-effects 留在 `world-module.ts`**：`tickState`/`nextEntryState`/`resolveHit`/`matchOnce`（有状态，写入 `StorySession.worldbookActivationState`，INV-5）。
- 若 `lib/core/world-book-advanced.ts` 也复用该 matcher，须显式注明它"仅服务导入验证测试，不在产品 story-runtime 调用"（[[ADR-0002]] §3.1）。

**#4 story-memory — `proceed-with-guardrail`**
删 `MemoryRetrievalManager`（grep 确认仅 `lib/vectors/index.ts` 导出、无业务调用者）正是 [[ADR-0003]] 的单轨化要求——它是旧 roadmap 残留。护栏：
- 在 `VectorMemoryManager` 加 `ingestStoryMemory(sessionId, facts, relationships)`；可选 `memoryPolicy.vectorizeMemory` 开关（记忆策略仍 deferred 到 SAC-Phase 6b，别越界设计）。
- 接入检索时保留与 `formatStoryMemoryMessages` 同样的 fail-safe（不静默丢，INV-7）。

**#5 render-helpers — `proceed`（唯一无护栏）**
纯编译期 helper 去重（`classifier.ts:114-121` 与 `extractor.ts:99-102` 逐字重复），不碰白名单（INV-3）、不碰运行时格式判断（INV-1）、不影响 story render mode 边界（[[ADR-0008]]）。抽到 `lib/story-agent/render-intent/status-pattern.ts` 即可。风险最低，适合作为第一步。

**#6 state-parser — `hold`（不违反 invariant，但与意图不一致）**
关键发现：Story State 与 MVU 的隔离是**有意的**，不是疏忽。
- 两者在编译期就固化为不同命令类型（`StoryStateCommandName` vs `CommandName`）；MVU `parseCommandValue` 支持 YAML/Math 表达式，Story State 简化为 JSON——这个差异是设计选择。
- 运行时隔离边界清晰，符合 [[ADR-0007]] INV-6（status 变量 runtime-owned，不回流脚本执行）。
- memory policy 仍 deferred 到 SAC-Phase 6b，过早统一解析器会挤压该阶段的设计空间。
- 当前没有可指认的共同 bug。"漂移成 bug 前属推测"的假设缺 evidence。
→ 维持上一轮"在漂移真成 bug 前先按住"的结论，并升级理由：这是**有意隔离**，重开前应先有真实 bug 证据。

---

## 三、综合：调整后的推进顺序

把架构评审的强度 × 接地结论 × 待完成优先级合在一起：

1. **render-helpers（#5）** — 唯一 `proceed`、零护栏、零风险，适合开胃。
2. **persist-leak（#1）** — 局部性收益最高，强化 hard-replace 边界；带 3 条护栏。
3. **world-matcher（#3）** — 可导航性收益最大；严格按 [[ADR-0006]] 只收敛 matching。
4. **story-memory（#4）** — 删死码立竿见影，且补上"Story Memory 算了却不可检索"的真实缺口。
5. **self-sinks（#2）** — 传输层整洁，价值中等。
6. **state-parser（#6）** — `hold`，等真实 bug。

待完成工作里，**StoryState branch replay（outstanding，第 2 优先级）** 仍是阻塞 regenerate/swipe/branch 的硬骨头，与上述架构深化彼此独立，可并行排期。仓库卫生三项（pre-commit 权限 / `.playwright-mcp` gitignore / 61 commit 未 push）是低成本清理，建议单独一次性处理。

> 注：本文只读核验，未改任何运行时代码；本轮新增产物仅 `docs/adr/0001`–`0008` 与本文档。
