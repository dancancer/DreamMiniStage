# 执行清单（2026-05-29）

## 1. 规划与基线

- [x] 建立 Story Agent Asset Compiler 路线文档。
- [x] 明确 SillyTavern 资产只作为导入源格式，不进入运行时。
- [x] 将“关键决策必须先 POC”写入阶段计划。
- [x] 根据 review 补充 hard replace、deferred schema、import 栈收敛、LLM repair 安全边界和 RenderIntent 覆盖率约束。
- [x] 明确项目开发阶段不做历史数据兼容、不做双轨运行时、不做 shadow/legacy feature flag。
- [x] 固化 `test-baseline-assets` 资产清单与语义摘要。
- [x] 建立 POC 记录模板文件。

## 2. SAC-Phase 0：资产基线与 POC 框架

- [x] 输出 `artifacts/asset-semantics-checklist.md`，先定义角色卡、世界书、预设、正则的字段级“语义不丢失”指标。
- [x] 世界书 checklist 显式覆盖 `constant`、主键匹配、`selective` + `secondary_keys` + `selectiveLogic`、`sticky`、`cooldown`、`delay`、递归与 `maxRecursionDepth`、`depth`、`insertion_order`、概率、分组和正则匹配。
- [x] 输出 `artifacts/runtime-inventory.md`，盘点完整爆炸半径：prompt manager/bridge/viewer/helpers、regex processor/render pipeline、world-book-advanced、四个 SimpleTool、agent model、script-bridge、local-storage/vector-memory store。
- [x] 在 `runtime-inventory.md` 中明确每项是保留为导入验证、重写为 story-runtime 验证还是删除，并记录 `prompt_order` 已不在 preset 存储层，只在 `PresetNodeTools -> STPromptManager` 运行时桥中临时合成。
- [x] 输出 `artifacts/poc-template.md`。
- [x] POC-0.1：读取四张 PNG 角色卡和一份 JSON 角色卡，统计核心字段、内嵌世界书、内嵌正则、扩展字段。
- [x] POC-0.2：读取两个真实 preset，验证 prompt 数量、启用状态、order、injection position/depth 是否可稳定归一化。
- [x] POC-0.3：读取真实世界书和正则文件，验证 legacy 字段是否能进入同一 normalized schema。
- [x] 输出 `artifacts/baseline-assets.md`。
- [x] 输出 `SAC-Phase 1` 数据契约候选清单。

## 3. SAC-Phase 1：统一导入 Bundle

- [x] 定义 `ImportedAssetBundle` schema。
- [x] 明确 `ImportedAssetBundle` 复用或扩展 `lib/adapters/import` 的 `NormalizedPreset`、`NormalizedPresetPrompt`、`NormalizedWorldBookEntry`。
- [x] 明确 `ImportedCharacterProfile` 是净新契约，`regexScripts` 当前复用现有 `RegexScript[]`；如果要引入 `NormalizedRegexScript`，必须在本阶段定义。
- [x] 定义世界书 `selectiveLogic` 的 canonical enum，并把 ST 数字值（如真实 fixture 中的 `0`）确定性映射进去。
- [x] 决定 `SessionBlueprint` 持久化位置，以及既有 `PRESET_FILE`、`WORLD_BOOK_FILE`、`REGEX_SCRIPTS_FILE`、`MEMORY_ENTRIES_FILE`、vector-memory store 与 blueprint store 的关系。
- [x] 盘点并标注 `function/character/import.ts` 中 `character_book` 直写 IndexedDB（未归一化）vs regex 走 adapter 的不一致，定义统一入口。
- [x] 收敛角色卡、世界书、预设、正则 import adapter 入口：所有 ST 资产导入必须先进入 adapter/bundle，再由调用方决定存储。
- [x] 角色卡内嵌 `character_book` 改为走世界书 adapter。
- [x] 角色卡内嵌 `regex_scripts` 继续走正则 adapter，并纳入 bundle provenance。
- [x] 不支持执行的扩展进入 `extensionArtifacts`，并生成 diagnostics。
- [x] POC-1.1：用 `Sgw3.png` + 外部世界书 + 外部 preset + 外部 regex 生成 bundle，断言数量、关键 flags、source provenance 不丢。
- [x] POC-1.2：同一角色卡的 PNG 与 JSON 版本生成的 bundle 差异必须可解释。
- [x] POC-1.3：故意输入损坏字段，验证 fail-fast 与 diagnostics。
- [x] 定向测试或 grep 断言证明导入入口没有绕过 adapter 直写 runtime storage。

## 4. SAC-Phase 2：静态诊断与 LLM QA Repair

- [x] 建立 deterministic diagnostics 分类。
- [x] 定义 LLM QA 输入输出 schema。
- [x] 定义 typed repair patch schema。
- [x] 实现 repair patch validator。
- [x] 定义 Low / Medium / High repair 风险等级，risk level 必须由 patch target path 和 operation 确定性计算，禁止 LLM 自评。
- [x] 输出 High-risk path map，覆盖角色人格、描述、核心开场白、关系设定、内容边界、系统 prompt、关键世界书条目。
- [x] POC-2.1：对真实资产生成 diagnostics，人工抽样确认不是噪声报告。
- [x] POC-2.2：用 LLM QA 输出形状的 synthetic payload 验证 typed patch，并用 validator 拦截非法 patch；外部 Claude CLI 调用失败记录在 POC 工件中。
- [x] POC-2.3：对真实资产只启用 Low-risk auto repair，验证修复前后语义指标不丢。
- [x] POC-2.4：构造含 prompt-injection 的资产，验证 schema-valid 但 risk-mislabeled 的 patch 不会 auto-apply。

## 5. SAC-Phase 3：SessionBlueprint Core 编译器

- [x] 定义 `SessionBlueprint` core schema。
- [x] 编译角色设定为 `AgentProfile`。
- [x] 编译 preset 和角色卡 prompt 字段为 `PromptStack`。
- [x] 编译世界书为 `WorldModule`。
- [x] 编译正则为 input/output/prompt transforms 与 content rules；render rules 仅写 deferred contract，依赖 `SAC-Phase 5`。
- [x] 记忆策略仅写 deferred contract，依赖 `SAC-Phase 6b`。
- [x] 输出稳定 hash、版本号、provenance、diagnostics。
- [x] POC-3.1：用真实资产生成 `SessionBlueprint` JSON，并做 snapshot review。
- [x] POC-3.2：相同资产重复编译得到稳定 hash；资产变化时 hash 改变。
- [x] POC-3.3：离线 prompt assembly harness 只读 `SessionBlueprint`，不读原始 ST 文件。
- [x] 输出 deferred contract 升级策略，明确 render/memory 进入稳定 hash 的触发规则。

## 6. SAC-Phase 4：世界书与 Prompt 编排运行时 POC

- [x] 实现 `WorldModule` matcher POC。
- [x] 实现 `PromptStack` assembler POC。
- [x] 注入结果带 `WorldHit` 和 prompt provenance。
- [x] 对比当前 ST baseline assembly 测试，区分 bug 与有意差异。
- [x] 盘点 MVU、slash script、TavernHelper 中影响“模型产出结构化标签/变量”的 prompt 约定，决定是否编译进 `PromptStack`。
- [x] 建立离线 prompt/worldbook diff harness，仅用于一次性 POC 差异解释，不接入产品运行时。
- [x] POC-4.1：用真实角色卡和外部世界书，在几组用户输入下输出 world hits。
- [x] POC-4.2：用两个真实 preset 输出最终 prompt message list，并记录与 baseline 差异。
- [x] POC-4.3：长上下文预算不足时，验证世界书、记忆、历史消息的裁剪顺序。
- [x] POC-4.4：验证 `WorldModule` 对 sticky、cooldown、delay、recursion、depth、insertion order 的行为，明确有状态字段将写入 `StorySession` 的世界书激活状态。
- [x] Phase 4 diff 不得存在未关闭的 `bug` 类差异，否则不得进入 `SAC-Phase 6a`。

## 7. SAC-Phase 5：正则、内容过滤与 UI Render Intent

- [x] 建立 regex 分类器。
- [x] 定义 `RenderIntent` schema。
- [x] 定义 UI 白名单组件集合。
- [x] 扩充 UI regex 语料，现有 `test-baseline-assets` 不足以证明 HTML-widget regex 覆盖率。
- [x] 定义 unsupported UI regex 的产品兜底：显式报告语义损失、展示原始规则摘要、允许用户选择禁用或降级为纯文本。
- [x] 不安全或无法判断的 regex 必须禁用或降级为受限 transform，并报告原因。
- [x] POC-5.1：对扩充后的真实 regex scripts 做分类，输出分类置信度、UI 类占比、可转 RenderIntent 占比和 unsupported 原因。
- [x] POC-5.2：选择 2-3 条 UI 类 regex，转换为 `RenderIntent` 并用 React 白名单组件渲染。
- [x] POC-5.3：验证恶意或复杂 regex 不会进入 UI 执行路径。

## 8. SAC-Phase 6a：最小 StorySession Runtime 硬替换

- [x] 定义最小 `StorySession` 状态模型：recent transcript、worldbook activation state、render state。
- [x] `worldbook activation state` 必须承载 sticky、cooldown、delay 计数器和递归命中状态。
- [x] 实现每轮生成后的 recent transcript、世界书激活状态、UI 状态更新 POC。
- [x] blueprint session 生成链路硬替换旧链路，不再调用 `STPromptManager`、`PresetNodeTools.convertToSTOpenAIPreset` 和 runtime `placement` 分支。
- [x] 统一删除或改造旧 regex/render 链、world-book-advanced 实时匹配、SimpleTool 字面 `keysecondary`、`BaseWorldbookEntry.keysecondary`、script-bridge 在 `/session` 的旧接入方式。
- [x] 明确 hard-replace 失败时的回滚预案：回到上一 commit 或整批 revert 当前阶段变更，不在代码中保留双轨 fallback。
- [x] 输出 story runtime replacement report。
- [x] POC-6a.1：用同一 `SessionBlueprint` 连续推进多轮模拟会话，检查角色身份、recent transcript、world hits、render state 和世界书激活状态是否稳定。
- [x] POC-6a.2：验证 sticky、cooldown、delay 跨轮次计数器在 `StorySession` 中更新，而不是写回 worldbook 静态定义。
- [x] POC-6a.3：验证 blueprint session 生成链路没有 ST-shaped `prompt_order` / runtime `placement` 分支。

## 9. SAC-Phase 6b：长期记忆与会话稳定性

- [x] 扩展 `StorySession` 状态：running summary、episodic memory、facts memory、relationship/state memory。
- [x] 定义 memory extraction 与 consolidation 策略。
- [x] 实现每轮生成后的摘要、事实、事件和关系状态更新 pipeline。
- [x] POC-6b.1：超过上下文窗口后，验证 summary/facts/world hits 能替代丢弃历史。
- [x] POC-6b.2：记忆抽取失败时，运行时必须降级但不破坏会话。
- [x] POC-6b.3：长会话 replay 中角色身份、关键事实和关系状态保持稳定。

## 10. SAC-Phase 7：产品化导入向导与用户确认流

- [ ] 设计导入向导状态流。
- [ ] 展示资产识别、自动修复、高风险确认、最终配置摘要。
- [ ] 支持从编译后的 agent 创建会话。
- [ ] 完成 blueprint agent 的导入向导和 `/session` 入口，且不得增加 shadow/legacy migration flag 或双轨开关。
- [ ] 按 `SAC-Phase 6a` 决策落实 script-bridge 的最终去留，产品路径不得留下孤儿子系统。
- [ ] POC-7.1：无 UI 的 CLI/dev route 导入流程，先验证状态流。
- [ ] POC-7.2：最小 UI 导入向导，完成一组真实资产导入。
- [ ] POC-7.3：导入后从生成的 agent 创建会话并发送首轮消息。

## 11. 阶段质检门

- [ ] 每个阶段进入实现前，必须先完成对应 POC 并记录结果。
- [ ] POC 阶段使用定向 `vitest`、schema fixture、snapshot、typecheck 或 dev route 验证，不用完整 build gate 替代可行性验证。
- [ ] 实现阶段完成后，必须执行 `pnpm verify:stage`。
- [ ] `pnpm verify:stage` 后清理生成物，再确认 `git status --short`。
- [ ] 阶段 review 必须记录 POC 结论、未决策项和下一阶段输入。
