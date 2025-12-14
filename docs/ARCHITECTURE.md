# DreamMiniStage 架构概览

> 基于当前仓库主分支的快速架构视图（Next.js 15 App Router + React 19）。

## 技术栈快照
- 前端框架：Next.js 15.2.4（App Router）、React 19、Turbopack 开发（默认端口 3303）
- UI：Tailwind CSS 4、Radix UI 组件、Shadcn 组合模式
- 状态：Zustand 5（`lib/store/*` + `contexts/`/`hooks/` 组合）
- LLM 接入：LangChain 0.3（OpenAI/Ollama/Gemini/FAL/Tavily/Jina），宏与预设系统自研
- 数据存储：浏览器 IndexedDB（`lib/data/local-storage.ts` 及 `lib/data/roleplay/*` 操作）
- 测试/质量：Vitest 3（`pnpm test` = `vitest run`）、ESLint 9、TypeScript strict

## 目录速览（与架构相关的核心路径）
- `app/`：Next.js App Router 页面与布局（主要为 client component）
- `components/`：UI 组件与复合模块（Radix/Shadcn 基础在 `components/ui/`）
- `function/`：服务端入口与数据操作 API（对话、预设、世界书、正则脚本等）
- `lib/`
  - `core/`：核心引擎（宏/预设/世界书/正则/记忆管理）
  - `prompt/`：STPromptManager 及 preset 工具
  - `nodeflow/` + `workflow/`：有向节点工作流执行与定义（对话流水线等）
  - `script-runner/`：脚本执行桥与事件管道
  - `plugins/`：插件发现与注册
  - `store/`：Zustand 状态仓库
  - `data/`：本地存储与业务数据操作（角色卡、对话树、记忆、regex、worldbook）
  - `vector-memory/`：向量记忆管理与 provider 封装
- `public/`：静态资源与内置预设/插件

## 核心子系统
- **宏与预设**：`lib/core/st-macro-evaluator.ts` 实现 ST 宏替换；`lib/core/prompt/manager.ts` (STPromptManager) 负责根据 preset/marker/worldbook 构建最终消息，支持模型特定转换与后处理。
- **世界书 / 正则**：`lib/core/world-book-advanced.ts` 提供关键词匹配、深度注入与时间效果；`lib/core/regex-processor.ts` 负责正则脚本解析与执行。
- **记忆与向量**：`lib/core/memory-manager.ts` 协调记忆检索/写入；`lib/vector-memory/*` 封装 embedding provider 与存储；对应数据操作在 `lib/data/roleplay/memory-operation.ts`。
- **工作流 (NodeFlow)**：`lib/nodeflow/*` 定义节点基类、上下文与执行；`lib/workflow/*` 包含对话等流水线配置；`function/dialogue/chat.ts` 等入口组装并运行流程。
- **脚本与插件**：`lib/script-runner/*` 提供脚本沙箱与事件桥；`lib/plugins/*` 负责插件发现/注册，`public/plugins` 作为默认插件目录。
- **状态与 UI**：Zustand store 位于 `lib/store/*`，通过 `contexts/` 和 `hooks/` 下沉到组件；UI 统一使用 `components/ui` 封装的 Radix/Shadcn 原子组件。

## 对话与请求流概览
1. 前端发起请求（角色会话/命令）→ `function/dialogue/*` 服务端处理入口。
2. 构建 NodeFlow 上下文：加载 preset、世界书、正则脚本、记忆与用户输入。
3. 通过 `PresetNode/ContextNode/WorldBookNode/LLMNode/RegexNode` 等节点逐步组装消息并调用模型。
4. 结果经后处理（正则/脚本/插件）后写回本地数据操作层（对话树、记忆、角色状态）。

## 数据与配置
- 环境变量示例见 `.env.example`，本地开发默认 `NEXT_PUBLIC_BASE_URL=http://localhost:3303`。
- 所有业务数据当前持久化在浏览器 IndexedDB；`lib/data/local-storage.ts` 统一管理数据库版本与表名。
- 预设/世界书/正则脚本/角色卡等可通过 `function/*` API 与本地操作类互通。

## 构建与测试
- 开发：`pnpm dev`（Turbopack，端口 3303）
- 构建：`pnpm build`
- 质量：`pnpm lint` / `pnpm lint:fix` / `pnpm typecheck`
- 测试：`pnpm test`（等价 `vitest run`）；单测建议使用 `pnpm vitest run path/to/file.test.ts`

## 关联文档
- `docs/MIGRATION_GUIDE.md`：从旧版/兼容模式迁移
- `docs/GETTING_STARTED.md`：环境与命令速查
- `docs/reports/architecture-review.md`：更详尽的巡检与风险清单
