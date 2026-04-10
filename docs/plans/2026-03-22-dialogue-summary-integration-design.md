# 对话持久化摘要集成设计

**目标**
- 为长对话引入持久化摘要注入，减少上下文超限时对原始历史的直接裁剪。
- 优先复用每轮现成的 `parsedContent.compressedContent`；没有时再回退到轻量级的结构化摘要。

**问题本质**
- 当前主链路只有 `applyContextWindowToMessages()` 的 token 预算裁剪，没有稳定的历史压缩层。
- 一旦会话变长，较早历史会被直接丢弃，角色一致性和剧情连续性会变差。
- 仓库里已有摘要扩展与每轮 `compressedContent`，但尚未接入主对话请求链路。

**方案**
- 新增 `dialogue-summary` 运行时模块：
  - 从当前分支的对话树路径中提取旧消息。
  - 超过阈值后，将“最近窗口”之外的消息折叠为一条 `[Story Summary]` 系统消息。
  - 单轮若已有 `compressedContent`，直接作为该轮摘要使用。
  - 若没有，则回退为“用户输入 + 助手回应”的结构化短摘要，不额外发起 LLM 请求。
- 每次请求构建前都基于当前分支重算摘要，并持久化到 `localStorage`，避免分支切换后摘要串线。
- 每次回复落库后同步刷新摘要缓存，让下一轮直接复用。

**边界**
- 仅对 `dialogueKey` 维度的普通聊天生效。
- 摘要生成失败时不阻塞主对话，直接回退到现有裁剪链路。
- 最近窗口仍保留原文；摘要只覆盖更早的历史。

**持久化**
- 使用 `localStorage`，key 绑定 `dialogueKey`。
- 存储内容包含：摘要正文、覆盖的节点 ID、消息计数、当前分支节点 ID、更新时间与摘要来源。
- 请求前重算并校验，因此不会把旧分支摘要错误注入到新分支。

**测试**
- 纯函数测试：
  - 超过阈值时生成摘要。
  - 优先使用 `compressedContent`。
  - 无 `compressedContent` 时回退到结构化摘要。
  - 切换分支时摘要内容随当前路径变化。
- 集成测试：
  - `PresetNodeTools.buildPromptFramework()` 会注入 `[Story Summary]`。
  - `processPostResponseAsync()` 会刷新摘要缓存。
