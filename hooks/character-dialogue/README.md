**一旦我所属的文件夹有所变化，请更新我**

# character-dialogue/

角色对话钩子。对话相关的 React 状态与工具函数。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `message-utils.ts` | 工具函数 | 消息处理工具 |
| `model-profile.ts` | 生成 Profile | 将 LLM 配置、语言、输出长度和快模型模式收束为单一生成 Interface |
| `useDialoguePreferences.ts` | Hook | 对话偏好设置 |

## 最新变更（2026-06-04）

- 新增 `model-profile.ts`，用 `DialogueModelProfile` 收口生成模型参数；`useCharacterDialogue.ts` 不再在初始化、发送、重生成和触发生成路径重复拆装模型字段。

## 之前变更（2026-05-30）

- `useDialoguePreferences.ts` 不再用聊天页全局 `streamingEnabled` 覆盖激活模型配置，流式开关改回以当前模型配置为唯一事实源。
- 默认响应长度提升到 8192，并改用 `storyResponseLength` 存储键；story runtime 以该值作为每轮输出上限，避免旧的 4096 本地值继续截断叙事回复。

## 之前变更（2026-03-08）

- `useDialoguePreferences.ts` 改为从 `model-store` 读取当前激活模型配置与高级参数，避免 runtime 再从分散 localStorage key 组装配置。
