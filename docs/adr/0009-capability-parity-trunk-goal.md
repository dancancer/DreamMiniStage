---
status: accepted
date: 2026-06-10
---

# 主干目标：对真实 SillyTavern + 插件做能力对齐（gap-driven）；分支能力非主干、后置

## 背景与用户意图

Story Agent 资产编译路线已跑通后，需要为下一阶段定主线。用户原话：

> "主线能力对齐真实酒馆 + 常用插件（比如 MVU 等），同时也要进行技术债/架构债的清理；regenerate/swipe/branch-switch 只是真实酒馆能力的其中一部分，但不属于主干能力，可以先聚焦主干，然后再逐渐收拢这些分支能力。"

"对齐真实酒馆"字面上与 [[0001-sillytavern-as-import-source]]（仅作导入源、不逐项复刻）冲突，必须钉死"对齐"的精确含义。

## 决策

- 下一阶段**主干 = 对真实 SillyTavern + 常用插件（尤其 MVU）做能力 / 语义对齐**：以"用同一套资源在真实 ST + 插件跑出的玩家体验"为对照基准，要求等价复现那些**能力**（变量状态推进、世界激活、UI 渲染、记忆连续性），由 **gap audit 驱动**。
- 但实现仍走"编译成 SessionBlueprint 的自有架构"，**不复刻 ST 的运行时 / 格式 / 逐项菜单**——[[0001-sillytavern-as-import-source]] 与 [[0002-no-external-asset-format-checks-at-runtime]] 不变。
- 技术债 / 架构债清理与能力对齐**并行**推进。
- regenerate / swipe / branch-switch 等**分支能力非主干**，主干收口后再逐步收拢（设计已存档，见 `docs/plan/2026-06-10-story-agent-next-steps/`）。

## 被否决的替代方案

- **运行时 / 格式对齐**（真的逐项复刻 ST 行为）：否决——会推翻 [[0001-sillytavern-as-import-source]]。
- **分支能力优先**：否决——swipe/分支不在第一性原理的核心需求里，属非主干。

## 后果

- 主干 backlog 由 gap audit（`docs/analysis/*gap*`、parity-lab、`2026-05-31-sillytavern-plugin-e2e-gap-audit.md`）驱动，对照基准是真实 ST + MVU。
- branch capabilities 的实现设计（per-node StorySessionSnapshot）已存档待后置。
