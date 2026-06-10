---
status: accepted
date: 2026-05-29
---

# Story State / status 变量由 runtime 拥有；首轮只编译静态初始变量

## 背景

MVU / TavernHelper / slash-script 用 prompt 约定让模型产出结构化标签与变量（好感度、库存、状态栏数据）。本路线首轮**不执行第三方脚本**，但又不能砍掉"模型按约定产出标签/变量"的能力——否则 RenderIntent 层会拿不到要渲染的数据，语义闭环在变量层就断了。

## 决策

- `status_current_variables` / Story State 由 DreamMiniStage runtime **拥有并注入**，不回退到上游宏、TavernHelper 或 MVU 脚本执行。world context 不再重复携带旧宏状态源（如 `{{get_message_variable::stat_data}}`），避免双状态源漂移。
- 首轮只把**静态初始变量**编译进 `StoryInitialState`，来源包括 `[InitVar]`、`<status_current_variables>` / `<StoryState>` JSON snapshot、MVU replay-style `initial` object、TavernHelper `variables` object。
- 带 `update` / `insert` 等 **replay mutation 的语义首轮不执行**，保留为 unsupported Import Diagnostic，不静默吞掉。
- 影响模型输出格式的 prompt 约定（让模型吐结构化标签/变量）要编译进 `PromptStack`，不能无声丢失。

## 后果

- 约束架构评审候选 #6（Story State / MVU 共享解析器）：可抽共享的命令/括号解析，但**不得借此回流 MVU 脚本执行**或让上游宏重新拥有状态。
- 待完成项 `MVU update/insert replay mutation 长期语义` 正是本决策留下的显式 deferred 边界。
