# Story Agent Asset Compiler 规划（2026-05-29）

> 范围：角色卡、世界书、预设、正则等 SillyTavern 资产导入后，一次性转换为 DreamMiniStage 自有会话配置，并支撑长期角色叙事会话。
> 原则：SillyTavern 是导入源格式，不是运行时架构。真实会话期间不得再解析 SillyTavern 原始资产。
> 编号命名空间：本文阶段统一使用 `SAC-Phase`，避免和旧 SillyTavern roadmap 中的 Phase 编号混淆。

## 1. 背景与目标

当前项目已经具备角色卡、世界书、预设、正则、脚本宿主等基础能力，也沉淀了一批真实 SillyTavern 测试资产。新的产品路线不应继续把目标定义为“复刻 SillyTavern 的所有菜单和插件”，而应回到用户真实需求：

- 用户选择角色卡、世界书、预设、正则后，可以直接开始一个稳定的角色故事会话。
- 会话可以长时间推进，角色设定、世界背景、状态、关系与记忆不轻易漂移。
- 导入资产中的过滤、格式化、UI 渲染意图、世界书注入语义能够被保留或转换。
- 普通用户制作的不完整资产，可以在导入转换层被诊断、修复、适配，而不是把错误带入运行时。
- 会话运行时只消费 DreamMiniStage 自有的稳定配置，不再理解 `chara`、`ccv3`、`prompt_order`、`keysecondary`、`placement` 等 SillyTavern 细节。

本规划的核心产物是 `SessionBlueprint`，也可以在实现时命名为 `StoryPackage` 或 `StoryAgentConfig`。它是一次性编译结果，作为后续 `StorySession` 运行时的唯一输入契约。

本规划取代 `docs/plan/2026-03-08-sillytavern-product-roadmap/plan.md` 的主方向。旧路线以“产品化对齐 SillyTavern 上游运行语义”为目标；新路线改为“把 SillyTavern 资产作为导入源，编译成 DreamMiniStage 自有 agent 配置”。旧路线中已经识别出的模型参数、prompt/preset、世界书、正则、MVU、slash 能力差距仍是有效输入，但必须重新归入本路线的导入、编译、运行时替换或产品向导阶段，不再作为“运行时必须保持上游形状”的要求。

项目仍处于开发阶段，本路线不做历史数据兼容、不做旧 IndexedDB 数据迁移、不保留双轨运行时、不增加 legacy feature flag。任何旧数据、旧 runtime、旧 schema 和旧测试，如果与新路线冲突，都应在对应阶段直接替换、删除或重写验证。

## 2. 非目标

- 不在首轮目标中追求 SillyTavern 全功能逐项复刻。
- 不把第三方脚本、TavernHelper、MVU、slash script 直接带入运行时执行。
- 不允许导入资产直接生成任意 HTML、JavaScript 或未受控 UI。
- 不在运行时保留历史兼容 fallback。绿色项目策略下，导入层负责适配，运行时只认新契约。
- 不提供旧本地数据迁移、双轨开关、灰度切换或 legacy fallback。旧结构如果阻碍新路线，应直接替换。
- 不在没有 POC 证据前锁死数据模型、Prompt 编排算法、世界书匹配策略、正则 UI 渲染协议或 LLM 修复策略。

## 3. 总体架构

```mermaid
flowchart LR
  A["Selected ST assets<br/>角色卡/世界书/预设/正则"] --> B["Import adapters<br/>格式解析"]
  B --> C["Deterministic normalize<br/>字段归一化"]
  C --> D["Diagnostics<br/>静态诊断"]
  D --> E["POC gates<br/>方案验证"]
  E --> F["LLM QA & repair<br/>质检/修复建议"]
  F --> G["Compiler<br/>生成会话配置"]
  G --> H["SessionBlueprint<br/>版本化配置"]
  H --> I["StorySession Runtime<br/>长期会话推进"]
```

关键边界：

- `compat/import`：只负责解析外部资产与归一化，不承担会话运行。
- `asset-qa`：负责静态诊断、LLM 质检、修复 patch 生成与风险分级。
- `story-compiler`：负责把导入后的 bundle 编译为 `SessionBlueprint`。
- `story-runtime`：只消费 `SessionBlueprint`、会话状态、记忆与模型接口。

### 3.1 运行时硬替换与既有 ST-shaped runtime 删除策略

当前仓库不是空白状态。真实 `/session` 运行链路仍包含 ST 形状数据结构：

- Prompt 侧：
  - `lib/core/prompt/manager.ts` 的 `STPromptManager` 子系统运行时读取 `preset.openai.prompt_order`。
  - `lib/nodeflow/PresetNode/PresetNodeTools.ts` 会把当前预设重新转换为 `STOpenAIPreset`，再喂给 ST prompt manager。
  - `lib/prompt-viewer/prompt-builder.ts`、`lib/core/prompt/preset-utils.ts`、`lib/core/prompt/sorting.ts`、`lib/core/prompt/manager-helpers.ts` 也属于 prompt hard-replace 的核查范围。
- Regex/render 侧：
  - `lib/core/regex-processor.ts` 运行时仍按 `placement` 数组过滤正则脚本。
  - `lib/utils/content-parser.ts` 会调用 `RegexProcessor.processFullContext`，`components/message-bubble/useMessageRenderPipeline.ts` 会调用 `parseContentAsync`，因此消息渲染链也在替换范围内。
- Worldbook 侧：
  - `lib/core/world-book-advanced.ts` 仍在实时对话链路中处理 `secondary_keys`、`selective`、`delay` 等匹配语义。
- Tool/model 侧：
  - `lib/tools/status/index.ts`、`lib/tools/user-setting/index.ts`、`lib/tools/world-view/index.ts`、`lib/tools/supplement/index.ts` 仍写入字面 `keysecondary`。
  - `lib/models/agent-model.ts` 的 `BaseWorldbookEntry` 仍包含 `keysecondary`。
- Script bridge 侧：
  - `app/session/session-slash-executor.ts` 通过 `hooks/script-bridge/*` 接入 `/session`，`script-bridge` 子系统必须在 hard-replace 决策中明确保留、删除或改造，不得遗漏。

有利事实：preset 存储层已经不保留 `prompt_order`。`lib/data/roleplay/preset-operation.ts` 导入时已把 `prompt_order` 转成 `group_id/position`，因此 prompt 侧 hard-replace 的核心不是从存储层拔 `prompt_order`，而是替换 `PresetNodeTools -> STPromptManager` 这座运行时桥，以及受它影响的 prompt viewer / helper 子系统。

因此本路线选择 **hard replace**，不是 coexist，也不是 staged runtime flag：

- `SAC-Phase 0` 先盘点当前 ST-shaped runtime、baseline tests、真实 `/session` 入口和各模块职责，产出“保留为导入验证 / 重写为新 runtime 验证 / 删除”的明确清单。
- `SAC-Phase 1` 到 `SAC-Phase 3` 建立导入、诊断、编译和离线 fixture。它们只服务 POC 与测试，不接入产品运行时，也不形成第二套 runtime。
- `SAC-Phase 4` 建立 `StoryPromptAssembler` / `WorldModule` 的离线对比 harness，与现有 `STPromptManager` 输出做一次性差异分析。差异分析完成后，旧 prompt assembly 路径不得作为产品 fallback 保留。
- `SAC-Phase 5` 建立新正则 transform/render schema 与渲染白名单，只定义替换策略，不在本阶段宣称删除旧 `regex-processor` runtime `placement` 行为。
- `SAC-Phase 6a` 直接替换 blueprint session 生成链路，并统一删除或改造旧 prompt、regex/render、worldbook、tool/model、script-bridge 耦合面；生成链路不再调用 `STPromptManager`、`PresetNodeTools.convertToSTOpenAIPreset` 和 runtime `placement` 分支。
- `SAC-Phase 7` 只做产品导入向导和 agent 创建体验，不再承担 runtime 双轨切换。

既有 `st-baseline-*` 测试是一次性基线和资产语义参考。进入新 runtime 后，测试必须被重写为 import/compiler/story-runtime regression，或直接删除并记录原因；不得通过保留旧测试来强迫产品 runtime 继续理解 ST-shaped 字段。

运行时不得出现外部资产格式判断，例如：

```ts
if (assetType === "sillytavern") {}
if (entry.keysecondary) {}
if (preset.prompt_order) {}
if (regex.placement === 2) {}
```

这些差异必须在导入和编译阶段消化。

## 4. 核心数据契约草案

本节只是草案，任何字段进入正式实现前都必须经过对应 POC。

`SessionBlueprint` 分为 core contract 和 extension contract。`SAC-Phase 3` 只能冻结 core contract；`renderRules` 依赖 `SAC-Phase 5` 的 `RenderIntent` schema，`memoryPolicy` 依赖 `SAC-Phase 6b` 的长期记忆 POC，在此之前只能以 deferred contract 记录，不得进入稳定 hash 的强语义部分。

```ts
type ImportedAssetBundle = {
  sourceFiles: SourceFileRef[];
  character: ImportedCharacterProfile;
  worldBooks: NormalizedWorldBookEntry[];
  preset?: NormalizedPreset;
  regexScripts: RegexScript[];
  extensionArtifacts: ExtensionArtifact[];
  diagnostics: ImportDiagnostic[];
  provenance: SourceProvenance[];
};

type DeferredContract = {
  status: "deferred";
  phase: "SAC-Phase 5" | "SAC-Phase 6b";
  reason: string;
};

type SessionBlueprint = {
  id: string;
  version: number;
  sourceHash: string;
  createdAt: string;

  profile: AgentProfile;
  promptStack: PromptStack;
  worldModules: WorldModule[];

  inputTransforms: TextTransform[];
  outputTransforms: TextTransform[];
  promptTransforms: TextTransform[];
  contentRules: ContentRule[];

  renderRules?: RenderRule[] | DeferredContract;
  memoryPolicy?: MemoryPolicy | DeferredContract;

  diagnostics: ImportDiagnostic[];
  repairReport: RepairReport;
  provenance: SourceProvenance[];
};
```

设计约束：

- `SessionBlueprint` 必须可序列化、可 diff、可版本化。
- `sourceHash` 必须能证明一组资产是否已经重新编译。
- `diagnostics` 和 `repairReport` 是产品能力，不是只给开发者看的日志。
- `provenance` 必须能追踪配置片段来自哪张角色卡、哪个世界书、哪个 preset、哪条 regex。
- `NormalizedPreset`、`NormalizedPresetPrompt`、`NormalizedWorldBookEntry` 优先复用 `lib/adapters/import` 已有导出类型。若实现发现需要新类型，必须先说明为什么既有类型不能扩展。
- `ImportedCharacterProfile` 是 Story Agent Compiler 净新契约，不是现有导出类型。
- `RegexScript` 暂时表示现有正则 adapter 的输出；若后续需要 `NormalizedRegexScript`，必须在 `SAC-Phase 1` 明确定义，不能假设它已存在。

## 5. 决策协议：先 POC，再定案

本路线所有关键决策必须遵守同一协议：

1. 写出候选方案。
2. 定义最小 POC 输入和成功标准。
3. 用仓库内真实测试资产执行 POC。
4. 记录 POC 结果、失败样例和成本。
5. 再决定是否进入正式设计。

每个 POC 至少要回答：

- 是否能处理 `test-baseline-assets` 中的真实资产。
- 是否能保留关键语义，不只是成功 parse。
- 是否能生成可解释 diagnostics。
- 是否会把复杂性泄漏到运行时。
- 是否有明确的 fail-fast 行为。

POC 记录模板：

```md
### POC: <name>

- Question:
- Inputs:
- Implementation sketch:
- Success criteria:
- Result:
- Decision:
- Follow-up:
```

## 6. 分阶段计划

### SAC-Phase 0：资产基线与 POC 框架

目标：先建立真实资产基线、POC 记录机制和阶段验收规则。

工作内容：

- 先产出“语义不丢失指标”文档，再执行 POC。指标必须按角色卡、世界书、预设、正则分别列出字段级 checklist。
- 固化当前 `test-baseline-assets` 的资产清单和语义摘要。
- 建立 `SessionBlueprint` 编译路线的 POC 目录和记录模板。
- 盘点当前 ST-shaped runtime、`st-baseline-*` 测试、真实 `/session` 入口和删除/替换候选模块。
- runtime inventory 必须覆盖完整爆炸半径：prompt manager/bridge/viewer/helpers、regex processor/render pipeline、world-book-advanced、四个 SimpleTool、agent model、script-bridge、local-storage/vector-memory store。
- 世界书语义 checklist 必须显式覆盖：`constant`、主键匹配、`selective` + `secondary_keys` + `selectiveLogic`、`sticky`、`cooldown`、`delay`、递归与 `maxRecursionDepth`、`depth`、`insertion_order`、概率、分组和正则匹配。
- 明确哪些 SillyTavern 扩展首轮只保留 raw artifact，不执行。

必须完成的 POC：

- POC-0.1：读取四张 PNG 角色卡和一份 JSON 角色卡，统计核心字段、内嵌世界书、内嵌正则、扩展字段。
- POC-0.2：读取两个真实 preset，验证 prompt 数量、启用状态、order、injection position/depth 是否可稳定归一化。
- POC-0.3：读取真实世界书和正则文件，验证 legacy 字段是否能进入同一 normalized schema。

阶段产物：

- `docs/plan/2026-05-29-story-agent-asset-compiler/artifacts/asset-semantics-checklist.md`。
- `docs/plan/2026-05-29-story-agent-asset-compiler/artifacts/baseline-assets.md`。
- `docs/plan/2026-05-29-story-agent-asset-compiler/artifacts/poc-template.md`。
- `docs/plan/2026-05-29-story-agent-asset-compiler/artifacts/runtime-inventory.md`。
- `SAC-Phase 1` 的数据契约候选清单。

完成定义：

- 上述四个 artifact 已提交。
- POC-0.x 的结果引用 `asset-semantics-checklist.md` 的具体 checklist 项。
- `runtime-inventory.md` 明确列出 prompt、regex/render、worldbook、tool/model、script-bridge、storage/memory 六类耦合面，以及相关 baseline tests 的保留为导入验证、重写为 story-runtime 验证或删除状态。
- `runtime-inventory.md` 明确记录：`prompt_order` 已不在 preset 存储层，只在 `PresetNodeTools -> STPromptManager` 运行时桥中临时合成。

### SAC-Phase 1：统一导入 Bundle

目标：把用户选择的角色卡、世界书、预设、正则合并为一个 `ImportedAssetBundle`。

工作内容：

- 以 `lib/adapters/import` 作为权威归一化层，复用现有 `NormalizedPreset`、`NormalizedPresetPrompt`、`NormalizedWorldBookEntry`。
- 盘点并修正两套 import 栈：`lib/adapters/import` 已有归一化与 property tests，`function/*/import.ts` 是 server action 入口，其中 `function/character/import.ts` 当前存在 `character_book` 直写 IndexedDB、regex 走 adapter 的不一致。
- 收敛 import 入口的完成标准：所有 ST 资产导入必须先进入 adapter/bundle，再由调用方决定存储；不得在导入阶段绕过 adapter 直写 runtime storage。
- 角色卡内嵌 `character_book` 必须走世界书 adapter，不允许直接写入 runtime storage。
- 角色卡内嵌 `regex_scripts` 必须走正则 adapter。
- 外部世界书、外部正则、preset 与角色卡扩展统一进入 bundle。
- 所有无法执行的扩展进入 `extensionArtifacts`，并生成 diagnostics。

必须完成的 POC：

- POC-1.1：用 `Sgw3.png` + 外部世界书 + 外部 preset + 外部 regex 生成 bundle，断言数量、关键 flags、source provenance 不丢。
- POC-1.2：同一角色卡的 PNG 与 JSON 版本生成的 bundle 差异必须可解释。
- POC-1.3：故意输入损坏字段，验证 fail-fast 与 diagnostics，而不是静默 fallback。

阶段产物：

- `ImportedAssetBundle` schema。
- bundle 编译入口草案。
- bundle diagnostics 草案。
- import 栈现状与收敛说明。

完成定义：

- `ImportedAssetBundle` fixture 覆盖 PNG 角色卡、JSON 角色卡、外部 worldbook、preset、regex。
- `function/character/import.ts` 的 `character_book` 直写问题有明确处理方案或实现补丁。
- grep 或定向测试能证明 ST 资产导入入口不再绕过 adapter 写入 runtime storage。

### SAC-Phase 2：静态诊断与 LLM QA Repair

目标：把普通用户资产中的常见错误拦在导入转换层，并用 LLM 做受控质检和修复建议。

工作内容：

- 建立 deterministic diagnostics：
  - 空 key、重复 id、无效 regex、过宽 key、空 prompt、冲突 position、过长 entry。
  - prompt order 缺失、启用状态异常、角色字段缺失。
  - regex placement、promptOnly、markdownOnly、runOnEdit 等语义风险。
- 建立 LLM QA contract：
  - LLM 只输出结构化 report 和 typed patch。
  - 不允许 LLM 直接重写整份资产。
  - 高风险修复必须用户确认。
- 风险等级由 patch target path 和 operation 确定性计算，禁止 LLM 自评。LLM 可以解释风险原因，但不能决定 risk level。
- 定义修复风险等级：
  - Low：字段名修正、id 重建、启用状态归一化。
  - Medium：拆分世界书、调整 prompt slot、regex 分类。
  - High：改角色人格、删核心设定、改写关系、改变内容边界。
- 建立 High-risk path 清单，例如角色人格、角色描述、核心开场白、关系设定、内容边界、系统 prompt、关键世界书条目。具体字段路径必须进入 validator 配置。

必须完成的 POC：

- POC-2.1：对真实资产生成 diagnostics，人工抽样确认不是噪声报告。
- POC-2.2：让 LLM 对一组带缺陷的 synthetic bundle 输出 typed patch，并用 validator 拦截非法 patch。
- POC-2.3：对真实资产只启用 Low-risk auto repair，验证修复前后语义指标不丢。
- POC-2.4：构造含 prompt-injection 的角色卡、世界书、preset、regex，验证 QA LLM 不能绕过 typed patch schema 和 deterministic risk mapping；命中 High-risk path 却标 Low 的 patch 必须 fail-fast。

阶段产物：

- diagnostics code 分类。
- LLM QA prompt/schema 草案。
- repair patch validator。
- 导入结果报告格式。

完成定义：

- diagnostics code enum、risk path map、repair patch schema、validator fixtures 已提交。
- 每个 risk level 至少有一个 fixture。
- prompt-injection POC 证明 schema-valid 但 risk-mislabeled 的 patch 不会 auto-apply。

### SAC-Phase 3：SessionBlueprint Core 编译器

目标：从 `ImportedAssetBundle` 生成运行时唯一消费的 `SessionBlueprint` core contract。

工作内容：

- 编译角色设定为 `AgentProfile`。
- 编译 preset 和角色卡 prompt 字段为 `PromptStack`。
- 编译世界书为 `WorldModule`。
- 编译正则为：
  - `inputTransforms`
  - `outputTransforms`
  - `promptTransforms`
  - `contentRules`
- `renderRules` 只允许写入 deferred contract，等待 `SAC-Phase 5` 定义 `RenderIntent` schema 后进入稳定契约。
- `memoryPolicy` 只允许写入 deferred contract，等待 `SAC-Phase 6b` 记忆 POC 后进入稳定契约。
- 输出稳定 hash、版本号、provenance、diagnostics。

必须完成的 POC：

- POC-3.1：用真实资产生成 `SessionBlueprint` JSON，并做 snapshot review。
- POC-3.2：相同资产重复编译得到稳定 hash；资产变化时 hash 改变。
- POC-3.3：离线 prompt assembly harness 只读 `SessionBlueprint`，不读原始 ST 文件。

阶段产物：

- `SessionBlueprint` core schema。
- compiler 最小实现。
- snapshot fixture。
- deferred contract 升级策略。

完成定义：

- `SessionBlueprint` core snapshot 不包含未定义的 `RenderIntent` 或长期记忆策略语义。
- 稳定 hash 明确排除 deferred contract 的未来实现细节，或记录契约版本触发 hash 重新计算。
- POC-3.3 证明离线 prompt assembly harness 不读原始 ST 文件。

### SAC-Phase 4：世界书与 Prompt 编排运行时 POC

目标：验证 `SessionBlueprint` 是否足以支撑真实会话中的上下文注入。

工作内容：

- 实现 `WorldModule` matcher POC。
- 实现 `PromptStack` assembler POC。
- 注入结果必须带 `WorldHit` 和 prompt provenance。
- 对比当前 ST baseline assembly 测试，明确哪些差异是 bug，哪些是新路线有意差异。
- 明确 MVU、slash script、TavernHelper 中用于“让模型按约定产出结构化标签或变量”的 prompt 约定是否需要编译进 `PromptStack`。首轮不执行第三方脚本，但不能无声丢掉会影响模型输出格式的提示约定。
- 建立离线 prompt/worldbook diff harness。它只用于一次性 POC 解释差异，不接入 `/session` 产品运行时。

必须完成的 POC：

- POC-4.1：用真实角色卡和外部世界书，在几组用户输入下输出 world hits。
- POC-4.2：用两个真实 preset 输出最终 prompt message list，并记录与 baseline 差异。
- POC-4.3：长上下文预算不足时，验证世界书、记忆、历史消息的裁剪顺序。
- POC-4.4：验证 `WorldModule` 对 sticky、cooldown、delay、recursion、depth、insertion order 的行为，明确有状态字段将写入 `StorySession` 的世界书激活状态。

阶段产物：

- PromptStack assembler POC。
- WorldModule matcher POC。
- prompt/world hit inspector 数据格式。
- ST baseline diff report。

完成定义：

- 指定 fixture 下 `StoryPromptAssembler` 输出、world hits、provenance、与旧 ST-shaped output 的差异报告已提交。
- 对每个差异给出 `bug | intentional | unsupported` 分类。
- 进入 `SAC-Phase 6a` 前，Phase 4 diff 不得存在未关闭的 `bug` 类差异。

### SAC-Phase 5：正则、内容过滤与 UI Render Intent

目标：把正则从运行时黑盒脚本转换为受控 transform 与声明式 UI 渲染能力。

工作内容：

- 建立 regex 分类器：
  - `input_filter`
  - `output_filter`
  - `prompt_transform`
  - `display_transform`
  - `render_intent_extractor`
  - `unsupported`
- 对无法安全转换的规则保留为受限 text transform 或禁用并报告。
- UI 渲染只允许输出 `RenderIntent`，不执行任意 HTML/JS。
- 为常见状态栏、选项、好感度、库存、任务面板设计最小 render schema。
- 扩充 UI regex 语料。现有 `test-baseline-assets` 中 UI 类样本不足以证明覆盖率，必须补充来自真实社区卡或已归档上游素材的 HTML-widget regex。
- 定义 unsupported UI regex 的产品兜底：显式报告语义损失、展示原始规则摘要、允许用户选择禁用或降级为纯文本；不得静默失效。

必须完成的 POC：

- POC-5.1：对扩充后的真实 regex scripts 做分类，输出分类置信度、UI 类占比、可转 RenderIntent 占比和 unsupported 原因；覆盖率目标必须在 POC 记录中明确。
- POC-5.2：选择 2-3 条 UI 类 regex，转换为 `RenderIntent` 并用 React 白名单组件渲染。
- POC-5.3：验证恶意或复杂 regex 不会进入 UI 执行路径。

阶段产物：

- regex 分类器。
- RenderIntent schema。
- 最小 UI 组件白名单。

完成定义：

- `RenderIntent` schema、UI 白名单组件、regex 分类报告、unsupported UX 决策已提交。
- POC-5.1 记录可转比例；若达不到目标，本阶段不得声称 UI regex 已产品化，只能标为受限支持。

### SAC-Phase 6a：最小 StorySession Runtime 硬替换

目标：先让 blueprint agent 以最小运行时取代旧链路，完成 `/session` 可验证硬替换。本阶段只要求 recent transcript、PromptStack、WorldModule、regex/content/render rules 跑通，不引入完整长期记忆系统。

工作内容：

- 设计最小 `StorySession` 状态：
  - recent transcript
  - worldbook activation state
  - render state
- `worldbook activation state` 必须承载 sticky、cooldown、delay 计数器和递归命中状态，避免 WorldModule 退化为静态关键词匹配。
- 每轮生成后更新 recent transcript、世界书激活状态和 UI 状态。
- blueprint session 的生成链路在本阶段接管，不再调用 `STPromptManager`、`PresetNodeTools.convertToSTOpenAIPreset` 和 runtime `placement` 分支。
- 本阶段统一删除或改造旧 regex/render 链、world-book-advanced 实时匹配、SimpleTool 字面 `keysecondary`、`BaseWorldbookEntry.keysecondary`、script-bridge 在 `/session` 的旧接入方式。

必须完成的 POC：

- POC-6a.1：用同一 `SessionBlueprint` 连续推进多轮模拟会话，检查角色身份、recent transcript、world hits、render state 和世界书激活状态是否稳定。
- POC-6a.2：验证 sticky、cooldown、delay 跨轮次计数器在 `StorySession` 中更新，而不是写回 worldbook 静态定义。
- POC-6a.3：验证 blueprint session 生成链路没有 ST-shaped `prompt_order` / runtime `placement` 分支。

阶段产物：

- 最小 StorySession 状态模型。
- 世界书激活状态模型。
- runtime replacement replay fixture。
- story runtime replacement report。

完成定义：

- 最小 runtime replay fixture 通过。
- blueprint session 生成链路中没有 ST-shaped prompt_order/placement runtime 分支。
- 旧 ST-shaped runtime 的剩余调用点已删除或改为只服务导入/测试，不在产品运行时路径中出现。

### SAC-Phase 6b：长期记忆与会话稳定性

目标：在 6a 的最小运行时已经跑通后，再叠加长期记忆、摘要和事实固化能力，避免记忆系统失败阻塞 runtime hard-replace。

工作内容：

- 扩展 `StorySession` 状态：
  - running summary
  - episodic memory
  - facts memory
  - relationship/state memory
- 定义 memory extraction 与 consolidation 策略。
- 明确哪些记忆来自模型抽取，哪些来自结构化规则。
- 每轮生成后更新摘要、事实、事件和关系状态。

必须完成的 POC：

- POC-6b.1：超过上下文窗口后，验证 summary/facts/world hits 能替代丢弃历史。
- POC-6b.2：记忆抽取失败时，运行时必须降级但不破坏会话。
- POC-6b.3：长会话 replay 中角色身份、关键事实和关系状态保持稳定。

阶段产物：

- 长期记忆状态模型。
- 记忆更新 pipeline。
- 长会话 replay fixture。

完成定义：

- 长会话 replay fixture 通过。
- 记忆失败降级路径可测试，且不影响 6a 已完成的最小 runtime。

### SAC-Phase 7：产品化导入向导与用户确认流

目标：把资产编译、质检、修复和确认做成用户可理解的产品流程。

工作内容：

- 设计用户导入向导：
  - 选择角色卡、世界书、预设、正则。
  - 预览资产识别结果。
  - 查看自动修复和风险项。
  - 确认高风险 patch。
  - 生成 `SessionBlueprint`。
- 展示最终配置摘要：
  - 角色设定。
  - 启用世界书数量。
  - prompt stack 摘要。
  - regex/render rule 分类。
  - unsupported artifacts。
- 允许用户保存为 agent，并从 agent 创建会话。
- 完成新 agent route 的导入向导和会话入口。此阶段不得增加 shadow flag、legacy flag 或双轨切换。

必须完成的 POC：

- POC-7.1：无 UI 的 CLI/dev route 导入流程，先验证状态流。
- POC-7.2：最小 UI 导入向导，完成一组真实资产导入。
- POC-7.3：导入后从生成的 agent 创建会话并发送首轮消息。

阶段产物：

- 导入向导。
- 编译报告 UI。
- agent 创建入口。

完成定义：

- 用户可以完成一次真实资产导入、查看修复报告、保存 agent、创建会话、发送首轮消息。
- `/session` 对 blueprint agent 走 story runtime，不再走 ST-shaped runtime。
- 代码中不存在为旧 runtime 保留的 shadow/legacy migration flag。

## 7. 验证策略

每阶段至少包含一类定向测试和一类真实资产验证。验证分两层：

- POC 阶段闸门：定向 `vitest`、schema fixture、snapshot、typecheck 或 dev route 验证，优先证明候选方案可行。
- 实现阶段闸门：阶段实现完成后执行完整 `pnpm verify:stage`。

进入实现阶段后，阶段完成必须执行：

```bash
pnpm verify:stage
```

阶段内 POC 可优先使用定向验证：

```bash
pnpm vitest run <test-file>
```

建议建立三层验证：

- Import-level：资产数量、字段归一化、diagnostics、provenance。
- Compiler-level：`ImportedAssetBundle -> SessionBlueprint` 的 snapshot 和 hash。
- Runtime-level：prompt assembly、world hits、regex transforms、render intents、memory update。

`pnpm verify:stage` 会执行 lint、typecheck、全量 vitest 和 build。它适合阶段交付，不适合替代 POC 的快速可行性验证。完整 gate 后若产生 `.next`、`out`、`public/sw.js`、`public/workbox-*.js` 等生成物，必须清理后再确认工作区状态。

## 8. 风险与处理原则

- LLM 修复过度改写：只允许 typed patch，高风险项必须用户确认。
- 正则导致安全问题：UI 渲染只能走 `RenderIntent` 白名单，不执行任意 HTML/JS。
- 导入适配层污染运行时：运行时禁止读取 ST legacy 字段，测试要覆盖。
- 既有 ST-shaped runtime 未删除：必须用 runtime inventory、离线 diff 和 replacement report 管住，不允许新 runtime 只停留在旁路 demo。
- 世界书误触发：POC 必须记录 hit provenance，后续产品提供 inspector。
- Prompt 编排差异不可解释：所有 prompt message 都要带来源和编译阶段说明。
- UI regex 覆盖率不足：先量化可转比例，再声明支持范围；unsupported 必须对用户可见。
- LLM repair 被 prompt injection 诱导：risk level 必须由 deterministic path map 决定，不能由 LLM 自评。
- Big-bang hard-replace 风险：`SAC-Phase 6a` 是产品运行时替换点，禁止通过双轨 flag 回滚；失败时回滚策略是回到上一 commit 或整批 revert 当前阶段变更，而不是在代码里保留旧 runtime。长期记忆放到 `SAC-Phase 6b`，不得阻塞 6a 的最小 runtime hard-replace。
- 计划膨胀：每阶段先 POC 再实现，POC 不通过不得扩大阶段范围。

## 9. 第一批建议决策点

这些决策不能现在拍板，只能先安排 POC：

- `SessionBlueprint` 的最终命名和 schema 边界。
- hard replace 的具体删除边界：哪些旧模块直接删除、哪些改为导入测试工具、哪些被新 runtime 接管。
- `script-bridge` 在 Story Agent 路线中的去留：删除、收缩为导入/调试工具，还是改造成新 runtime 的受控能力层；必须明确阶段和验收。
- `SessionBlueprint` 的持久化边界：是否新增 blueprint store，既有 `PRESET_FILE`、`WORLD_BOOK_FILE`、`REGEX_SCRIPTS_FILE`、`MEMORY_ENTRIES_FILE`、vector-memory store 是仅作为导入源/旧实现删除对象，还是被新 schema 取代。
- 世界书 position/depth/order 如何映射到新 prompt slot。
- ST regex placement 如何映射到 transform pipeline。
- UI 类 regex 的识别规则和 RenderIntent 最小集合。
- LLM QA 使用哪个模型、是否允许本地模型、如何做成本控制。
- High-risk path map 的字段清单和用户确认交互。
- 长期记忆是先本地 IndexedDB，还是直接引入可替换 memory store 接口。
