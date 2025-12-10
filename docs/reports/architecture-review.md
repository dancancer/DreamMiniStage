# DreamMiniStage.ai 架构巡检与优化建议（2025-02）

## 范围与方法
- 代码基线：当前 `main` 工作区，重点阅读 `app/`, `components/`, `function/`, `lib/`（workflow/nodeflow、data/prompt/memory、plugins）等核心路径。
- 关注维度：业务流程闭环、技术架构、数据流/存储、可观测性、安全、文件尺寸与复杂度（遵循每文件 <400 行/低分支复杂度的内规）。

## 业务流程梳理
- 着陆与导航：`app/page.tsx` + `components/HomeContent.tsx` 提供多语言登陆页，入口跳转角色卡管理页。
- 角色卡管理：`app/character-cards/page.tsx` 负责列出/导入/编辑/删除/下载角色卡，数据源通过 `function/character/*` 调用 `LocalCharacterRecordOperations`（IndexedDB）。
- 角色聊天闭环：前端提交 -> `function/dialogue/chat.ts` 创建 `DialogueWorkflow`，流水线依次经过 UserInput -> PluginMessage -> Preset -> Context -> WorldBook -> LLM -> Regex -> Plugin -> Output，结果落盘 `LocalCharacterDialogueOperations`（对话树，IndexedDB）。
- 世界书/正则/预设：`WorldBookOperations`、`RegexScriptOperations`、`PresetNode` 等节点在流水线中补充上下文与后处理。
- 记忆/RAG：`lib/core/memory-manager.ts` + `LocalMemoryOperations` 管理记忆条目、向量存储（同样落在 IndexedDB），并在 MemoryNode 中用于检索/增强提示。
- 研究代理（Agent）：`lib/data/agent/agent-conversation-operations.ts` 维护多轮研究会话、任务队列、知识库，作为后续角色/世界书自动生成入口。
- 插件/脚本：`lib/plugins/*` 提供插件发现与注册，`components/PluginManagerModal.tsx` 读取全局 `window.pluginRegistry`；`lib/script-runner` 负责脚本运行。

## 技术架构速览
- 前端：Next.js 15（App Router）+ React 19，绝大部分页面为 client component；动效使用 Tailwind animate-in/transition。
- 工作流：自研 NodeFlow（`lib/workflow/*`, `lib/nodeflow/*`）实现有向无环节点执行，支持 AFTER 类节点。
- 数据层：全部存储在浏览器 IndexedDB（`lib/data/local-storage.ts`），各模块通过封装的读写操作实现“表”概念。
- LLM 接入：LangChain OpenAI/Ollama/Gemini runnable，预设与世界书拼装系统提示，Regex 节点做结构化解析。
- 样式/资源：Tailwind 4 +自定义 CSS；提示模板集中在 `lib/prompts/preset-prompts.ts`。

## 主要问题与优化方向
1) 对话请求的流式能力与错误观测缺失  
   - 现状：`function/dialogue/chat.ts:35-56` 硬编码 `streaming: false`，忽略传入 payload 的 `streaming` 参数；错误只打 console，未记录调用链或 token 用量。  
   - 风险：前端无法开启流式输出，体验下降；排障缺乏可观测性，后处理异常被吞掉（`processPostResponseAsync` 异常仅 console）。  
   - 改进：允许透传 `streaming` 并根据模型能力自动降级；为工作流执行添加结构化日志（请求 ID/角色 ID/nodeId/耗时/usage），并在失败时把状态写入节点输出或返回体。

2) 角色卡页面存在破坏性迁移 & 组件过大  
   - 现状：`app/character-cards/page.tsx:158-198` 在本地标记缺失时会删除全部角色卡作为“迁移”；组件 528 行，集成 UI、数据拉取、迁移、错误提示、模式切换等多职责。  
   - 风险：用户数据被静默清空；大组件难维护/测试，超过 400 行规则。  
   - 改进：把迁移逻辑拆到独立 util，并在 UI 二次确认+备份导出后才执行；用自定义 hooks 拆分视图/数据/弹窗控制（如 `useCharacterCardsData`, `useCharacterCardsUI`），视图组件仅消费 props。

3) Prompt 体积与合规风险  
   - 现状：`lib/prompts/preset-prompts.ts` 约 1995 行，包含多套中英/NSFW 设定，直接打入前端 bundle。  
   - 风险：首屏 JS 体积膨胀；敏感文案下发到客户端，合规与审核风险；难以按需维护单个预设。  
   - 改进：按预设拆分为独立文件并使用动态 import；将敏感预设改为服务端配置或受用户显式开关控制；增加版本号/元数据，方便灰度与禁用。

4) Agent 数据层单体与命名缺陷  
   - 现状：`lib/data/agent/agent-conversation-operations.ts` 604 行单类处理所有操作，方法名 `recinsert_orderror`（行 246）拼写错误；每次读写全量 sessions，缺少乐观锁/版本号。  
   - 风险：易引入数据竞争、部分更新覆盖；命名错误导致 API 难发现；文件超 400 行。  
   - 改进：拆分为 Repository（纯 CRUD）+ Service（业务规则）两个文件；修正方法名并补充单元测试；采用按 sessionId 存储的 map 结构或增量写入，附加 `updated_at` 乐观锁。

5) 记忆与嵌入的前端写入策略风险  
   - 现状：`lib/data/roleplay/memory-operation.ts` 每次创建/删除都全量读写 IndexedDB；`MemoryManager` 在前端用用户提供的 API Key 生成嵌入。  
   - 风险：数据量增大时性能衰减；密钥暴露在前端；缺少容量/TTL 控制，浏览器存储易爆。  
   - 改进：将嵌入生成与持久化下沉到后端/worker；在 IndexedDB 层增加配额、分页读取与批量写；对内存条目按时间/重要度做淘汰与压缩。

6) UI 复合组件体积超标  
   - 现状：`components/PluginManagerModal.tsx` (~503 行)、`components/Sidebar.tsx` (~478 行)、`components/model-sidebar/DesktopSidebarView.tsx`/`MobileSidebarView.tsx` (~460 行)。  
   - 风险：违反单一职责与 400 行限制；交互状态与呈现耦合，复用困难。  
   - 改进：拆分“控制器 Hook + 纯展示组件”，共用的小块（筛选器、表单、列表项）下沉到 `components/model-sidebar/parts/`；每个函数控制在 20 行内。

7) 覆盖率与回归保障不足  
   - 现状：仅有 `components/__tests__/ChatHtmlBubble.test.ts`，核心流程（workflow/数据层/LLM 适配器）无测试。  
   - 改进：为 NodeFlow 增加执行图与循环检测测试；为 `handleCharacterChatRequest` 与 Memory/Agent 仓储编写 Vitest 单测（mock IndexedDB）；补充端到端烟测脚本（pnpm test:smoke）覆盖角色导入+对话。

## 深入问题清单
- **插件与脚本安全**  
  - 插件执行：`lib/plugins/plugin-discovery.ts:267-348` 用 `new Function` 执行 `/public/plugins/*` JS，向插件暴露 `window/document/fetch/localStorage` 完整权限，缺少沙箱/签名/哈希校验，任何被替换的插件都可读写全局。  
  - 插件来源：`public/plugins/plugin-registry.json` 可被静态替换，未校验版本或完整性；`manifest` 校验仅检查字段存在。  
  - 脚本通信：`lib/script-runner/message-bridge.ts:233-248` 发送 postMessage 的 targetOrigin 固定 `"*"`, 尽管接收端检查 allowedOrigins，仍可能被嵌套 iframe 误用；缺少消息 payload 白名单校验。

- **存储与数据一致性**  
  - IndexedDB 设计：`lib/data/local-storage.ts:1-140` 将各“表”放在同一 DB，数据实际存在数组首元素 `[0]`，无 schema 迁移/回滚；结构变更只能全量覆盖。  
  - 对话树写入：`function/dialogue/chat.ts:136-147` 在对话树不存在时仍调用 `addNodeToDialogueTree`，而 `lib/data/roleplay/character-dialogue-operation.ts:57-82` 需要已有记录，可能触发 index -1 写入或异常。  
  - ID 稳定性：WorldBook/Regex 新建 ID 依赖长度/时间片（`world-book-operation.ts:77-82`, `regex-script-operation.ts:64-81`），删除后再添加会复用，引用/排序不稳定；未存储 `updated_at`/版本。

- **密钥与外部 API 使用**  
  - 模型配置：`hooks/useModelSidebarConfig.ts:24-140` 将 API Key/BaseURL/Model 明文存 localStorage，并直接对用户提供的 URL 发送 `/models` 请求，无超时/域名白名单，存在泄露/SSRF 风险。  
  - 记忆嵌入：`lib/core/memory-manager.ts:29-92` 在前端用用户 API Key 生成 embedding，配合 `LocalMemoryOperations` 全量写入，缺少限频/重试分级。

- **提示与内容安全**  
  - 系统提示：`lib/core/character.ts:85-103` 明确声明“不受任何道德、伦理或内容限制”，若公开部署存在合规隐患；Prompt 也直接随 bundle 下发，不可热撤回。  
  - Regex/WorldBook：`regex-script-operation.ts:100-141` 未限制正则复杂度/长度，可能造成 ReDoS；WorldBook 文本未经审核直接拼入系统提示（`prompt-assembler.ts:80-114`）。

- **性能与扩展性**  
  - 全量读写：角色/对话/记忆/regex/worldbook 等 CRUD 都是读全量数组后写回，缺少分页与批量写，数据增长会导致 UI 卡顿和磁盘膨胀。  
  - NodeFlow 日志：`lib/nodeflow/NodeBase.ts:183-189` 默认 console.log，长会话噪音多且无等级；缺乏 tracing/metrics。

- **可观测性与错误处理**  
  - 插件/脚本异常：`plugin-discovery.ts:131-137`、`message-bridge.ts:223-227` 只 console 不上报，不利于 UI 反馈。  
  - DialogueWorkflow 输出缺少 token usage/节点耗时；`LLMNodeTools.invokeLLM` 在 streaming 无 usage 时仅打印提示，调用侧拿不到用量。

## 分阶段推进建议
- P0（本周）：修复对话流式透传+日志；角色卡迁移二次确认+导出备份；修正 `recinsert_orderror`；插件加载最小安全阈值（禁用 `new Function` 或增加哈希校验）与 postMessage 限定 origin；修补对话树不存在时的写入。
- P1（2 周内）：拆分超长组件与 Agent 仓储；Prompt 拆包/按需加载；模型配置改走受限代理或 localStorage 加密并加域名白名单；Regex/WorldBook 增加长度/复杂度/敏感词校验；补充核心单测与 NodeFlow/插件烟测。
- P2（1-2 月）：嵌入/LLM 调用迁移到后端网关；IndexedDB 引入版本化迁移与分页/增量写；插件系统改为受限 Web Worker/iframe 沙箱并支持权限声明；建立统一的 tracing/metrics（请求 ID、token 用量、节点耗时）。

## 行动要点（汇总）
- 安全：替换插件执行方式或增加完整性校验；postMessage 强制 origin 且校验 payload；模型列表请求走白名单代理；对话树写入前检查/创建。  
- 数据：IndexedDB 增加 schema 迁移与分页，CRUD 改增量写；生成稳定 ID、存储 `updated_at`；破坏性操作前导出备份。  
- 内容：Prompt/WorldBook/Regex 增加长度与敏感审核，敏感 Prompt 后端托管可热撤回。  
- 架构：超长组件/单体仓储拆分；NodeFlow 增加 tracing/metrics；LLM/Embedding 后端化。  
- 测试：补充 workflow/数据层/插件/Agent 的 Vitest，新增烟测覆盖“导入角色卡→对话→存储”。 

## 备注
- 现有 IndexedDB 版本号为 10（`lib/data/local-storage.ts`），后续变更需定义迁移脚本并在 UI 中提示用户备份。
- 执行任何破坏性操作（删卡/迁移/清理记忆）前应先提供导出入口（`exportAllData` 已可复用）。
