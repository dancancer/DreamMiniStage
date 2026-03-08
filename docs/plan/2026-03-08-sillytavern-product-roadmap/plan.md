# SillyTavern 产品对齐总规划（2026-03-08）

> 基线来源：`docs/analysis/sillytavern-integration-gap-2026-03.md`、`docs/analysis/sillytavern-gap-report-latest.md`、当前仓库实现现状审计
> 上游参考：`sillytavern-plugins/SillyTavern`、`sillytavern-plugins/JS-Slash-Runner`、`sillytavern-plugins/MagVarUpdate`

## 1. 项目目标

- 我们项目的目标，是在 DreamMiniStage 中产品化整合并实现 `SillyTavern` 的核心功能，以及 `JS-Slash-Runner`、`MagVarUpdate` 这两个插件的关键能力。
- 我们项目的目标，是在 DreamMiniStage 中产品化整合并实现 `SillyTavern` 的核心功能，以及 `JS-Slash-Runner`、`MagVarUpdate` 这两个插件的关键能力。
- 我们项目的目标，是在 DreamMiniStage 中产品化整合并实现 `SillyTavern` 的核心功能，以及 `JS-Slash-Runner`、`MagVarUpdate` 这两个插件的关键能力。

这不是“把命令名补齐”的项目，也不是“把 bridge 覆盖率刷满”的项目。这个项目真正要达成的状态是：

- 用户能在当前产品 UI 中完成核心配置，而不是依赖隐藏 localStorage 或脚本注入。
- 导入自 SillyTavern 的角色卡、预设、世界书、正则、脚本、变量体系后，语义尽可能保持一致。
- `/session` 的真实运行时行为，与上游核心工作流保持一致或在文档中明确声明差异。
- `JS-Slash-Runner` 与 `MagVarUpdate` 的能力不只存在于 shim/handler/命令层，而是能在当前产品中真实可用、可验证、可维护。

## 2. 规划原则

- 只把 `sillytavern-plugins/*` 作为上游基线和对齐对象，不在主仓规划中修改其实现。
- 优先产品语义闭环，不以“命令覆盖率 100%”替代“用户能力已落地”。
- 单路径实现，禁止增加历史兼容分支和静默 fallback。
- 每个阶段只收敛一个大块，阶段内部做完整 gap 分析、执行计划、验收和回顾。
- 所有阶段都必须有真实验证：真实 UI 流程、真实素材回放、定向测试，三者至少占两类。
- 每个阶段都必须使用独立阶段分支开发；当前阶段未完成、未提交 PR、未合入主干前，不得开启下一阶段实现工作。
- 每个阶段完成后，必须执行统一质检门 `pnpm verify:stage`（lint、typecheck、vitest run、build）；未通过不得进入阶段 review、PR 或下一阶段。

## 3. 分支与 PR 规范

- 每个阶段启动时，必须从最新主干签出一个新的阶段分支，分支名统一使用 `codex/` 前缀。
- 分支命名建议包含阶段编号与主题，例如：`codex/phase-1-model-runtime`、`codex/phase-2-prompt-product-surface`。
- 当前阶段的全部目标、文档、代码、测试、回顾，都必须在同一个阶段分支内完成，不跨分支拆散。
- 当前阶段完成后，必须基于该阶段分支提交一个明确对应阶段目标的 PR；PR 未合入前，不进入下一阶段开发。
- 当前阶段 PR 合入主干后，下一阶段必须重新从最新主干签出新分支，不能继续在上一个阶段分支上累积开发。
- 阶段 review 必须在 PR 提交前完成；review 的结论要反映到当前阶段文档，并作为下一阶段新分支的输入。

## 4. 当前现状

### 4.1 已有基础

- Script Bridge API matrix、slash 命令矩阵、TavernHelper facade 的代码覆盖率已很高，现有审计报告认为命令面和桥接面已经基本收敛。
- 真实链路中，角色卡导入、模型基础配置、会话发送、预设导入、世界书导入、正则导入已经可以跑通。
- `tempchat`、`chat-jump`、`floor-teleport`、`proxy`、`translate`、`yt-script`、`wi-set-timed-effect` 等高价值命令已经接到 `/session` 宿主。
- 宏系统、世界书注入、正则处理、MVU 变量结构、脚本沙箱、工具注册回调等关键基础设施已经存在。

### 4.2 现状与目标之间的核心差距

下面按大块列出差距。这里先列全景，不在本节直接展开执行细节。

#### A. 模型与生成语义差距

- 当前产品真正可配置的仍主要是 `provider/baseUrl/apiKey/model`。
- SillyTavern 常用的生成参数，如上下文窗口、最大输出、timeout、top_p、presence/frequency penalty、top_k、repeat penalty，并未形成真实 UI -> 存储 -> workflow -> LLM 的闭环。
- 预设文件中的 `openai_max_context`、`openai_max_tokens`、`temperature`、`top_p` 等参数没有被完整保留并在运行时生效。
- 现有命令/bridge 覆盖率无法证明这些模型语义已经落地。

#### B. Prompt / Preset / Instruct / Context 体系差距

- 预设的 prompt 部分已可导入和启用，但预设中的“模型行为参数”未被正确继承。
- instruct mode、system prompt、context preset、custom stop strings、model override 等能力已有 slash 面，但当前产品 UI 和运行时宿主并未完整接通。
- 当前产品缺少一套用户可见、可编辑、可验证的 Prompt 行为配置面板。

#### C. 会话与消息编排能力差距

- 单角色会话主链已可用，但群聊、多成员编排、Quick Reply、消息批量操作、更多 ST 风格会话管理能力仍未形成产品级工作流。
- 部分命令已经存在，但 `/session` 当前只接了高价值宿主子集，很多能力仍停留在脚本层可调用、产品层不可用的状态。
- 会话数据模型、分支/滑动回复、消息元数据、JSONL 流程等虽然已有部分实现，但与上游行为尚未系统对齐。

#### D. 世界书 / 正则 / Persona / 导入导出整合差距

- 世界书、正则、Persona 都有实现，但仍需要从“可导入可编辑”提升到“语义和工作流都对齐”。
- 当前产品缺少针对“上游素材迁移后的语义一致性”进行系统验证的矩阵。
- 部分内容仍是功能存在但产品表达不够，用户不容易发现、理解和使用。

#### E. JS-Slash-Runner 产品化差距

- 当前仓库在 shim、handler、slash registry 层面已经覆盖很多 API，但不等于当前产品的真实宿主能力已经全部可用。
- 部分 API 和命令只是“桥接面存在”，缺少当前 UI 的入口、宿主状态源、生命周期管理和用户可见反馈。
- 脚本调试、脚本树、运行时日志、工具注册、事件回调等能力，需要从“开发者可用”提升到“产品级稳定可用”。

#### F. MagVarUpdate 产品化差距

- MVU 的 `stat_data/display_data/delta_data`、schema、insert/update/replace、消息级和会话级变量结构已经存在。
- 但状态栏作者体验、初始化策略、变量可视化、extra model / function-calling 驱动更新、与世界书/正则/占位符的产品工作流还没有完全产品化。
- 目前更接近“底层引擎已存在”，而不是“面向角色卡作者和玩家的完整 MVU 产品”。

#### G. 验证体系差距

- 当前自动审计更擅长证明“名称覆盖率”，不擅长证明“产品语义已闭环”。
- `/test-script-runner` 可以作为内核 smoke 页面，但不能替代真实 `/session` 验收。
- 需要建立“真实 UI + 真实素材 + 定向内核回放”的三层验证体系，并把每阶段成果都绑在这三层体系上。

## 5. 分阶段解决方案

下面每个阶段只聚焦一个大块。阶段内先做 gap 分析，再做执行计划，再定义验收门槛。

### Phase 0：统一标尺与审计基线

#### 本阶段聚焦

- 先把“什么叫实现完成”说清楚，避免继续用 bridge 覆盖率替代产品完成度。

#### Gap 分析

- 当前报告以命令/API 覆盖率为主，难以表达产品层闭环程度。
- 还没有一份统一矩阵，把三类对象同时纳入：
  - `SillyTavern core`
  - `JS-Slash-Runner`
  - `MagVarUpdate`
- 还没有把“已落地 / 部分落地 / 脚本层已落地 / 未落地”作为统一判定标准。

#### 执行计划

- 建立一份正式能力矩阵，按大块维护：模型、prompt、会话、世界书、正则、Persona、Quick Reply、群聊、脚本桥接、MVU、验证体系。
- 每个能力项记录四个维度：UI、宿主、运行时语义、验证状态。
- 把现有 gap report 降级为“名称面报告”，新增“产品语义对齐报告”作为主报告。
- 明确阶段切换规则：如果某阶段的大块仍无统一矩阵，就不能宣布收敛。

#### 阶段产物

- 一份新的能力矩阵文档。
- 一份新的阶段评审模板。
- 一份新的优先级规则文档。

#### 完成定义

- 团队以后讨论“是否已实现”时，必须按统一矩阵判断，而不是只看命令是否存在。

### Phase 1：模型与生成语义闭环

#### 本阶段聚焦

- 先解决当前最核心、最危险的差距：模型参数语义没有闭环。

#### Gap 分析

- 模型设置 UI 只覆盖基础字段，高级参数没有产品入口。
- preset 导入后会丢失或覆盖 `openai_max_context/openai_max_tokens/temperature/top_p/...`。
- workflow / LLM 节点没有稳定接收和使用这些参数。
- 当前用户以为“导入了 ST preset 就等于带进了参数”，实际上并非如此。

#### 执行计划

- 重构模型参数数据模型，形成单一状态源，覆盖：
  - 上下文窗口
  - 最大输出
  - timeout
  - max retries
  - top_p
  - top_k
  - frequency penalty
  - presence penalty
  - repeat penalty
  - streaming / stream usage
- 设计模型高级设置 UI，先在当前产品中落一套最小可用版本，不追求一次做满所有视觉细节。
- 修复 preset 存储模型：保留上游 ST 的关键生成参数，不再在导入和转换时被硬编码覆盖。
- 修复 workflow 参数透传：从 UI / preset / slash 覆盖到 `DialogueWorkflow -> LLMNode -> model invoker` 全链路。
- 增加真实回归：
  - 导入含参数的 preset
  - 修改 UI 参数
  - 发送真实请求
  - 断言请求 payload 与预期一致
- 对外明确规则：模型高级参数的优先级顺序（UI 临时覆盖、会话覆盖、preset 默认、provider 默认）。

#### 阶段产物

- 模型高级设置 UI。
- 新的参数优先级规则。
- 预设参数不再丢失的存储与转换逻辑。
- 真实请求参数断言测试。

#### 完成定义

- 用户可以在当前产品中设置上下文限制和最大输出。
- 导入的 ST preset 参数会被保留并在真实请求中生效。
- 不再存在“UI 显示已设置，但 runtime 没用到”的伪配置。

### Phase 2：Prompt / Preset / Instruct / Context 产品面

#### 本阶段聚焦

- 把 SillyTavern 的 Prompt 行为系统，从“导入 prompt 文本”推进到“行为语义与作者工作流”对齐。

#### Gap 分析

- 预设编辑器更像 prompt 管理器，不是完整 ST 行为配置器。
- instruct、system prompt、context preset、custom stop strings、model override 等缺少产品化入口。
- slash 命令虽覆盖，但当前产品里缺乏稳定的宿主状态源和 UI 反馈。

#### 执行计划

- 为下列能力设计统一的 Prompt 行为设置面：
  - preset 选择与启用
  - instruct mode
  - system prompt / sysprompt
  - context preset
  - custom stop strings
  - prompt post-processing
- 统一这套配置的存储位置和作用域，避免散落 localStorage key。
- 让 slash 命令与 UI 改同一个状态源，不允许出现“双状态源”。
- 为 prompt viewer 增加“本次请求最终生效配置”展示，便于验证和调试。
- 补齐真实验收：在 UI 中改配置、在 slash 中改配置、在 prompt viewer 中确认最终结果一致。

#### 阶段产物

- Prompt 行为控制面板。
- 统一的 prompt/runtime 配置状态源。
- 可视化的最终生效参数视图。

#### 完成定义

- 用户可以不依赖 slash 或 localStorage，直接在产品中完成 Prompt 行为配置。
- UI 改动和 slash 改动对同一状态源生效。

### Phase 3：会话、消息、群聊与 Quick Reply

#### 本阶段聚焦

- 把当前“单角色会话优先”的产品，扩展到更接近 SillyTavern 的聊天编排能力。

#### Gap 分析

- 当前会话主链对单角色较强，但群聊、多成员操作、Quick Reply 仍未成为产品级能力。
- 相关 slash/bridge 多数已存在，但 UI、宿主、状态持久化不完整。
- 会话元数据、分支、swipe、消息编辑、批量操作的上游语义还缺系统回归。

#### 执行计划

- 优先补齐 Quick Reply 的产品面：
  - set/list/get/create/update/delete
  - chat/global 作用域
  - context 绑定
- 设计群聊基础模型和产品入口，最小闭环包括：
  - 成员查看
  - 成员启停
  - 成员顺序调整
  - 成员加入/移除
- 对消息层补齐 ST 高价值体验：
  - swipe 管理
  - 分支跳转
  - 消息编辑/隐藏/截断
  - JSONL 进出一致性
- 让 `/session` 真正成为这些命令的宿主，而不是仅保留脚本级回调口。

#### 阶段产物

- Quick Reply 产品面。
- 群聊基础产品面。
- 会话消息能力回归矩阵。

#### 完成定义

- Quick Reply 与群聊相关高价值能力不再只停留在 bridge/slash 层。
- 相关能力在真实 `/session` 页面可见、可用、可验证。

### Phase 4：世界书、正则、Persona 与迁移体验

#### 本阶段聚焦

- 把“素材可导入”推进到“迁移后的语义和作者体验可接受”。

#### Gap 分析

- 现有导入器已经可用，但不同素材格式的细节语义还没有统一验证。
- Persona、世界书、正则、提示词之间的组合行为，仍缺少“上游迁移基线”的产品化对照。
- 当前产品面对作者的反馈不足，用户不容易知道“导入成功了，但哪些语义被降级了”。

#### 执行计划

- 为角色卡、预设、世界书、正则分别建立“迁移语义检查清单”。
- 导入结果不仅显示成功/失败，还要显示：
  - 保留了哪些字段
  - 忽略了哪些字段
  - 哪些字段被降级处理
- 统一 Persona 注入、世界书注入、正则处理顺序，并用真实素材回放守住。
- 建立“上游素材迁移样例集”，覆盖核心类型和高频边界情况。

#### 阶段产物

- 更清晰的导入结果报告。
- 迁移语义检查矩阵。
- 真实素材回放清单。

#### 完成定义

- 用户导入 SillyTavern 素材后，能明确知道迁移结果，不再只能看到“导入成功”。

### Phase 5：JS-Slash-Runner 宿主完成度

#### 本阶段聚焦

- 把当前已经很强的脚本桥接底座，变成真正稳定的产品宿主能力。

#### Gap 分析

- `JS-Slash-Runner` 相关 API/命令已经大量存在，但许多仍缺当前产品状态源和 UI 反馈。
- 目前强在 bridge，弱在“用户可感知的宿主能力完成度”。
- 脚本调试、工具注册、事件监听、脚本树、消息旋转等能力的产品工作流还不够完整。

#### 执行计划

- 为脚本运行时设计最小但完整的宿主责任边界：
  - 哪些能力是 `/session` 默认支持
  - 哪些能力是显式 fail-fast
  - 哪些能力需要额外宿主注入
- 强化 Script Debugger，补齐：
  - 调用日志
  - 回调日志
  - 工具注册状态
  - 事件监听状态
  - 脚本树状态
- 对高价值宿主能力逐项拉通：Quick Reply、clipboard、context preset、extension state、tool registration、audio、gallery、message mutation。
- 将“命令面 100%”的成果转换成“宿主能力矩阵 100% 可解释”。

#### 阶段产物

- JS-Slash-Runner 宿主能力说明书。
- Script Debugger 增强版。
- 宿主能力矩阵与 fail-fast 矩阵。

#### 完成定义

- 用户可以明确知道哪些 `JS-Slash-Runner` 能力在 DreamMiniStage 中可用、不可用、需要条件可用。

### Phase 6：MagVarUpdate 产品化

#### 本阶段聚焦

- 把 MVU 从“底层引擎存在”提升到“作者能用、用户能看到、语义可验证”。

#### Gap 分析

- 当前 `stat_data/display_data/delta_data`、schema、作用域、更新 API 已在底层存在。
- 但状态栏模板、变量初始化、差分更新策略、可视化调试、extra model/function-calling 路径、作者工具链还不完整。
- 当前更像“把 MVU 的零件拼进来了”，而不是“把 MagVarUpdate 这套方法论产品化了”。

#### 执行计划

- 先定义 DreamMiniStage 中 MVU 的标准工作流：
  - 变量初始化
  - 变量更新
  - 状态栏占位符渲染
  - display/stat/delta 读取
  - 楼层/消息快照回放
- 为作者提供最小工具面：
  - 当前变量查看
  - 指定消息变量查看
  - schema 查看
  - 更新 delta 预览
- 打通 MVU 与真实会话生成的关系：
  - 明确默认更新路径是文本 delta 还是 function-calling
  - 明确 extra model 的定位
  - 明确世界书和正则在 MVU 工作流中的角色
- 建立 MagVarUpdate 样例回放集，覆盖状态栏、数组模板、楼层 replay、JSON patch 风格更新等能力。

#### 阶段产物

- MVU 工作流规范文档。
- 变量调试面板。
- MagVarUpdate 真实样例回放集。

#### 完成定义

- 角色卡作者可以在当前产品中实际使用 MVU，而不是只能依赖底层接口和外部知识。

### Phase 7：验证、回顾、重排优先级

#### 本阶段聚焦

- 把“定期 review 并重新校准方向”做成刚性流程，而不是事后补记。

#### Gap 分析

- 当前规划容易在长尾命令补齐中失去方向。
- 缺少正式的阶段回顾模板和强制优先级重排机制。
- 缺少对“项目目标是否偏航”的周期性判断。

#### 执行计划

- 建立固定 review 节奏：
  - 每完成一个 Phase，必须先执行 `pnpm verify:stage`，再做阶段回顾。
  - 每完成一个 Phase，必须做阶段回顾。
  - 每两周至少做一次方向回顾。
  - 每次回顾都要重新检查“当前最优先大块”是否变化。
- 每次 review 必须回答四个问题：
  - 我们当前前进方向是否仍与项目目标一致？
  - 当前阶段的工作是否真的缩小了产品差距，而不是只缩小了命令差距？
  - 当前阶段暴露了哪些新的问题和结构性风险？
  - 剩余大块中，下一阶段最优先的目标是什么，为什么？
- review 的输出必须落文档，且至少包含：
  - 阶段成果
  - 偏差清单
  - 新发现问题
  - 剩余大块优先级重排
  - 下一阶段目标

#### 阶段产物

- review 模板。
- 阶段回顾记录。
- 更新后的优先级序列。

#### 完成定义

- 规划不再是一次性文档，而是持续被校准、被检视、被纠偏的执行系统。

## 6. 阶段优先级

当前建议的优先级顺序如下：

1. `Phase 1` 模型与生成语义闭环
2. `Phase 2` Prompt / Preset / Instruct / Context 产品面
3. `Phase 3` 会话、消息、群聊与 Quick Reply
4. `Phase 5` JS-Slash-Runner 宿主完成度
5. `Phase 6` MagVarUpdate 产品化
6. `Phase 4` 世界书、正则、Persona 与迁移体验
7. `Phase 7` 验证、回顾、重排优先级（贯穿全程，但在每阶段结束时强制执行）

排序理由：

- `Phase 1` 是当前最核心的语义错误源，不先修会持续制造“看起来支持、实际上不生效”的伪完成。
- `Phase 2` 决定 Prompt 行为是否真正产品化，是从“脚本能力”走向“可用产品”的关键。
- `Phase 3` 决定当前产品是否能承载 ST 风格聊天工作流。
- `Phase 5` 和 `Phase 6` 分别是两个上游插件的产品化主体。
- `Phase 4` 重要，但必须建立在前面几个块已有稳定语义底座之上。

## 7. 每阶段的统一验收方法

每个阶段完成时，必须同时完成以下动作：

- 更新能力矩阵，重新标记 `已落地 / 部分落地 / 脚本层已落地 / 未落地`。
- 运行真实 UI 验收：优先走 `/session`、导入流程、真实素材链路。
- 运行素材回放：至少覆盖与本阶段相关的 `test-baseline-assets`。
- 运行定向单元/集成测试：证明底层语义没有回退。
- 运行统一质检门：执行 `pnpm verify:stage`，记录 lint / typecheck / test / build 结果。
- 更新阶段回顾：确认方向、记录问题、重排剩余优先级。
- 从当前阶段分支提交 PR，等待合入主干；仅在合入后创建下一阶段分支。

## 8. 第一阶段启动建议

下一阶段直接进入 `Phase 1：模型与生成语义闭环`，启动顺序如下：

1. 先梳理当前模型参数状态源与 preset 参数流向，画出实际数据流图。
2. 先修 preset 参数保留与转换逻辑，消除硬编码覆盖。
3. 再修 workflow / LLM 透传，把参数送进真实请求。
4. 最后补模型高级设置 UI，并绑定真实请求断言测试。

这一步做完之后，整个项目才算真正从“桥接完成”进入“产品语义开始闭环”的阶段。
