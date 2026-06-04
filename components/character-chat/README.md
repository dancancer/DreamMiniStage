**一旦我所属的文件夹有所变化，请更新我**

# character-chat/

角色聊天组件。对话界面的核心交互组件。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出聊天组件 |
| `MessageList.tsx` | 主组件 | 消息列表 |
| `MessageItem.tsx` | 子组件 | 消息项 |
| `message-item/` | 子模块 | 消息项类型与纯展示 helper |
| `opening-selection.ts` | 状态 helper | 把 `OpeningSelection` 转换为开场导航 view state |
| `MessageHeaderControls.tsx` | 子组件 | 消息头部控件 |
| `ChatInput.tsx` | 子组件 | 输入框 |
| `ApiSelector.tsx` | 子组件 | API 选择器 |
| `SessionToolbar.tsx` | 子组件 | 会话级工具栏 |

## 最新变更（2026-06-04）

- `MessageList.tsx` 不再中转 `scriptVariables` / `onScriptMessage`，Interface 回到消息列表布局、滚动、开场导航和流式意图。
- `MessageItem.tsx` 不再读取 `TavernHelper_scripts`，助手消息只把故事 HTML、`storyRenderIntents` 和输入追加回调传给 `MessageBubble`。
- `message-item/` 新增类型与展示 helper 子 Module，收口消息项头像、操作按钮和角色 tone 的 Implementation，主 `MessageItem.tsx` 保持在 400 行以内。
- `MessageList.tsx` 现在消费 `OpeningSelection`，并通过 `opening-selection.ts` 生成开场导航状态，不再自己拼装 `openingMessages/openingIndex/openingLocked` 三件套。

## 最新变更（2026-03-06）

- `MessageList.tsx` 现在在过滤隐藏消息/示例消息后仍保留原始消息索引，避免 header slot、slash 跳转与渲染顺序继续使用漂移后的可见索引。
- `MessageItem.tsx` 现在为每条可见消息输出 `data-session-message-id` / `data-session-message-index` 锚点，供 `/session` 页面宿主实现 `/chat-jump` / `/floor-teleport` 的真实滚动定位。

## 最新变更（2026-05-31）

- `MessageList.tsx` 的开场白导航在缺失 `firstMessage` 翻译时稳定显示“开场白”，避免把 i18n key 泄漏到会话界面。

## 最新变更（2026-03-20）

- `SessionToolbar.tsx` 已新增会话级工具栏雏形，并由 `index.ts` 统一导出，供后续把模型 / streaming / fast mode / swipe 这类会话级控制从消息头迁出。
- `MessageList.tsx` 与 `CharacterChatPanel.tsx` 已补上 `min-h-0` 收口，确保聊天主轴继续把剩余高度优先让给消息列表，而不是被底部工具吞掉。

## 最新变更（2026-04-03）

- `ControlPanel.tsx` 已从聊天主界面退役，低频会话工具迁移到右侧的 `SessionToolsPanel`，避免把管理性操作继续堆在输入区旁边。
- `ChatInput.tsx` 已回归单一职责：只负责建议输入、文本输入与发送，不再承载 tool rail / floating tool 这类过渡性布局逻辑。
