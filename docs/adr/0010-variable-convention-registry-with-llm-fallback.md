---
status: accepted
date: 2026-06-10
---

# 初始变量提取：确定性 Variable Convention 注册表 + 导入期 LLM 推断兜底

## 背景与用户意图

主干第一个能力目标是 MVU / 状态能力广度。用户明确不要"逐卡定制提取"：

> "我更希望这里能变成一个通用能力，后面有新的角色卡可以自动适配，不用再次提取。"

代码现状已是按约定（而非按卡）提取的雏形：`collectInitSources` 识别一组 [[Variable Convention]]（`[InitVar]`、`<status_current_variables>`、`<StoryState>`、MVU `initial`、TavernHelper variables），`bundle-builder` 按 key pattern 归类成 `variable-convention` artifact。问题只剩：**新卡的声明不匹配任何已知约定时怎么办**。

## 决策

初始 Story State 提取以 [[Variable Convention]]（见 `CONTEXT.md`）为单位，分三层：

1. **确定性注册表**：识别已知约定。识别一种约定即覆盖**所有遵循该约定的角色卡**（按约定、不逐卡），零 LLM、零方差。拓宽能力 = 新增一个约定识别器（一次性，覆盖未来同约定卡）。
2. **导入期 LLM 推断兜底**：当声明不匹配任何已知约定时，由导入期 QA LLM 推断隐含的变量模型，走 [[0004-llm-repair-typed-patch-deterministic-risk]] 的 typed / validated / 用户可确认路径。**仅编译期、不进运行时**（INV-6 安全）。
3. **仍无法处理 → Import Diagnostic**（INV-7），不静默丢。

MVU replay mutation（`update`/`insert`/`expect` 序列）采 **A1**：发专门诊断码 `extension.mvu_replay_mutation_unsupported`，**不执行**。"A2 导入期折叠成静态初始态"因会改变叙事起点且处 INV-6 灰区，**deferred 待单独 ADR**。

## 被否决的替代方案

- **纯确定性注册表**：新格式卡无法"自动适配"，需人工加识别器才覆盖——不满足"新卡自动适配"。
- **LLM 推断为主**：状态 seed 的确定性最差，受 LLM 变化影响最大。
- **运行时执行 replay（A3）**：直接违反 INV-6 与 [[0007-runtime-owned-story-state]]，出局。

## 后果

- 不引入运行时第三方脚本执行；LLM 仅在编译期、经 typed patch + 确定性风险映射（[[0004-llm-repair-typed-patch-deterministic-risk]]）。
- 架构候选 #6（Story State / MVU 共享解析器）仍 `hold`：本决策不要求统一两套引擎，只在导入期识别约定。
- 若将来要做 A2 折叠，需新 ADR 拍板"replay 最终态是否作为叙事起点"。
