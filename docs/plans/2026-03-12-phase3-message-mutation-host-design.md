# Phase 3 Message Mutation Host Design

## 背景

Phase 3 里 `swipe / branch / checkpoint / Quick Reply / group chat` 已经接进 `/session` 真实宿主，但 `message mutation` 还留着一条断层：

- `hooks/script-bridge/message-handlers.ts` 已定义 `DreamMiniStage:setChatMessages`
- `hooks/script-bridge/message-handlers.ts` 已定义 `DreamMiniStage:createChatMessages`
- `hooks/script-bridge/message-handlers.ts` 已定义 `DreamMiniStage:deleteChatMessages`
- `hooks/script-bridge/message-handlers.ts` 已定义 `DreamMiniStage:refreshOneMessage`

现在桥接层会发事件，但 `/session` 页面没有把这些事件落到真实对话状态。结果就是：

- 脚本层“看起来支持”消息编辑/创建/删除
- 页面运行时却没有对应宿主语义

这和路线图里“相关宿主能力必须接入真实 `/session` 页面”的要求不一致。

## 目标

把 `message mutation` 从“桥接事件协议存在”推进到“`/session` 真实宿主可用”：

- 更新现有消息
- 追加新消息
- 删除指定消息
- 响应单条消息刷新请求

`rotateChatMessages` 不单独做第二套路径，因为它已经被桥接层翻译成 `setChatMessages`。

## 方案

### 1. 页面级单宿主

在 `app/session/page.tsx` 内注册事件监听：

- `DreamMiniStage:setChatMessages`
- `DreamMiniStage:createChatMessages`
- `DreamMiniStage:deleteChatMessages`
- `DreamMiniStage:refreshOneMessage`

这些监听器只在当前 `/session` 页面消费事件，并直接调用 `dialogue` 的真实状态操作。

### 2. 数据规则

消息定位只走单一路径：

- 优先按 `message_id` 命中 `dialogue.messages[].id`
- 命不中就显式 fail-fast

字段更新只支持当前产品已有语义：

- `message -> content`
- `name`
- `role`
- `extra` / `data` 暂时挂接到消息对象扩展字段，保持页面内可读

不做历史兼容分支，也不猜测别的字段别名。

### 3. 创建与删除

`createChatMessages` 直接转成真实消息追加：

- `role`
- `content`
- `id`

`deleteChatMessages` 按消息 id 删除当前页面消息数组中的对应项。

### 4. refresh 语义

`refreshOneMessage` 先做最小真实宿主：

- 解析并验证消息 id/index
- 命中页面真实消息
- 调用现有可用的刷新路径；若当前页面尚无更细粒度刷新能力，就至少保证不会静默丢弃事件，并为后续 JSONL/message replay 对齐保留单路径入口

## 验证

- 页面集成测试先证明当前缺口：事件发出后消息未变化。
- 最小实现后证明：
  - `setChatMessages` 会改页面消息
  - `createChatMessages` 会追加页面消息
  - `deleteChatMessages` 会删除页面消息
  - `refreshOneMessage` 至少命中真实消息定位与宿主回调

## 非目标

- 本轮不扩展 JSONL 导入导出语义。
- 本轮不补新的 slash 命令别名。
- 本轮不重做消息模型，只做 `/session` 宿主接线。
