**一旦我所属的文件夹有所变化，请更新我**

# hooks/

React Hook 层。这里放跨页面状态 Hook，以及按子域拆分的 Hook helper。

## 文件清单

| 文件/目录 | 地位 | 功能 |
|------|------|------|
| `useCharacterDialogue.ts` | 对话控制 Hook | 从 dialogue store 读取会话状态，并输出页面可用的操作 Interface |
| `character-dialogue/` | 对话 helper | 消息格式化、开场提取与对话偏好 |
| `script-bridge/` | Script bridge runtime | 显式脚本桥迁移/调试路径 |
| `useRegexScripts/` | Regex Hook | 正则脚本 UI 状态与操作 |

## 最新变更（2026-06-04）

- `useCharacterDialogue.ts` 现在输出 `openingSelection`，让 UI 调用者消费单一开场选择 Interface；原始 `openingMessages/openingIndex/openingLocked` 仍保留给 gallery/host 等非 UI 读取路径。
