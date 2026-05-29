# SAC-Phase 0 Asset Semantics Checklist

> 本文件是 Phase 0 POC 的验收口径：先定义“语义不丢失”具体指什么，再跑资产读取与归一化验证。

## 1. 通用指标

- 每个导入对象必须带 `assetId`、`sourcePath`、`sourceKind`、`sourceHash`、`detectedFormat`、`diagnostics`。
- 每个被转换字段必须能追溯到来源字段路径；无法表达的字段进入 `unsupportedArtifacts`，不得静默丢弃。
- 运行时不保留 SillyTavern 字段判断；ST 字段只允许出现在导入、诊断、POC baseline 对比和 provenance 中。
- 不做历史数据兼容、不做 legacy fallback、不做双轨 runtime。无法转换的资产必须 fail-fast 或显式标记 unsupported。
- POC 通过标准必须引用本文件的具体条目，不能只写“关键语义保留”。

## 2. 角色卡

- 身份字段：`name`、`creator`、`version`、`spec`、`spec_version` 必须保留。
- 人格与设定：`description`、`personality`、`scenario`、`first_mes`、`mes_example` 必须保持原文和字段边界。
- 开场与示例对话必须保留顺序；空值和缺失值要区分。
- `depth_prompt` 等提示词类扩展进入 prompt contract 候选，不得混入普通描述字段。
- 内嵌 `character_book` 必须进入世界书 adapter，不得绕过统一 bundle。
- 内嵌 `regex_scripts` 必须进入 regex adapter，并带来源角色卡 provenance。
- `TavernHelper_scripts`、`tavern_helper`、MVU 相关扩展不得运行；只记录 prompt 约定、变量约定和 unsupported 诊断。

## 3. 预设

- `prompts[]` 必须保留 `identifier`、`name`、`role`、`content`、`system_prompt`、`marker`、启用状态。
- Prompt 顺序必须能从现有 `group_id` / `position` 或 import adapter 产物稳定还原。
- `prompt_order` 只允许作为导入输入或 baseline 证据；不得进入运行时配置。
- 注入位置、深度、角色、启用状态和 marker 必须有字段级 provenance。
- 禁用 prompt 不得丢弃；进入 blueprint 时必须保留为 disabled prompt unit 或 diagnostics 决策。
- 采样参数、模型参数和上下文预算策略必须分离，不得和 prompt 文本混成一个不可验证字符串。

## 4. 世界书

WorldModule 平价验收必须覆盖以下语义：

- 主键匹配：`key`、空 key、大小写、正则 key、多个 key 的 OR 语义。
- `constant`：无关键词也应注入的 entry。
- `selective`、`secondary_keys`、`selectiveLogic`：AND / OR 逻辑必须可表达。
- `sticky`：激活后跨轮次保留的计数器必须进入 `StorySession.worldbookActivationState`。
- `cooldown`：命中后的冷却计数器必须进入 `StorySession.worldbookActivationState`。
- `delay`：延迟激活的轮次计数必须进入 `StorySession.worldbookActivationState`。
- 递归：`recursive` / recursion scan 与 `maxRecursionDepth` 必须有 POC 覆盖。
- `depth`：注入到历史消息深度的语义必须保留或显式 unsupported。
- `insertion_order` / `order`：同一位置多个 entry 的稳定排序必须可复现。
- `position`：before char / after char / depth / special position 必须进入注入 contract。
- 概率：`probability` 必须保留；若新 runtime 首版不执行随机概率，必须标为 intentional unsupported。
- 分组：group、group override、group weight 等互斥或权重语义必须诊断。
- 禁用项：`disable` 与 enabled 状态必须保留，不得直接删除。

## 5. 正则与内容渲染

- Regex script 必须保留 `scriptName`、`findRegex`、`replaceString`、`placement`、`disabled`、`markdownOnly`、`promptOnly`、`runOnEdit`、`substituteRegex`。
- 文本 transform、prompt transform、content filter、UI render candidate 必须分开分类。
- `placement` 只允许在导入分类时读取；新 runtime 不允许按 ST placement 分支执行。
- HTML / CSS / JS 输出不得直接进入渲染路径；只能转换为白名单 `RenderIntent`。
- 无法转换的 UI regex 必须显式报告语义损失，不能静默禁用。
- 正则捕获组与模型输出约定要一起记录；如果上游 MVU / slash script 被移除导致模型不再产出标签，必须在 Phase 4/5 POC 中暴露。

## 6. 脚本与变量约定

- Slash script、TavernHelper、MVU 不进入运行时执行路径。
- 若脚本只是为了让模型按约定输出结构化标签或变量，该约定可以编译进 `PromptStack` 候选。
- 有副作用、控制流、存储读写、网络访问的脚本必须进入 unsupported diagnostics。
- `/session` 的 `script-bridge` 接入在 hard-replace 阶段必须删除或改造，不能留下孤儿入口。

## 7. 诊断分级

- `lossless`: 可完整进入新 contract。
- `normalized`: 可等价转换，但字段名、结构或顺序发生变化。
- `intentional-unsupported`: 新路线明确不支持，产品必须告知用户。
- `bug`: POC 或转换器行为错误，进入下一阶段前必须关闭。
- `needs-decision`: 不是实现问题，而是产品或 runtime contract 未决策。

## 8. Phase 0 完成定义

- 本 checklist 被 `baseline-assets.md`、`runtime-inventory.md` 和所有 POC 记录引用。
- 每类资产至少有一条真实 fixture 被检查。
- 世界书有状态字段必须在 Phase 4/6a 任务中有对应 POC。
- Phase 0 不判断“体验是否足够好”，只判断资产语义是否被明确保留、转换或报告。
