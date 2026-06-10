---
status: accepted
date: 2026-06-10
---

# 富 UI 脚本经导入期功能分析复现为安全 RenderIntent，不执行脚本

## 背景

目标卡（`/Users/xupeng/Desktop/card` 的 Sgw3 / V2.0Beta / 2.png 等）的「富 UI」——好感度面板、状态栏、直播界面、开局选项——经 `scripts/analyze-card-gaps.ts` 分析后发现：**几乎全部是 `<script>` 驱动的完整 HTML 文档**，按 [[0005-ui-only-render-intent-whitelist]] 被正确拒绝（不执行任意 HTML/JS）。

因此「拓宽 RenderIntent 白名单」并不能解锁它们——这些 widget 本质依赖 JS 执行。但用户需要复现这些 UI 的**功能**。

## 决策

新增 **Render Intent Synthesis** 能力（见 `CONTEXT.md`）：在**导入期**分析 script-driven UI widget 的实际功能（它消费什么数据、渲染什么结构），把功能**复现**为安全 RenderIntent，而**不执行源脚本**。

管线：

1. **检测**：regex classifier 已能识别 script-driven UI（标 unsupported、`script tag is not allowed`），保留其 HTML 作为分析输入。
2. **合成**：导入期 LLM（复用 [[0004-llm-repair-typed-patch-deterministic-risk]] / [[0010-variable-convention-registry-with-llm-fallback]] 的 QA pipeline）分析 widget，产出**结构化、声明式的 `RenderIntentSpec`**：kind（白名单内）、title、字段、源 tag、数据模板——描述「渲染什么数据」，不含任何可执行代码。
3. **校验**：确定性安全门——spec 只能用白名单 kind、安全模板（`$1` / `$json.*`），不得含 script / inline handler / DOM 访问 / 任意 HTML。校验由 host 决定，LLM 不能自评（类比 typed patch 的确定性 risk 映射）。
4. **编译**：合格 spec → 现有 `RenderIntent` 类型。
5. **渲染**：运行时 `RenderIntentView` 按模型吐出的结构化数据渲染，全程不执行源脚本。

## 被否决的替代方案

- **执行脚本 / 放宽白名单允许 HTML+JS**：否决——违反 [[0005-ui-only-render-intent-whitelist]] 的安全边界。
- **逐卡人工写 extractor**：否决——不可扩展（「后面有新卡再添加」）。

## 后果

- 安全由**确定性校验**保证：LLM 只产出声明式 spec、绝不产出可执行代码；不合格 spec 落为 Import Diagnostic（[[0007-runtime-owned-story-state]] 风格，不静默）。
- 依赖模型按约定吐出结构化数据；纯表现型脚本（动画/任意自定义 UI）若无可提取的数据契约，仍保持 unsupported + 诊断。
- 复用既有：classifier（检测）、QA adapter（分析）、RenderIntent 类型 + RenderIntentView（渲染）。
