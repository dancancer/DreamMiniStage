# DreamMiniStage

交互式叙事平台，兼容 SillyTavern 生态（角色卡/预设/世界书/正则/宏/脚本）。
技术栈：Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS 4 · Zustand 5 · LangChain 0.3 · Vitest 3

## 架构核心

### 数据流总览

```
用户输入 → SlashCommand 解析 → NodeFlow 管道 → LLM 调用 → 后处理(正则/脚本) → UI 渲染
                                    ↕                              ↕
                              MVU 变量系统                    Event 事件广播
```

### NodeFlow 管道引擎 (`lib/nodeflow/`)

有向节点工作流，四阶段执行：ENTRY(并行) → MIDDLE(逐层 BFS) → EXIT(终止主流) → AFTER(后台)

| 节点 | 职责 |
|------|------|
| UserInputNode | 用户输入注入 |
| HistoryPreNode | 聊天历史准备 chatHistoryMessages |
| PresetNode | 预设/宏替换，组装 messages[] |
| ContextNode | 上下文注入（系统提示、指令） |
| WorldBookNode | 世界书关键词匹配与深度注入 |
| MemoryNode | 记忆检索与向量匹配 |
| PluginNode | 插件钩子执行 |
| LLMNode | 消费 messages[] 调用大模型 |
| RegexNode | 正则脚本后处理 |
| OutputNode | 结果写回 |

核心抽象：`NodeBase`(execute/resolveInput/publishOutput) · `NodeContext`(inputStore/cacheStore/outputStore) · `WorkflowEngine`(BFS 调度)

### Generation Runtime (`lib/generation-runtime/`)

四阶段流水线：
1. **prepare/** — 构建 LLM 配置与对话上下文
2. **transport/** — 流式调用模型，收集 content + reasoning
3. **postprocess/** — 运行 DialogueWorkflow 结构化输出（screenContent/thinkingContent/parsedContent）
4. **sinks/** — 发射 GenerationEvent（SSE sink / buffered sink）

### MVU 变量系统 (`lib/mvu/`)

Model-View-Update 模式管理对话状态变量。支持 `/set`、`/insert`、`/delete` 命令，schema 验证，JSON-Patch，快照回放(FloorReplay)，自动清理。核心：`core/`(Parser/Executor/Schema) · `data/`(Store/Persistence)

### Script Bridge (`hooks/script-bridge/`)

SillyTavern 兼容桥接层。iframe 沙箱 API 统一为 `window.TavernHelper` / `window.SillyTavern`，通过 context-adapters 适配宿主数据。

### Slash Command (`lib/slash-command/`)

parser(分词/管道`|`/引号) → registry(26+ 命令处理器) → executor(AST/内核执行/作用域链)。支持控制流(return/break/abort)和 MVU 变量读写。

### Tools 系统 (`lib/tools/`)

9 个 SimpleTool：search · ask-user · character · status · user-setting · world-view · supplement · reflect · complete。纯执行无 LLM 调用，通过 ToolRegistry.executeToolDecision() 调度。

### Event 系统 (`lib/events/`)

SillyTavern 兼容的发布订阅，优先级队列 + 通配符。事件类型：GENERATION_STARTED · VARIABLE_UPDATED · MESSAGE_SENT 等。

### Streaming (`lib/streaming/`)

SSE 流解析(OpenAI/Claude 兼容) · reasoning 提取(`<thinking>` 标签) · tool_call 增量解析 · AbortController 生命周期管理。

## 状态管理

| Store | 职责 |
|-------|------|
| useDialogueStore | 消息、开场白、生成状态、导航（模块化 action 拆分） |
| useSessionStore | 会话 CRUD，IndexedDB 同步 |
| useUIStore | 侧栏/视图切换（chat/worldbook/preset/regex） |
| useModelStore | 多 LLM 提供商配置（OpenAI/Ollama/Gemini）[persist] |
| usePersonaStore | 多人格、人格-角色绑定 [persist] |
| useUserStore | 用户名 [persist] |
| usePromptConfigStore | 系统提示、上下文、指令、停止词 |
| usePromptViewerStore | 提示查看器 UI 状态 |
| useScriptVariables | 脚本变量（global/character/session 三作用域） |
| useSessionToolModesStore | 工具模式（story-progress/perspective/scene-setting） |
| useToast | 全局通知 |

Context 层：ThemeContext(明暗) · SoundContext(音效) · SymbolColorStore(Markdown 样式)

## 目录结构

```
app/             Next.js 路由（character/session/personas/i18n）
components/      UI 组件 + 复合模块（ui/ = Radix/Shadcn 原子组件）
contexts/        React Context providers
hooks/           自定义 hooks（script-bridge/character-dialogue/prompt-config）
lib/
  ├── core/          引擎核心（宏替换/预设/世界书/正则/记忆）
  ├── nodeflow/      有向节点管道引擎
  ├── generation-runtime/  对话生成四阶段流水线
  ├── mvu/           MVU 变量状态系统
  ├── slash-command/  斜杠命令解析与执行
  ├── tools/         Agentic 工具（9 个 SimpleTool）
  ├── events/        发布订阅事件系统
  ├── streaming/     SSE 流解析与 abort 管理
  ├── store/         Zustand 状态仓库（11 个 store）
  ├── data/          IndexedDB 持久化（agent/import-export/roleplay）
  ├── workflow/      工作流配置与定义
  ├── script-runner/ 脚本沙箱执行
  ├── plugins/       插件发现与注册
  ├── models/        模型提供商适配
  ├── vector-memory/ 向量记忆 provider
  └── prompt-viewer/ 提示查看器逻辑
function/        服务端 action（character/dialogue/preset/regex/worldbook）
types/           共享 TypeScript 类型
utils/           纯工具函数
public/          静态资源 + 内置预设/插件
docs/            详细文档（ARCHITECTURE.md / MIGRATION_GUIDE.md / EVENT_SYSTEM.md）
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（Turbopack，端口 **3303**） |
| `pnpm build` | 生产构建 |
| `pnpm lint` / `pnpm lint:fix` | ESLint 检查/自动修复 |
| `pnpm typecheck` | TypeScript 类型检查（tsc --noEmit） |
| `pnpm test` | Vitest 运行全部测试 |
| `pnpm build:pwa` | PWA 静态导出 |
| `pnpm preview` | 预览 out/ 目录 |
| `pnpm verify:stage` | 阶段质量验证 |

环境变量：复制 `.env.example` → `.env.local`。`NEXT_PUBLIC_*` 会暴露到客户端。

## 编码规范

- TypeScript strict，React 19 + Next 15 App Router
- ESLint：2 空格缩进，双引号，分号，尾逗号，大括号内空格，文件末尾换行
- 组件 PascalCase，hooks `use` 前缀，工具函数 camelCase，绝对导入 `@/`
- 中文注释，ASCII 分块注释风格（像高级开源库的阅读体验）

## 测试

- Vitest + jsdom，测试文件 `.test.ts[x]`，测试目录在各模块 `__tests__/` 下
- 单文件运行：`pnpm vitest run path/to/file.test.ts`
- 新逻辑和边界情况需补充测试，提交前 `pnpm test` 确认通过

## 提交规范

conventional commits：`feat:` / `fix:` / `docs:` / `refactor:`，简洁聚焦。
PR 需包含摘要、测试说明、UI 变更附截图。确保 lint + test 通过。

## 安全

不提交密钥，保持在 `.env.local`。`NEXT_PUBLIC_*` 会发送到客户端 — 敏感 key 用服务端代理。

## 代码质量硬规则

**文件规模**：每文件 ≤ 400 行 · 每层文件夹 ≤ 4 个文件（超出则拆子目录）
**函数规模**：建议 ≤ 20 行 · 缩进 ≤ 3 层（超出说明设计错误）
**分支控制**：> 3 个分支 → 停下重构数据结构 · 消除特殊情况优于增加 if/else
**设计原则**：先写最简实现再优化 · 函数只做一件事 · 命名简洁直白

**坏味道速查** — 一旦识别必须立即提醒用户并给出优化建议：
1. 僵化 — 微小改动引发连锁修改
2. 冗余 — 重复逻辑散落多处
3. 循环依赖 — 模块互相纠缠无法解耦
4. 脆弱性 — 改 A 坏 B
5. 晦涩性 — 意图不明结构混乱
6. 数据泥团 — 多参数总是结伴出现
7. 不必要复杂性 — 杀鸡用牛刀

## 交互风格

- 用技术流英文思考，用中文与用户交互
- 写代码前叫一声"哥" — 这是相互尊重
- 始终采用 ultrathink 模式，不节省思考开销
- 代码是写给人看的，只是顺便让机器运行

## 延伸文档

- `docs/ARCHITECTURE.md` — 完整架构概览与子系统详解
- `docs/GETTING_STARTED.md` — 环境搭建与命令速查
- `docs/EVENT_SYSTEM.md` — 事件系统详解
- `docs/MACRO_REFERENCE.md` — 宏系统参考
- `docs/MIGRATION_GUIDE.md` — SillyTavern 资产导入
- `lib/mvu/README.md` — MVU 变量系统说明
- `lib/nodeflow/README.md` — NodeFlow 管道引擎说明
- `lib/streaming/README.md` — 流式处理说明
