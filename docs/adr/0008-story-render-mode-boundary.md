---
status: accepted
date: 2026-06-01
---

# Story Agent 渲染走 story render mode，与 legacy RegexProcessor 有运行时边界

## 背景

普通角色消息走 legacy 的异步 `RegexProcessor` + HTML 渲染链（保留既有 regex/html 行为）。Story Agent 的输出应走结构化 `RenderIntent`。若两者共用同一渲染链，Story Agent 输出会被重新挂上 legacy 脚本执行路径，违背 [[0005-ui-only-render-intent-whitelist]]。

## 决策

- `MessageBubble` 设显式 `renderMode`。Story Agent 消息（`character.extensions.storyBlueprintId`）由 `MessageItem` 进入 `story` render mode，只走本地 narrative parser 和 `RenderIntentView`，**不调用 legacy async `RegexProcessor`**。
- 普通角色消息继续走 legacy render mode，保留既有 regex/html 边界。
- 新增 Story Agent 展示入口必须显式传入 `story` render mode；为该 renderer 边界保留回归测试，防止后续 UI 复用时回流到 legacy processor。
- unsupported HTML/script assets 留在 Import Diagnostics，不进入 runtime 执行。

## 后果

- 约束架构评审候选 #5：Render Intent 相关重构必须保持该运行时边界。
- 待完成项 `Story Agent renderer isolation 回归测试` 正是为守护本边界。
