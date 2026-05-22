# 08. Right Panels

> 入口：全局布局右侧抽屉
> 主组件：`components/layout/RightPanel.tsx`

## 1. 用户目标

右侧面板承载低频但关键的控制面，避免聊天主舞台被管理工具挤满。

## 2. PanelId 清单

| PanelId | 标题 | 当前组件 | 业务职责 |
|---------|------|----------|----------|
| `characters` | 角色卡 | `CharactersPanel` | 跳转角色卡列表/首页会话 |
| `worldbook` | 世界书 | `WorldbookPanel` | 当前会话世界书、全局世界书库 |
| `regex` | 正则脚本 | `RegexPanel` | 全局规则工作区 |
| `presets` | 预设 | `PresetsPanel` | 全局预设工作区 |
| `sessionTools` | 会话工具 | `SessionToolsPanel` | 低频会话工具 |
| `modelSettings` | 模型设置 | `ModelSettingsPanel` | 多模型配置 |
| `plugins` | 插件管理 | `PluginsPanel` | 插件列表、启用、刷新 |
| `tagColors` | 标签颜色 | `TagColorsPanel` | 标签色彩配置 |
| `advancedSettings` | 高级设置 | `AdvancedSettingsPanel` | 高级偏好 |
| `data` | 数据管理 | `DataPanel` | 导入导出与 Google Drive |
| `settingsHub` | 设置菜单 | `SettingsHubPanel` | 设置入口与向量检索开关 |

## 3. SessionToolsPanel

| 区块 | 能力 |
|------|------|
| 叙事模式 | 剧情推进、视角设计、场景过渡 |
| Checkpoint / Branch | 触发分支树弹窗 |
| 会话辅助 | 用户名、Script Debug、JSONL 导入导出 |
| 提示词查看 | 打开 Prompt Viewer |
| Quick Reply | 管理/执行快捷回复 |
| Group Member | 群聊成员管理 |
| CheckpointPanel | checkpoint 列表与操作 |

低频动作通过 `session-ui-events.ts` 分发到主聊天面板，避免 `CharacterChatPanel` 重新变成巨石。

## 4. SettingsHubPanel

- 模型设置。
- 插件管理。
- 标签颜色。
- 数据管理。
- 向量检索开关：读取/写入 `lib/vector-memory/manager`。

## 5. DataPanel

- 本地 JSON 导出。
- 本地 JSON 导入后 reload。
- Google Drive OAuth token 读取。
- 导出到 Google Drive。
- 从 Google Drive 导入。

## 6. PluginsPanel

- 读取 `window.pluginRegistry`。
- 支持 filter：all/enabled/disabled。
- 刷新插件发现：`window.pluginDiscovery.discoverPlugins()`。
- 启用/禁用插件后重新加载 registry。

## 7. 业务规则

- 抽屉是非 modal dialog，关闭时只清空 activePanel。
- 所有面板入口由 `PANEL_COMPONENTS` 显式映射，不允许魔法字符串散落。
- 当前 session 缺失时，依赖 sessionId 的面板必须降级为全局工作区或隐藏会话专属操作。
