**一旦我所属的文件夹有所变化，请更新我**

# components/

顶层 UI 组合层。这里放跨页面复用的组件，以及尚未下沉到 feature 子目录的页面级组合组件。

## Module 分工

| 路径 | 地位 | 功能 |
|------|------|------|
| `CharacterChatPanel.tsx` | 页面级组合 Module | 编排 `/session` 的消息列表、输入框、用户名弹窗与调试面板入口 |
| `ImportWorldBookModal.tsx` | 页面级组合 Module | World Book JSON / 全局 World Book 导入弹窗 |
| `MessageBubble.tsx` | 消息内容 Module | 渲染故事消息 HTML 与 `RenderIntentView`，不执行脚本 |
| `ScriptSandbox.tsx` | 迁移/调试 Adapter | 保留 iframe 沙箱能力，供显式迁移或调试场景使用 |
| `WorldBookEditor.tsx` | 页面级组合 Module | World Book 条目列表、筛选、编辑、导入入口 |
| `character-chat/` | 会话消息子域 | 承载消息列表、消息项、输入区与消息头控制 |
| `ui/` | UI primitives | Radix/Shadcn 基础组件 |

## 最新变更（2026-06-04）

- `CharacterChatPanel.tsx` 不再接线 `useScriptBridge`，也不再把最新消息广播给脚本 runtime；`/session` Story runtime 的脚本执行 Seam 已从故事消息链路移除。
- `MessageBubble.tsx` 不再组合 `ScriptSandbox`，parser 产出的 `sandbox` segment 在故事消息里会被忽略，只保留 HTML 与 RenderIntent 渲染。
- `ScriptSandbox.tsx` 继续作为显式迁移/调试 Adapter 存在，不再由普通故事消息自动触发。
- `CharacterChatPanel.tsx` 现在以 `OpeningSelection` 透传开场选择状态，避免 UI 装配层继续拆传 `openingMessages/openingIndex/openingLocked`。
- `CharacterChatPanel.tsx` 不再接收 Session host capability callback 组；聊天面板只保留真实使用的 `onSwipe` 与 `hostDebug` 快照。
- `WorldBookEditor.tsx` 现在通过 `world-book-keys.ts` 生成 `character:` / `dialogue:` record key；`ImportWorldBookModal.tsx` 接收明确的 `worldBookKey`，不再把 record key 伪装成 character id。
