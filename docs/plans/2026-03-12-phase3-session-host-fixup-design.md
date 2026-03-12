# Phase 3 Session Host Fix-up Design

## 背景

Phase 3 已经把 Quick Reply、群聊成员、checkpoint/branch 接进 `/session`，但当前工作区还留着三类收口问题：

- Quick Reply 的 `inject` 集合仍可能走普通发言路径，而不是 prompt injection。
- 同一个 Quick Reply 集合若同时在 `global/chat` 激活，会在产品面重复展示。
- 群成员查找把“显示名称”和“内部 id”混成一个匹配入口，名称撞到别人的自动 id 时会删错人。

这些都不是新功能，而是把已有宿主能力从“基本可用”收紧到“语义单一、边界明确、真实页面可信”。

## 方案

### 1. Quick Reply 执行优先级

`nosend -> inject -> slash/plain message` 必须是单一路径：

- `nosend` 只回填输入框。
- `inject` 只写入 prompt injection store，不落消息。
- 其余内容再按 slash 或普通文本发送。

这样可以消掉“同一条回复既像注入又像发言”的分叉。

### 2. Quick Reply 可见集合解析

可见集合改成单点解析：

- `global` 先铺底。
- `chat` 同名集合覆盖 `global`。
- 面板与 slash 执行都复用同一解析结果。

这样 UI 与运行时看到的是同一批按钮，不会出现重复项。

### 3. 群成员引用规则

成员查找改成显式优先级：

- 用户输入先按 `name` 命中。
- 仅当没有同名成员时，才按内部 `id` 兜底。

这样“用户可见名称”始终比内部自动 id 更高优先级，避免误删和误操作。

## 验证

- store 单测覆盖集合去重和成员名称/id 冲突。
- 组件测试覆盖按钮去重和移除目标准确性。
- `/session` 集成测试覆盖 Quick Reply inject 不写聊天消息、而是写入 prompt injection store。

## 非目标

- 本轮不扩展新的 Phase 3 宿主能力。
- 本轮不处理 message mutation / JSONL 的下一批对齐项。
