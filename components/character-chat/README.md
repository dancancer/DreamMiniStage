**一旦我所属的文件夹有所变化，请更新我**

# character-chat/

角色聊天组件。对话界面的核心交互组件。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出聊天组件 |
| `MessageList.tsx` | 主组件 | 消息列表 |
| `MessageItem.tsx` | 子组件 | 消息项 |
| `MessageHeaderControls.tsx` | 子组件 | 消息头部控件 |
| `ChatInput.tsx` | 子组件 | 输入框 |
| `ControlPanel.tsx` | 子组件 | 控制面板 |
| `ApiSelector.tsx` | 子组件 | API 选择器 |
| `SessionToolbar.tsx` | 子组件 | 会话级工具栏 |
| `SessionToolbar.tsx` | 新组件 | 显示当前模型、Streaming/快速开关与滑动提示的工具栏，并以 `apiSelector` 与 `modeControls` 插槽承接控制元素。 |

## 最新变更（2026-03-06）

- `MessageList.tsx` 现在在过滤隐藏消息/示例消息后仍保留原始消息索引，避免 header slot、slash 跳转与渲染顺序继续使用漂移后的可见索引。
- `MessageItem.tsx` 现在为每条可见消息输出 `data-session-message-id` / `data-session-message-index` 锚点，供 `/session` 页面宿主实现 `/chat-jump` / `/floor-teleport` 的真实滚动定位。

## 最新变更（2026-03-20）

- `SessionToolbar.tsx` 已新增会话级工具栏雏形，并由 `index.ts` 统一导出，供后续把模型 / streaming / fast mode / swipe 这类会话级控制从消息头迁出。
- `ChatInput.tsx` 现在会把页脚工具收口为受限高度、可横向滚动的 tool rail，避免群聊 / checkpoint / MVU 调试面板把输入区无限撑高，挤压消息滚动区。
- `MessageList.tsx` 与 `CharacterChatPanel.tsx` 已补上 `min-h-0` 收口，确保聊天主轴继续把剩余高度优先让给消息列表，而不是被底部工具吞掉。
