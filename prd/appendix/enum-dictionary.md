# 枚举字典

## LLM 类型 (LLMType)

| 值 | 显示名 | 说明 |
|----|--------|------|
| `openai` | OpenAI | OpenAI 兼容 API（包括第三方代理） |
| `ollama` | Ollama | 本地 Ollama 模型服务 |
| `gemini` | Gemini | Google Gemini API |

## 视图模式 (CharacterView)

| 值 | 显示名 | 说明 |
|----|--------|------|
| `chat` | 聊天 | 对话消息视图 |
| `worldbook` | 世界书 | 世界书编辑器视图 |
| `preset` | 预设 | 预设编辑器视图 |
| `regex` | 正则 | 正则脚本编辑器视图 |

## 消息角色 (Message Role)

| 值 | 说明 |
|----|------|
| `system` | 系统消息（不对用户显示） |
| `user` | 用户发送的消息 |
| `assistant` | AI 角色回复的消息 |

## 工具类型 (ToolType)

| 值 | 显示名 | 说明 |
|----|--------|------|
| `SEARCH` | 搜索 | 通过 Tavily API 搜索真实世界信息 |
| `CHARACTER` | 角色 | 生成或更新角色卡字段 |
| `STATUS` | 状态 | 创建世界状态条目 |
| `USER_SETTING` | 用户设定 | 创建玩家设定条目 |
| `WORLD_VIEW` | 世界观 | 创建世界结构条目 |
| `SUPPLEMENT` | 补充 | 创建补充性世界书条目 |
| `REFLECT` | 反思 | 反思进展，更新任务 |
| `COMPLETE` | 完成 | 最终完成标记，清除任务 |
| `ASK_USER` | 询问用户 | 暂停生成，向用户提问 |

## 事件类型 (EventType)

| 值 | 触发时机 |
|----|---------|
| `GENERATION_STARTED` | LLM 生成开始 |
| `GENERATION_ENDED` | LLM 生成完成或失败 |
| `MESSAGE_RECEIVED` | 收到 AI 回复 |
| `MESSAGE_SENT` | 用户发送消息 |
| `MESSAGE_DELETED` | 消息被删除 |
| `MESSAGE_EDITED` | 消息被编辑 |
| `CHAT_CHANGED` | 切换到不同对话 |
| `WORLDINFO_ENTRIES_LOADED` | 世界书条目加载完成 |
| `STREAM_CHUNK` | 收到 SSE 流数据块 |
| `VARIABLE_UPDATED` | MVU 变量被更新 |
| `SCRIPT_EXECUTED` | 脚本执行完成 |
| `ERROR_OCCURRED` | 发生错误 |

## MVU 命令 (MvuCommand)

| 命令 | 说明 |
|------|------|
| `set` | 设置变量值 |
| `insert` | 向数组/对象插入数据 |
| `assign` | 赋值（同 set） |
| `remove` | 从数组/对象移除元素 |
| `unset` | 删除变量 |
| `delete` | 删除变量（同 unset） |
| `add` | 数值加法操作 |

## 脚本消息类型 (ScriptMessageType)

| 值 | 说明 |
|----|------|
| `CONSOLE_LOG` | 脚本控制台输出 |
| `API_CALL` | 脚本发起 API 调用 |
| `EVENT_EMIT` | 脚本发出事件 |
| `SCRIPT_STATUS` | 脚本执行状态变更 |

## 脚本执行状态

| 值 | 说明 |
|----|------|
| `running` | 脚本正在执行 |
| `completed` | 脚本执行完成 |
| `error` | 脚本执行出错 |

## 插件类别 (PluginCategory)

| 值 | 说明 |
|----|------|
| `TOOL` | 工具类插件 |
| `UI` | UI 扩展插件 |
| `WORKFLOW` | 工作流插件 |
| `INTEGRATION` | 集成类插件 |

## 插件权限 (PluginPermission)

| 值 | 说明 |
|----|------|
| `READ_MESSAGES` | 读取消息 |
| `WRITE_MESSAGES` | 写入消息 |
| `MODIFY_UI` | 修改 UI |

## 右侧面板 ID (PanelId)

| 值 | 显示名 | 说明 |
|----|--------|------|
| `characters` | 角色 | 角色管理面板 |
| `worldbook` | 世界书 | 世界书编辑面板 |
| `regex` | 正则 | 正则脚本面板 |
| `presets` | 预设 | 预设管理面板 |
| `sessionTools` | 会话工具 | 快捷回复/群聊/分支 |
| `modelSettings` | 模型设置 | LLM 配置面板 |
| `plugins` | 插件 | 插件管理面板 |
| `tagColors` | 标签颜色 | 符号着色面板 |
| `advancedSettings` | 高级设置 | LLM 高级参数面板 |
| `data` | 数据 | 导入/导出面板 |
| `settingsHub` | 设置中心 | 设置入口面板 |

## 主题模式 (ThemeMode)

| 值 | 说明 |
|----|------|
| `light` | 明亮主题 |
| `dark` | 暗色主题 |

## 语言 (Language)

| 值 | 显示名 |
|----|--------|
| `zh` | 中文 |
| `en` | English |

## 人格注入角色 (Persona Injection Role)

| 值 | 说明 |
|----|------|
| `system` | 作为系统消息注入 |
| `user` | 作为用户消息注入 |
| `assistant` | 作为助手消息注入 |

## Markdown 符号着色类型

| 符号模式 | 匹配内容 | 默认用途 |
|---------|---------|---------|
| `"..."` | 双引号包裹文本 | 对话/语音 |
| `*...*` | 单星号包裹文本 | 动作/心理描写 |
| `**...**` | 双星号包裹文本 | 强调重点 |
| `[...]` | 方括号包裹文本 | 系统信息/旁白 |
| `` `...` `` | 反引号包裹文本 | 代码/术语 |
| `>...` | 大于号开头 | 引用/内心独白 |
| `[...](...)`| 链接格式 | 超链接 |
