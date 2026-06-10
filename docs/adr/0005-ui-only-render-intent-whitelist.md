---
status: accepted
date: 2026-05-29
---

# UI 仅走 RenderIntent 白名单，unsupported 显式诊断不静默

## 背景与用户意图

用户希望"从正则中提取出 UI 渲染能力"。但真实 UI 类 regex 的本质是：模型按约定吐出自定义标签 → regex 把标签整体替换成一份**任意 HTML + 自定义 CSS 文档**（如夜空多选 widget）。直接执行这些 HTML/JS 是安全风险；而把它静默禁用，又会悄悄毁掉一张卡的核心卖点。

## 决策

- UI 渲染只允许输出 `RenderIntent` 白名单组件（状态栏、选项、好感度、库存、任务面板等的最小声明式 schema），**不执行任意 HTML/JS**。
- 无法安全转换的 regex 降级为受限 text transform，或禁用并报告。
- **unsupported UI 必须对用户显式可见**（报告语义损失、展示原始规则摘要、允许用户禁用或降级为纯文本），不得静默失效。
- 不在没有量化覆盖率前宣称"UI regex 已产品化"；达不到目标只能标为受限支持。

## 后果

- 直接约束架构层重构：任何 Render Intent 相关改造都不得放宽白名单或引入 HTML/JS 执行路径（见架构评审候选 #5 status-pattern 去重——它收敛重复 helper，不触碰白名单，是安全的）。
- unsupported 的可见性由 Import Diagnostic 承担，见 [[0007-runtime-owned-story-state]] 与 unsupported diagnostic 兜底。
