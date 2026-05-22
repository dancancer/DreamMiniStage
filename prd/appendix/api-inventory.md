# API Inventory

> 范围：当前代码中的业务数据操作、外部服务调用与本地 host API。

## 1. 外部网络边界

| 能力 | 触发 | 目标 | 说明 |
|------|------|------|------|
| LLM 对话生成 | 发送/再生/继续 | OpenAI-compatible / Ollama / Gemini | 用户模型配置决定 base URL、model、key |
| 模型列表 | 模型设置 | provider models endpoint | 供模型配置页选择 |
| Gemini 单次调用 | `/translate`、`/yt-script` 默认宿主 | Gemini API | `callGeminiOnce` |
| Jina Reader | `/yt-script` 默认宿主 | `https://r.jina.ai/http://...` | 读取 YouTube 页面转储 |
| Google Drive OAuth | 数据面板 | Google OAuth/API | 备份/恢复本地数据 |
| Plugin discovery | 插件面板 | `window.pluginDiscovery` | 浏览器宿主注入 |
| Analytics | 页面与按钮事件 | Vercel/Google Analytics | 使用统计 |

## 2. 角色卡操作

| 函数 | 路径 | 触发 |
|------|------|------|
| `getAllCharacters` | `function/character/list.ts` | 角色卡库加载 |
| `handleCharacterUpload` | `function/character/import.ts` | PNG 导入 |
| `deleteCharacter` | `function/character/delete.ts` | 删除角色 |
| `moveToTop` | `function/character/move-to-top.ts` | 置顶角色 |

## 3. 会话操作

| 函数/方法 | 路径 | 触发 |
|-----------|------|------|
| `fetchAllSessions` | `lib/store/session-store.ts` | 首页加载 |
| `createSession` | `lib/store/session-store.ts` | 角色卡创建会话 |
| `updateSessionName` | `lib/store/session-store.ts` | 首页重命名 |
| `deleteSession` | `lib/store/session-store.ts` | 首页删除 |
| `SessionOperations.*` | `lib/data/roleplay/session-operation.ts` | IndexedDB 记录级 CRUD |

## 4. 对话操作

| 函数/方法 | 路径 | 说明 |
|-----------|------|------|
| `handleCharacterChatRequest` | `function/dialogue/chat.ts` | 对话生成主入口 |
| `handlePreparedDialogueResponse` | `function/dialogue/chat-streaming.ts` | buffered/SSE 响应 |
| `processPostResponseAsync` | `function/dialogue/chat-shared.ts` | 回填、向量记忆、MVU、summary |
| `exportDialogueJsonl` | `function/dialogue/jsonl.ts` | JSONL 导出 |
| `importDialogueJsonl` | `function/dialogue/jsonl.ts` | JSONL 导入 |
| `getCharacterDialogue` | `function/dialogue/info.ts` | 页面加载 dialogue |
| `LocalCharacterDialogueOperations.*` | `lib/data/roleplay/character-dialogue-operation.ts` | dialogue tree CRUD |

## 5. 世界书操作

| 函数 | 路径 | 说明 |
|------|------|------|
| `getWorldBookEntries` | `function/worldbook/info.ts` | 加载条目 |
| `saveAdvancedWorldBookEntry` | `function/worldbook/edit.ts` | 新增/编辑条目 |
| `deleteWorldBookEntry` | `function/worldbook/delete.ts` | 删除条目 |
| `importWorldBook` | `function/worldbook/import.ts` | 导入世界书 |
| `bulkToggleWorldBookEntries` | `function/worldbook/bulk-operations.ts` | 批量启用/禁用 |
| `list/create/toggle/deleteClientGlobalWorldBook` | `lib/worldbook/global-client.ts` | 全局世界书库 |

## 6. 预设操作

| 函数 | 路径 | 说明 |
|------|------|------|
| `getAllPresets` | `function/preset/global.ts` | 列表 |
| `getPreset` | `function/preset/global.ts` | 详情 |
| `togglePresetEnabled` | `function/preset/global.ts` | active preset |
| `deletePreset` | `function/preset/global.ts` | 删除 |
| `getPromptsForDisplay` | `function/preset/global.ts` | 排序后 prompt |
| `deletePromptFromPreset` | `function/preset/edit.ts` | 删除 prompt |
| `togglePromptEnabled` | `function/preset/edit.ts` | 启用 prompt |
| `importPreset` | `function/preset/import.ts` | 导入 |
| `downloadPreset` | `function/preset/download.ts` | 导出 |

## 7. 正则脚本操作

| 函数 | 路径 | 说明 |
|------|------|------|
| `addRegexScript` | `function/regex/add.ts` | 新增 |
| `getRegexScript` / list | `function/regex/get.ts` | 查询 |
| `updateRegexScript` | `function/regex/update.ts` | 更新 |
| `deleteRegexScript` | `function/regex/delete.ts` | 删除 |
| `importRegexScripts` | `function/regex/import.ts` | 导入 |
| `get/updateRegexSetting` | `function/regex/*setting.ts` | 配置 |

## 8. 数据备份

| 函数 | 路径 | 说明 |
|------|------|------|
| `exportDataToFile` | `function/data/export-import.ts` | 全量本地导出 |
| `importDataFromFile` | `function/data/export-import.ts` | 全量本地导入 |
| `getGoogleLoginUrl` | `function/data/google-control.ts` | OAuth |
| `backupToGoogle` | `function/data/google-control.ts` | 上传备份 |
| `getBackUpFile` | `function/data/google-control.ts` | 拉取备份 |

## 9. Host / Browser API

| 能力 | 来源 | 说明 |
|------|------|------|
| `window.__DREAMMINISTAGE_SESSION_HOST__` | 外部宿主注入 | 覆盖 `/session` host capability |
| Clipboard API | 浏览器 | `/clipboard-get`、`/clipboard-set` 默认能力 |
| `window.pluginRegistry` | 插件系统 | extension-state、插件面板 |
| `window.pluginDiscovery` | 插件系统 | 插件刷新 |
| iframe dispatcher | script bridge | 插件脚本 function tool 与 slash command 回调 |
