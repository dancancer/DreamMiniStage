# SillyTavern Chat Completion 消息生成流程（OpenAI 路径）

文档说明最终发送到 LLM 的消息如何组织，涵盖数据流、处理细节与关键代码位置。流程图用文本符号表示，便于直接阅读。

---

## 总览
- 入口：用户点击发送（或自动生成）→ `Generate('normal', …)`（`public/script.js`）。
- 核心：`openai.js` 负责组装请求；`PromptManager` 负责系统/模板提示；角色/世界/扩展数据在此阶段被注入。
- 输出：`fetch('/api/backends/chat-completions/send')` 发送 JSON（messages + 参数）到后端。

### 流程图（文本版）
```
[UI发送按钮/自动触发]
        |
        v
[script.js Generate()]
        |
        v
[openai.js sendOpenAIRequest]
        |
        +--> [PromptManager.render: dry-run生成 MessageCollection 估算token]
        |         |
        |         v
        |   [PromptManager.getPromptCollection]
        |         |
        |         v
        |   [拼装“框架提示”Prompt数组]
        |
        v
[收集动态上下文]
  - 聊天历史 (chat)
  - 示例对话 (examples)
  - 角色/群组/世界信息 (markers)
  - 扩展/工具调用提示
        |
        v
[注入与排序]
  - prompt_order 顺序+开关
  - 相对插入 vs 绝对插入
  - 触发器过滤 (generationType)
        |
        v
[构建 messages[]
  role/content/name 等字段齐备]
        |
        v
[附加函数/工具、采样/模型参数、logit bias 等]
        |
        v
[fetch('/api/backends/chat-completions/send')]
```

---

## 1) 输入与准备
- 发送入口：`Generate('normal', …)` → `sendOpenAIRequest`（`public/scripts/openai.js`）。
- 预设加载：当前 OpenAI 预设的 prompts/prompt_order、采样参数等在 `oai_settings` 中（`onSettingsPresetChange` 应用 UI 选择；`saveOpenAIPreset` 将预设写盘 `/api/presets/save`）。
- Prompt Manager 初始化：`setupChatCompletionPromptManager`（`openai.js:586`）构造 `PromptManager`，配置 `completion_prompt_manager_list`、默认 system prompts、sortable/拖拽等。

---

## 2) Prompt 框架构建（PromptManager）——细化
- **数据源**
  - `serviceSettings.prompts`：来自当前 OpenAI 预设（预设字段 `prompts`）。
  - `serviceSettings.prompt_order`：引用列表；global 策略使用 dummyId=100001（默认），也支持 per-character 策略。
  - 角色/群组/世界/Persona 等 marker prompts：`PromptManager.promptSources` 自动保证存在并可编辑。
  - 旧字段迁移：`registerPromptManagerMigration` 将 `main_prompt/nsfw_prompt/jailbreak_prompt` 迁入 `prompts`（`PromptManager.js:35`）。

- **开关与排序逻辑**
  - 取当前角色的顺序：`getPromptOrderForCharacter(activeCharacter)`。
  - `prompt_order` entry.enabled 为 false 时跳过；但 main 被禁用时会插入“空 main”以占位（保持相对插槽）。
  - 拖拽排序：列表元素带 `drag-handle`，sortable 写回 prompt_order。

- **相对 vs 绝对插入**
  - 相对插入（默认）：按 prompt_order 顺序写入 messages 前部（系统提示区）。
  - 绝对插入：`injection_position === ABSOLUTE`，带 `injection_depth`（插入点层级）与 `injection_order`（同层顺序），用于在聊天流中特定位置插针。

- **触发器与启用条件**
  - `injection_trigger`：只有当 generationType 命中（如 normal/continue/quiet）才启用。
  - `marker/system_prompt/forbid_overrides` 标志决定能否删除、编辑、是否允许被角色卡覆盖。

- **内容替换与宏**
  - `preparePrompt` 使用 `substituteParams` 将占位符替换为当前角色名/用户名/群组成员等。
  - 变量宏（`{{setvar::...}}` 等）在宏替换阶段写入局部变量并被删空，不会出现在最终消息（`variables.js:240`）。`{{trim}}` 用于移除多余换行（`macros.js:7,24`）。

- **产物**
  - `PromptCollection`：包含已替换文本、应用启用/排序/触发器后的 Prompt 列表，供后续注入。

---

## 3) 动态上下文组装——细化
- **聊天历史截断**
  - `getChatCompletionMessages`（`openai.js` 内部）将当前对话转为 MessageCollection，按 token 预算截断，处理媒体/工具调用附加字段。

- **示例对话**
  - `parseExampleIntoIndividual` 将示例文本拆分为 `example_user/example_assistant` system 消息，按行切分并添加角色前缀（群聊时附加名字）。

- **世界信息与扩展**
  - World Info、扩展 prompt（extensions prompt roles/types）、Persona 描述等被做成 marker prompts，`PromptManager` 在 `sanitizeServiceSettings` 时确保缺省项存在，并在渲染/启用时加入。

- **角色/群组替换**
  - 角色卡字段（charDescription/personality/scenario）和群组成员名通过 `substituteParams` 注入到相关 prompts；群组成员也会影响示例对话的名字拼接。

- **工具与函数调用上下文**
  - 已有工具调用结果、或可用的 function tools，由 ToolManager 注册并在后续请求中附带；若消息中包含 tool_invocations，会被 MessageCollection 保留。

- **Token 预估**
  - PromptManager 在 dry-run 时调用 `tryGenerate`（静默生成）后，通过 `TokenHandler.populateTokenCounts` 记录每条 prompt/message 的 token 数，为 UI 提示和截断依据。

---

## 4) 注入与最终 messages 构建——细化
- **合并策略**
  - 从 `PromptCollection` 取出按顺序/深度的 prompts：
    - 相对 prompts：依次 prepend 到消息流（通常位于用户对话前的系统区）。
    - 绝对 prompts：按 `injection_depth`/`injection_order` 插入消息序列指定位置（可位于历史、系统提示之间）。
  - 对于被禁用的 main，会插入空内容 main 以维持相对定位需求（供扩展依赖）。

- **触发器应用**
  - 仅 `injection_trigger` 命中的 prompt 被加入；未命中且 identifier 为 main 时加入空 main 作为占位。

- **Message 对象形成**
  - 每个 prompt 转为 `{role, content, name?, identifier, marker flags...}`；角色通常 system，marker/system_prompt/forbid_overrides 控制 UI 与覆盖行为。
  - 聊天历史、示例、工具响应等追加在后；PromptManager 的绝对插针可能插入到这些位置。

- **Token 校准与警告**
  - `TokenHandler.getCounts()` 提供各条 message 的 tokens；PromptManager UI 对 chatHistory 项在 tokens 过低时给 warning/danger（提示上下文被挤压）。

- **附加元数据**
  - 绑定模型/采样参数、logit bias、reverse proxy、自定义端点、function_calling、reasoning/web_search 等来自 `oai_settings`。
  - 工具/函数列表、图像/音频内联选项、n/seed、enable_web_search/request_images 等同封装在请求体。

---

## 5) 请求发送
- `sendOpenAIRequest` 将 messages 与参数封装为 JSON（内部构造 payload），然后：
  - `fetch('/api/backends/chat-completions/send')` POST 发送到后端。
  - 后端再转发到具体提供商（OpenAI/Claude/OpenRouter 等）。

---

## 关键文件/行参考
- 预设切换/应用：`public/scripts/openai.js:4602`（onSettingsPresetChange），`public/scripts/openai.js:4100`（saveOpenAIPreset）。
- Prompt Manager 初始化与渲染：`public/scripts/openai.js:586`，`public/scripts/PromptManager.js:300` 起。
- Prompt 过滤/排序/注入：`PromptManager.getPromptCollection`（≈1480 行）、`renderPromptManagerListItems`（≈1149 行）、`preparePrompt`（≈1610 行）。
- 变量宏：`public/scripts/variables.js:240`；`{{trim}}` 宏：`public/scripts/macros.js:7,24`。
- 发送入口：`public/script.js:7381`（getSettings 载入后调用 Generate），`public/scripts/openai.js`（sendOpenAIRequest 全流程）。
