**一旦我所属的文件夹有所变化，请更新我**

# character-dialogue/

角色对话钩子。对话相关的 React 状态与工具函数。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `message-utils.ts` | 工具函数 | 消息处理工具 |
| `useDialoguePreferences.ts` | Hook | 对话偏好设置 |

## 最新变更（2026-03-08）

- `useDialoguePreferences.ts` 改为从 `model-store` 读取当前激活模型配置与高级参数，避免 runtime 再从分散 localStorage key 组装配置。
