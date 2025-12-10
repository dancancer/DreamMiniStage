# 环境与配置
- Node.js ≥16，包管理优先 pnpm；Darwin 系统常规工具可用。
- 复制示例：`cp .env.example .env.local` 并填入：
  - `NEXT_PUBLIC_API_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_URL`（本地默认 http://localhost:3000）
  - `NEXT_PUBLIC_GEMINI_API_KEY` / `NEXT_PUBLIC_GEMINI_API_BASE_URL`
  - `NEXT_PUBLIC_TAVILY_API_KEY`, `NEXT_PUBLIC_JINA_API_KEY`, `NEXT_PUBLIC_FAL_API_KEY`
  - 其他 OAuth 占位可留空或补充
- 开发：`pnpm dev` 默认端口 3303（Turbopack）。
- 输出：`next.config.ts` 设置 `output: "export"` + PWA；图片未优化，调试时注意体积。
- 存储：IndexedDB 版本 10，无迁移机制；改 schema 时需提供迁移/备份策略。