**一旦我所属的文件夹有所变化，请更新我**

# character-chat/message-item/

单条消息渲染的低层子 Module。这里收口类型与纯展示 helper，避免 `MessageItem.tsx` 同时承担消息分派和头像/按钮/tone 细节。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `types.ts` | 类型 Interface | 定义 `Message`、`MessageCharacter`、`MessageRoleKind` |
| `presentation.tsx` | 展示 helper | 渲染消息头，提供 role 归一化、tone 选择和角色标签裁剪 |

## 最新变更（2026-06-04）

- 从 `MessageItem.tsx` 拆出展示 Implementation，使主消息项 Module 保持更高 Locality：消息分派留在主文件，头像/按钮/tone 细节留在本目录。
- `MessageCharacter` 只暴露 `storyRenderIntents`，不承载 `TavernHelper_scripts` 脚本字段。
