# 常用命令
- 安装依赖（推荐）：`pnpm install`
- 开发：`pnpm dev`（Next Turbopack，端口 3303）
- 构建：`pnpm build`；PWA：`pnpm build:pwa` → `pnpm preview`
- 质量：`pnpm lint` / `pnpm lint:fix`，`pnpm typecheck`，`pnpm test`（Vitest）
- 工具脚本：`pnpm verify:migration`（Zustand 迁移检查），`pnpm pake-mac|pake-linux|pake-win`（桌面封装），`docker-compose up --build`（容器）
- 环境变量模板：`cp .env.example .env.local` 后填充 `NEXT_PUBLIC_*` API/URL
- 打包预览静态：`pnpm preview`（需先有 out/）