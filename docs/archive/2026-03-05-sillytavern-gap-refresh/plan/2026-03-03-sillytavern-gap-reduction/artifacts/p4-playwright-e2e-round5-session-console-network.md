# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 五轮 / session UI）

## 场景与步骤

- 运行标识：`p4r5-1772534891379`
- 执行入口：
  1. 启动 `pnpm dev`（`http://127.0.0.1:3303`）
  2. 在浏览器上下文注入 `IndexedDB` 测试数据（双角色 + 双会话）
  3. 打开 `/session?id=p4r5-1772534891379-session-a`
  4. 输入并提交 `P4 Round5 UI Message A2`
  5. 返回首页点击 `P4 Round5 Session B` 会话卡，进入 `/session?id=p4r5-1772534891379-session-b`

## 关键断言

- `/session` 页面真实 UI 可加载：`P4 Round5 Opening A/B` 正常渲染。
- 输入提交后 UI 立即出现用户消息：`P4 Round5 UI Message A2`。
- 会话切换后隔离成立：`session-b` 页面不包含 `session-a` 的用户消息。

## Console 摘要

- 总计：`192` 条日志（`Errors=6`, `Warnings=4`）。
- 关键错误：
  - `https://api.openai.com/v1/chat/completions -> 401`（无 API Key，符合当前测试环境预期）
  - `background_red.png/background_yellow.png -> 404`（非核心链路静态资源）
- 关键告警：节点工具类缺失提示 `userInput/pluginMessage/plugin/output`（已存在于当前基线，不阻断本轮断言）。

## Network 摘要

- 核心链路请求：
  - `/session?id=...`（RSC）=> `200`
  - `plugins/plugin-registry.json` / `plugins/dialogue-stats/*` => `200`
- 失败请求：
  - `POST https://api.openai.com/v1/chat/completions => 401`（预期失败注入路径）
  - 背景图 `404`（非阻断）
- 未观测到应用业务链路 `5xx`。
