# DreamMiniStage Architecture

> 更新时间：2026-05-22
> 来源：当前代码、`code-to-prd` 静态扫描、核心页面/状态/集成模块人工复核。

## 1. 系统定位

DreamMiniStage 是一个本地优先的沉浸式叙事舞台。它不是传统的后端 API 产品，而是把角色卡、会话、世界书、预设、正则脚本、Persona、插件脚本和模型配置都收口在浏览器端：

- **UI 层**：Next.js App Router + React 19 + Tailwind/Radix UI。
- **状态层**：Zustand stores，按业务域拆分为 session/dialogue/model/persona/prompt/quick-reply/checkpoint/group 等。
- **持久化层**：IndexedDB (`CharacterAppDB`, version 12) + localStorage；角色头像使用 Blob store。
- **生成层**：本地组装 prompt，通过 OpenAI-compatible、Ollama、Gemini 等外部 LLM 服务生成回复。
- **运行时扩展层**：slash command、script bridge、plugin registry、function tool bridge、MVU 与向量记忆。

架构边界很明确：除 LLM、Google Drive、Jina Reader、插件发现/宿主能力等显式外部调用外，业务数据默认不离开浏览器。

## 2. 路由与入口

| 路由 | 入口组件 | 业务职责 |
|------|----------|----------|
| `/` | `app/page.tsx` -> `components/HomeContent.tsx` | 会话列表、会话重命名、删除、进入会话、创建新会话入口 |
| `/character-cards` | `app/character-cards/page.tsx` | 角色卡库、PNG 导入、列表/轮播视图、编辑、删除、置顶、创建会话 |
| `/personas` | `app/personas/page.tsx` | Persona 管理、默认/激活 Persona、头像、描述注入配置 |
| `/session?id={sessionId}` | `app/session/session-page-content.tsx` | 聊天主舞台、世界书/预设/正则视图、右侧工具回调、slash/script bridge |
| `/test-script-runner` | `app/test-script-runner/page.tsx` | P4 Playwright/MCP 脚本链路诊断控制台，属于内部验证页面 |
| `not-found` | `app/not-found.tsx` | 404 兜底状态 |

`app/i18n/*`、`app/metadata.ts`、`app/layout.tsx` 是应用基础设施，不作为业务页面单独建模。

## 3. 分层结构

### 3.1 Presentation

主要目录：

- `app/`：路由入口、页面级编排、`/session` 专用 action/effect/host 模块。
- `components/`：业务组件与 UI primitives；右侧抽屉在 `components/layout/RightPanel.tsx`。
- `components/panels/`：右侧工具面板，包括角色、世界书、预设、正则、模型设置、插件、数据、会话工具等。
- `contexts/`：主题、音效、UI layout 等全局上下文。

页面入口保持薄壳：例如 `/session` 的 `page.tsx` 只负责 Suspense，主编排在 `session-page-content.tsx`，视图组合在 `session-page-layout.tsx`，具体 chat/worldbook/preset/regex 由独立组件承载。

### 3.2 State

核心 stores：

| Store | 路径 | 职责 |
|-------|------|------|
| `useSessionStore` | `lib/store/session-store.ts` | 会话列表 CRUD、session -> character 展示信息补全 |
| `useDialogueStore` | `lib/store/dialogue-store/` | 对话消息、开场白、发送、再生、截断、swipe |
| `useModelStore` | `lib/store/model-store.ts` | 多模型配置、active config、持久化到 `model-config-storage` |
| `usePersonaStore` | `lib/store/persona-store.ts` | Persona CRUD、默认/激活、角色连接、chat lock |
| `usePromptConfigStore` | `lib/store/prompt-config-store.ts` | 当前预设、context、sysprompt、instruct、stop strings、后处理 |
| `useSessionToolModesStore` | `lib/store/session-tool-modes.ts` | 剧情推进、视角、场景过渡等会话临时模式 |

状态原则是“业务 store 管数据，页面 hook 只装配”。`/session` 通过 `useSessionPageActions` 把 navigation、host、store callbacks、slash executor 合并成稳定 action 集合。

### 3.3 Data

`lib/data/local-storage.ts` 是 IndexedDB 底座，当前 object stores：

- `characters_record`
- `character_dialogues`
- `character_images`
- `world_book`
- `regex_scripts`
- `preset_data`
- `sessions_record`
- `agent_conversations`
- `memory_entries`
- `memory_embeddings`
- `regex_allow_list`
- `regex_presets`

角色、会话、世界书、正则、预设等在 `lib/data/roleplay/*-operation.ts` 中封装为记录级操作。导入导出与 Google Drive 入口位于 `function/data/*`。

### 3.4 Generation Runtime

对话生成链路：

1. `useCharacterDialogue.handleSendMessage` 读取当前模型、语言、回复长度、fast model、advanced settings。
2. `function/dialogue/chat.ts` 校验 payload，确保 dialogue tree 与 opening，先落 pending user turn。
3. `lib/prompt-config/service.ts` 解析 active preset、context preset、sysprompt、instruct、stop strings、post processing。
4. `prepareDialogueExecution` 与 NodeFlow/generation-runtime 组装 prompt、世界书、正则、MVU、向量记忆。
5. `function/dialogue/chat-streaming.ts` 根据请求选择 buffered JSON 或 SSE。
6. `processPostResponseAsync` 回填 assistant response，触发 vector memory ingest、MVU 变量处理和 summary refresh。

模型支持分两层：

- 用户配置层 `LLMType`：`openai | ollama | gemini`。
- 低层 API client 层：OpenAI-compatible/Azure/OpenRouter 走 `OpenAIClient`，Anthropic/Ollama 有通用后端接口，Gemini 走专用 `callGeminiOnce` 或生成运行时。

### 3.5 Prompt 与 SillyTavern 兼容层

Prompt 能力由以下模块协同：

- `lib/core/st-preset-types.ts`：OpenAI preset、context preset、sysprompt preset 结构。
- `lib/prompt-config/state.ts`：运行时 prompt behavior state。
- `lib/prompt-config/catalog.ts`：内置 context/instruct 预设。
- `lib/core/instruct/templates.ts`：ChatML、Llama、Mistral、Alpaca、Vicuna、Gemma、Phi、Command-R 等本地模型模板。
- `components/prompt-viewer/*`：查看上一次 LLM 调用的 prompt 构成、搜索、图片素材。

设计上不在 prompt path 中做隐式兼容兜底；不支持的格式应显式失败或在导入阶段收敛。

### 3.6 Slash / Script Bridge

Slash command 注册表入口位于 `lib/slash-command/registry/index.ts`，命令清单按 `command-group-*.ts` 分片后统一 compose。当前静态扫描到 464 个命令/别名，按处理器分组包括：

- core message/checkpoint/ui/utility
- variables/operators
- chat/member/reasoning
- generation/worldbook/lore/vector
- quick reply/profile/system prompt/persona/note
- extension/clipboard/translate/yt-script
- tooling/data bank/secret/expression

脚本桥位于 `hooks/script-bridge/`，负责把角色卡脚本、iframe API、slash command、function tool、UI host 能力接入 `/session`。`/session` 默认宿主在 `session-host-defaults.ts` 中提供 translate、YouTube transcript、clipboard read/write、extension state read 等能力；外部宿主可通过 `window.__DREAMMINISTAGE_SESSION_HOST__` 覆盖。

### 3.7 Right Panel Shell

`RightPanel` 使用 `PanelId` 到组件的固定映射，避免入口散落：

- `characters`
- `worldbook`
- `regex`
- `presets`
- `sessionTools`
- `modelSettings`
- `plugins`
- `tagColors`
- `advancedSettings`
- `data`
- `settingsHub`

会话低频工具被收口到 `SessionToolsPanel`：叙事模式、Checkpoint/Branch、用户名、Script Debug、JSONL 导入导出、Prompt Viewer、Quick Reply、群聊成员和 Checkpoint 列表。

## 4. 关键业务流

### 4.1 创建会话

`/character-cards?mode=create-session` -> 选择角色卡 -> `useSessionStore.createSession(characterId)` -> IndexedDB 写 `sessions_record` -> 跳转 `/session?id={sessionId}`。

同一个角色可以有多个会话。会话删除时会删除对应 dialogue tree，但不会删除角色卡。

### 4.2 打开会话

`/session` 读取 `id`，`useSessionRouteState` 解析 session -> characterId，`useCharacterLoader` 加载角色与 dialogue tree。若没有会话 ID，显示返回首页/创建会话的空状态；若角色丢失或 session 无效，显示错误状态。

### 4.3 发送消息

用户输入普通文本时走 LLM 生成；输入 slash command 时走本地 command executor，不发送到 LLM。生成期间 `isSending` 锁定输入，回复完成后写入 dialogue tree 并刷新消息状态。

### 4.4 编辑上下文

聊天页通过 view state 切换到：

- `worldbook`：角色/会话/全局世界书。
- `preset`：全局预设工作区。
- `regex`：全局规则工作区，可在会话中带角色上下文。

右侧面板提供同类入口，但不强制绑定当前会话，避免编辑器只能从聊天页进入。

## 5. 外部依赖边界

| 依赖 | 触发点 | 数据边界 |
|------|--------|----------|
| LLM API | 发送/再生/翻译/YouTube transcript 提取 | 当前 prompt/messages 与模型配置 |
| Jina Reader | `/yt-script` 默认宿主 | YouTube 页面转储读取 |
| Google Drive | 数据面板导入导出 | 全量备份 JSON |
| Plugin registry/discovery | 插件面板、extension-state | 浏览器端插件 manifest 与启用态 |
| Analytics | Root layout | 页面访问/按钮事件 |

身份模块已经收敛为本地 guest 状态。仓库当前不保留正式账号 API client，业务文档也不应描述邮箱/密码登录为默认能力。

## 6. 架构风险与维护规则

- 单文件行数仍有多处超过 400 行；本轮已先拆 `slash-command/registry` 与 `script-bridge/capability-matrix` 两个静态清单，剩余项见 `docs/reports/2026-05-22-line-count-backlog.md`。
- `.backup` 源文件已删除并通过 `.gitignore` 禁止再次入仓。
- `code-to-prd` scaffold 会把 `app/session` 内部模块和测试文件识别成页面，需要人工过滤为真实业务路由。
- 文档必须以当前代码为准；历史 phase/plan/report 只能作为背景，不可直接当成现行产品事实。
