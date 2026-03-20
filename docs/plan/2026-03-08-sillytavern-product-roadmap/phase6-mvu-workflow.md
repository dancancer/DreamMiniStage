# Phase 6 MVU 标准工作流（2026-03-17）

> 配套能力矩阵说明书：`docs/plan/2026-03-08-sillytavern-product-roadmap/phase6-mvu-capability-matrix.md`

## 目标

- 把 DreamMiniStage 里的 MVU 从“底层 API 存在”收敛成“作者能按固定路径使用、玩家能在 `/session` 里看到、开发者能复盘”的单一路径。
- 明确默认路径，消灭“文本 delta / function-calling / extra model 到底谁是主路径”的语义漂移。

## 标准工作流

### 1. 初始化

- 默认初始化入口是 `function/dialogue/chat.ts` 中的新会话开场。
- `initMvuVariablesFromWorldBooks()` 会并行读取角色世界书与全局世界书，提取 `[InitVar]` 与开场白里的 `<initvar>`，然后把初始变量写入开场白节点。
- 初始变量的事实源是 `parsedContent.variables.stat_data`；`display_data` 与 `delta_data` 只是面向查看和调试的派生层，不是主数据源。

### 2. 真实生成链路

- 默认更新路径是“助手最终文本 -> MVU 命令提取 -> 节点变量快照落盘”。
- 真实入口在 `function/dialogue/chat-shared.ts` 的 `processPostResponseAsync()`：
  - 先把模型输出写回对话树节点；
  - 再调用 `processMessageVariables({ dialogueKey, nodeId, messageContent })`；
  - 更新结果保存到该消息节点的 `parsedContent.variables`。
- 当前默认路径不是 function-calling，也不是 extra model。`lib/mvu/function-call.ts` 与 `lib/mvu/extra-model.ts` 保留为显式扩展路径，后续若启用，必须以独立配置接入，不能静默抢主路径。

### 3. 三层数据语义

- `stat_data`：实际状态，后续读写与回放都以它为准。
- `display_data`：给作者看的变化说明，适合状态栏或调试面板直接观察。
- `delta_data`：最近一次消息更新产生的差分预览，用于快速判断“这条消息到底改了什么”。
- `UpdateVariable` 协议块：只允许存在于 `fullResponse` 这种内部闭环路径里，不应直接进入用户可见的 `screenContent` 或流式 token 展示。
- 同样地，向量记忆与其他面向检索的副产物也不应吞下协议块；它们应消费剥离协议后的可见文本。
- 当同一条回复同时包含 MVU 更新与 `event` 压缩信息时，后续写入 `compressedContent` 不能覆盖掉已经落下去的 `parsedContent.variables`。
- 当作者显式选择 `function-calling` 或 `extra-model` 这类扩展路径时，即使本次没有产出变量更新，也应留下节点级 `mvuTrace`，否则调试面无法区分“未命中”与“根本没走这条路径”。

### 4. 快照与回放

- 每条成功产生 MVU 更新的消息，都会把变量快照落在对应节点上。
- `getCharacterVariables()` 负责读取当前会话最新可用状态。
- `getNodeVariables()` 负责读取指定消息节点快照。
- `replayFloors()` 负责从某个快照楼层重新回放后续更新，验证幂等性与楼层重演语义。
- `applyPatch()` / `patchToMvuCommands()` 负责把 JSON Patch 风格更新纳入同一套复盘工具链。

### 5. 世界书、正则、渲染的角色分工

- 世界书负责两类事：
  - `[InitVar]` 初始化变量；
  - `[mvu_update]` / `[mvu_plot]` 一类规则文本参与 MVU 语义分流。
- 正则与渲染层不再充当变量真相来源；它们只能消费 `stat_data/display_data/delta_data`，不能偷偷写回状态。
- 这让 MVU 的真实状态只保留一条主线：会话节点快照。

## 当前产品面

- `/session` 页脚新增 `MVU Debugger`，直接挂在真实聊天页面，而不是留在独立 smoke 页面。
- 面板最小闭环包含：
  - 当前变量查看；
  - 指定消息快照切换；
  - 策略矩阵；
  - 显式策略选择；
  - 路径观测；
  - 状态栏预览；
  - 状态栏模板占位符渲染；
  - Schema 查看；
  - 当前 delta 与消息 delta 预览。

## 真实样例回放集

- 第一批 committed 样例位于 `lib/mvu/__tests__/fixtures/phase6/status-bar-workflow.json`。
- 第二批 committed 状态栏作者样例位于 `lib/mvu/__tests__/fixtures/phase6/status-bar-authoring-workflow.json`。
- 第三批 committed extra-model 样例位于 `lib/mvu/__tests__/fixtures/phase6/extra-model-material-workflow.json`。
- 当前样例覆盖：
  - 状态栏字段更新；
  - 状态栏作者表达；
  - extra-model 二次变量解析；
  - 楼层 replay；
  - 数组模板；
  - JSON Patch 风格更新。
- 回放与作者语义基线测试位于：
  - `lib/mvu/__tests__/phase6-replay-baseline.test.ts`
  - `lib/mvu/__tests__/phase6-status-bar-authoring.test.ts`
  - `lib/mvu/__tests__/phase6-strategy-material.test.ts`
  - `lib/mvu/__tests__/phase6-extra-model-material.test.ts`

## 当前结论

- Phase 6 的默认工作流已经明确为“世界书/开场白初始化 + 助手文本 delta 更新 + 节点快照持久化 + `/session` 面板可视化 + 回放测试”。
- Phase 6 的策略矩阵现在也已显式收口：`text-delta` 是默认路径，`function-calling` 与 `extra-model` 只作为条件扩展路径展示。
- 当前产品已经支持显式选择策略，并把 `function-calling` 选择透传为运行时的 `mvuToolEnabled`，但仍不会改变默认策略。
- `function-calling` 当前新增了一条协议卫生约束：tool call 转出的 `<UpdateVariable>` 会保留在 `fullResponse` 供 MVU 落盘，但不会继续污染可见回复或流式 token。
- `extra-model` 现在也已经有一条最小真实路径：当策略显式切到 `extra-model`，且回复本身没有现成的 `<UpdateVariable>` 协议块时，会复用当前激活模型做二次变量解析，并把更新结果直接写回节点变量快照。
- 后续若要继续扩展 Phase 6，优先级应放在更多上游样例、作者模板与状态栏表达，而不是再引入第二条默认更新路径。
