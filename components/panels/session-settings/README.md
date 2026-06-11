# Session Settings Panel

Story Agent 会话的分层设置面板，内嵌在 `SessionToolsPanel` 中。

- `SessionSettingsPanel.tsx` — 入口卡片。提供「本会话 / 此角色预设」作用域切换，组合采样、模型、提示词三块。
- `SamplingFields.tsx` — 采样参数数字输入（温度 / 输出长度 / 上下文窗口 / Top P），留空表示继承下层。
- `PromptOverrideList.tsx` — 导入预设提示词条目列表，支持开关与内容改写。

叠加优先级（见 `lib/model-capabilities.ts` 的 `resolveStoryModelPolicy` 与 `lib/story-agent/runtime/prompt-context.ts`）：
**会话覆盖 > 导入预设 > 全局默认**。

数据流：面板绑定 `useStorySessionSettings`（`lib/store/story-session-settings.ts`），由 `/session` 页在 mount 时按 `sessionId` 加载。
- 会话级写入 → `StorySessionState.settings`（仅本会话）。
- 预设级写入 → 改写导入 blueprint（该角色所有会话）。
- 模型选择（仅会话级）写入 `settings.modelConfigId`，派发时由 `resolveSessionModelConfig` 解析为实际 APIConfig。
