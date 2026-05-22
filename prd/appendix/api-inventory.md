# API 清单

## 说明

DreamMiniStage 是一个纯前端应用，所有数据操作通过 IndexedDB 在浏览器本地完成。唯一的外部 API 调用是 LLM 对话生成。以下列出所有数据操作接口和外部服务调用。

---

## 一、LLM 外部 API 调用

### 对话生成

| 操作 | 方法 | 目标 | 触发时机 | 说明 |
|------|------|------|---------|------|
| 流式对话 | POST (SSE) | `{baseUrl}/chat/completions` | 发送消息 | OpenAI 兼容格式 |
| 流式对话 | POST (SSE) | Ollama API | 发送消息 | Ollama 本地服务 |
| 流式对话 | POST (SSE) | Gemini API | 发送消息 | Google Gemini |
| 获取模型列表 | GET | `{baseUrl}/models` | 模型设置页 | 获取可用模型 |

**请求结构 (OpenAI 格式):**

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "stream": true,
  "temperature": 1.0,
  "max_tokens": 4096,
  "top_p": 1.0,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

**响应格式 (SSE):**
```
data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}
data: [DONE]
```

### 搜索工具 (Tavily)

| 操作 | 方法 | 目标 | 触发时机 | 说明 |
|------|------|------|---------|------|
| 网络搜索 | POST | Tavily API | Agent 工具调用 | 搜索真实世界信息 |

### Google Drive (可选)

| 操作 | 方法 | 目标 | 触发时机 | 说明 |
|------|------|------|---------|------|
| 导出数据 | POST | Google Drive API | 数据面板导出 | 备份到 Google Drive |
| 导入数据 | GET | Google Drive API | 数据面板导入 | 从 Google Drive 恢复 |

---

## 二、Server Actions（本地数据操作）

以下操作均在 Next.js Server Action 层执行，数据存储在 IndexedDB。

### 角色管理 (`function/character/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `getAllCharacters()` | 角色卡库页面加载 | — | `Character[]` | 获取所有角色卡 |
| `importCharacter(file)` | 导入角色操作 | PNG 文件 | `Character` | 解析 PNG 角色卡 |
| `deleteCharacter(id)` | 删除角色操作 | characterId | void | 删除角色记录 |
| `moveToTop(id)` | 置顶操作 | characterId | void | 调整排序 |

### 对话管理 (`function/dialogue/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `handleCharacterChatRequest(params)` | 发送消息 | 消息上下文 | SSE 流 | 完整对话生成流水线 |
| `prepareOpeningGreeting(params)` | 对话初始化 | 角色数据 | `OpeningMessage` | 生成开场白 |
| `initDialogue(params)` | 新建对话 | sessionId, characterId | `Dialogue` | 初始化对话记录 |
| `editMessage(params)` | 编辑消息 | messageId, content | void | 更新消息内容 |
| `truncateMessages(params)` | 截断消息 | dialogueKey, messageId | void | 删除指定消息后的所有消息 |
| `swipeMessage(params)` | 切换消息版本 | messageId, direction | `Message` | 切换 swipe |
| `importFromJsonl(file)` | 导入对话 | JSONL 文件 | void | 从 JSONL 导入消息 |
| `exportToJsonl(dialogueKey)` | 导出对话 | dialogueKey | JSONL 文件 | 导出为 JSONL |
| `savePrompts(params)` | 调试 | 对话上下文 | void | 保存提示词快照 |
| `getDialogueInfo(key)` | 页面加载 | dialogueKey | `DialogueInfo` | 获取对话元数据 |
| `getProcessedDialogue(key)` | 页面加载 | dialogueKey | `ProcessedDialogue` | 获取处理后的对话 |

### 预设管理 (`function/preset/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `deletePromptFromPreset(presetId, promptId)` | 删除条目 | presetId, promptId | void | 移除预设条目 |
| `togglePromptEnabled(presetId, promptId, enabled)` | 切换启用 | presetId, promptId, bool | void | 启用/禁用条目 |
| `updatePromptInPreset(presetId, promptId, updates)` | 编辑条目 | presetId, promptId, data | void | 更新条目内容 |
| `importPreset(file)` | 导入预设 | JSON 文件 | `Preset` | 解析并存储预设 |
| `downloadPreset(presetId)` | 导出预设 | presetId | JSON 文件 | 序列化预设 |

### 世界书管理 (`function/worldbook/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `saveAdvancedWorldBookEntry(params)` | 保存条目 | 条目数据 | void | 创建/更新世界书条目 |
| `deleteWorldBookEntry(id)` | 删除条目 | entryId | void | 移除条目 |
| `importWorldBook(file)` | 导入 | JSON 文件 | `WorldBookEntry[]` | 导入世界书 |
| `getWorldBookInfo(characterId)` | 加载 | characterId | `WorldBookEntry[]` | 获取角色世界书 |
| `bulkOperation(params)` | 批量操作 | 操作类型, entryIds | void | 批量启用/禁用/删除 |

### 正则脚本管理 (`function/regex/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `addRegexScript(params)` | 新建 | 脚本数据 | `RegexScript` | 创建正则脚本 |
| `getRegexScript(id)` | 加载 | scriptId | `RegexScript` | 获取单个脚本 |
| `updateRegexScript(id, updates)` | 编辑 | scriptId, data | void | 更新脚本 |
| `deleteRegexScript(id)` | 删除 | scriptId | void | 移除脚本 |
| `importRegexScripts(file)` | 导入 | JSON 文件 | `RegexScript[]` | 导入正则脚本 |

### 数据管理 (`function/data/`)

| 函数 | 触发时机 | 输入 | 输出 | 说明 |
|------|---------|------|------|------|
| `exportAllData()` | 数据面板导出 | — | 文件 | 导出全部本地数据 |
| `importAllData(file)` | 数据面板导入 | 数据文件 | void | 恢复全部数据 |
| `exportToGoogle(params)` | Google 导出 | OAuth token | void | 备份到 Google Drive |
| `importFromGoogle(params)` | Google 导入 | OAuth token | void | 从 Google Drive 恢复 |

---

## 三、Zustand Store API

### useDialogueStore

| 方法 | 说明 |
|------|------|
| `fetchLatestDialogue(key, characterId)` | 加载最新对话 |
| `initDialogue(params)` | 初始化新对话 |
| `addUserMessage(key, message)` | 添加用户消息 |
| `editMessage(key, messageId, content)` | 编辑消息 |
| `sendMessage(params)` | 触发 LLM 生成 |
| `regenerate(key, messageId)` | 重新生成回复 |
| `switchOpening(key, index)` | 切换开场白 |
| `switchBranch(key, targetMessageId)` | 切换对话分支 |

### useSessionStore

| 方法 | 说明 |
|------|------|
| `createSession(characterId)` | 创建新会话 |
| `deleteSession(sessionId)` | 删除会话 |
| `updateSession(sessionId, updates)` | 更新会话元数据 |
| `getSessions()` | 获取所有会话 |

### useModelStore

| 方法 | 说明 |
|------|------|
| `getConfigs()` | 获取所有 API 配置 |
| `addConfig(config)` | 添加新配置 |
| `updateConfig(configId, updates)` | 更新配置 |
| `deleteConfig(configId)` | 删除配置 |
| `setActiveConfig(configId)` | 切换活跃配置 |

### usePersonaStore

| 方法 | 说明 |
|------|------|
| `getPersonas()` | 获取所有人格 |
| `createPersona(data)` | 创建人格 |
| `updatePersona(id, updates)` | 更新人格 |
| `deletePersona(id)` | 删除人格 |
| `setDefaultPersona(id)` | 设置默认人格 |
| `activatePersona(id)` | 激活人格 |
