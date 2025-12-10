# 交付前检查
- 运行质量检查：`pnpm lint`（必要时 `pnpm lint:fix`），`pnpm typecheck`，`pnpm test`；涉及构建路径变更时 `pnpm build`/`pnpm build:pwa`。
- 确认无敏感信息：不要提交实际 API Key；确保 .env.local 未入库。
- UI/功能变更：自测关键流程（角色卡导入/聊天/插件/脚本）；如改 IndexedDB 结构，考虑数据迁移与备份提示。
- 样式/结构：遵守 Tailwind+Radix 组合与 2 空格/双引号/分号规范，组件/函数保持短小单责。
- 文档/记录：如行为/配置变化，更新相关 docs 或内联注释；准备简短变更说明与后续测试步骤。