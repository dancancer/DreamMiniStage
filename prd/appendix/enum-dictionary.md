# Enum Dictionary

## 1. LLMType

| 值 | 说明 |
|----|------|
| `openai` | OpenAI-compatible API，包括第三方兼容服务 |
| `ollama` | 本地 Ollama |
| `gemini` | Google Gemini |

## 2. ApiBackendType

| 值 | 说明 |
|----|------|
| `openai` | OpenAI-compatible client |
| `azure` | Azure OpenAI compatible |
| `anthropic` | Anthropic client |
| `gemini` | Gemini URL 检测值，部分路径用专用 Gemini client |
| `ollama` | Ollama client |
| `openrouter` | OpenRouter compatible |
| `custom` | 自定义后端 |

## 3. Session View

| 值 | 说明 |
|----|------|
| `chat` | 聊天主舞台 |
| `worldbook` | 世界书编辑 |
| `preset` | 预设编辑 |
| `regex` | 正则脚本编辑 |

## 4. PanelId

| 值 | 说明 |
|----|------|
| `characters` | 角色卡入口 |
| `worldbook` | 世界书 |
| `regex` | 正则脚本 |
| `presets` | 预设 |
| `sessionTools` | 会话工具 |
| `modelSettings` | 模型设置 |
| `plugins` | 插件管理 |
| `tagColors` | 标签颜色 |
| `advancedSettings` | 高级设置 |
| `data` | 数据管理 |
| `settingsHub` | 设置菜单 |

## 5. PersonaDescriptionPosition

| 值 | 数字 | 说明 |
|----|------|------|
| `IN_PROMPT` | `0` | 通过 `{{persona}}` 注入 |
| `TOP_AN` | `2` | Author's Note 上方 |
| `BOTTOM_AN` | `3` | Author's Note 下方 |
| `AT_DEPTH` | `4` | 指定深度注入 |
| `NONE` | `9` | 不注入 |

## 6. RegexPlacement

| 值 | 数字 | 说明 |
|----|------|------|
| `USER_INPUT` | `1` | 用户输入 |
| `AI_OUTPUT` | `2` | AI 输出 |
| `SLASH_COMMAND` | `3` | Slash command |
| `WORLD_INFO` | `5` | 世界书内容 |
| `REASONING` | `6` | reasoning 块 |

## 7. SubstituteRegexMode

| 值 | 数字 | 说明 |
|----|------|------|
| `NONE` | `0` | 不替换 |
| `RAW` | `1` | 原始宏替换 |
| `ESCAPED` | `2` | 转义后宏替换 |

## 8. ScriptSource

| 值 | 说明 |
|----|------|
| `global` | 全局脚本 |
| `character` | 角色脚本 |
| `preset` | 预设脚本 |

## 9. WorldBookSource

| 值 | 说明 |
|----|------|
| `global` | 全局世界书 |
| `character` | 角色世界书 |
| `persona` | Persona 世界书 |
| `chat` | 会话世界书 |

## 10. SecondaryKeyLogic

| 值 | 说明 |
|----|------|
| `AND` | 所有次关键词必须匹配 |
| `OR` | 任一次关键词匹配 |
| `NOT` | 次关键词都不匹配 |
| `AND_ANY` | 主关键词 + 任一次关键词 |
| `AND_ALL` | 主关键词 + 全部次关键词 |
| `NOT_ANY` | 主关键词 + 没有任何次关键词 |
| `NOT_ALL` | 主关键词 + 不满足全部次关键词 |

## 11. PostProcessingMode

| 值 | 说明 |
|----|------|
| `none` | 不做 instruct 后处理 |
| `merge` | 合并/规整消息 |
| `semi` | 半严格规整 |
| `strict` | 严格规整 prompt |
| `single` | 折叠为单条 user 消息 |

## 12. Built-in Instruct Templates

| ID | 显示名 |
|----|--------|
| `chatml` | ChatML |
| `llama3` | Llama 3 / 3.1 / 3.2 |
| `llama2` | Llama 2 |
| `mistral` | Mistral / Mixtral |
| `alpaca` | Alpaca |
| `vicuna` | Vicuna 1.1 |
| `gemma` | Gemma / Gemma 2 |
| `phi` | Phi-3 / Phi-4 |
| `command-r` | Command-R |

## 13. ToolType

| 值 | 说明 |
|----|------|
| `SEARCH` | 搜索信息 |
| `ASK_USER` | 向用户提问 |
| `CHARACTER` | 生成/更新角色 |
| `STATUS` | 生成世界状态条目 |
| `USER_SETTING` | 生成玩家设定条目 |
| `WORLD_VIEW` | 生成世界观条目 |
| `SUPPLEMENT` | 生成补充条目 |
| `REFLECT` | 反思与更新任务 |
| `COMPLETE` | 完成 |

## 14. SessionStatus

| 值 | 说明 |
|----|------|
| `idle` | 空闲 |
| `thinking` | 思考中 |
| `executing` | 工具执行中 |
| `waiting_user` | 等待用户 |
| `completed` | 完成 |
| `failed` | 失败 |

## 15. P4 Scenario Category

| 值 | 说明 |
|----|------|
| `happy-path` | 主链路 |
| `failure-injection` | 故障注入 |
