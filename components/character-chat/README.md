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

## 最新变更（2026-03-06）

- `MessageList.tsx` 现在在过滤隐藏消息/示例消息后仍保留原始消息索引，避免 header slot、slash 跳转与渲染顺序继续使用漂移后的可见索引。
- `MessageItem.tsx` 现在为每条可见消息输出 `data-session-message-id` / `data-session-message-index` 锚点，供 `/session` 页面宿主实现 `/chat-jump` / `/floor-teleport` 的真实滚动定位。
