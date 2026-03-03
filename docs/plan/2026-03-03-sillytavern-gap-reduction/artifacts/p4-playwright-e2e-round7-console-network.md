# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 七轮 / session 修复复验）

## 场景与步骤

- 运行标识：`p4r7-1772537441`
- 执行入口：
  1. 执行 `scripts/p4-playwright-preflight.sh`。
  2. 启动 `pnpm dev`（`http://127.0.0.1:3303`）。
  3. 注入 `IndexedDB` 双会话测试数据（`session-a` / `session-b`）。
  4. 打开 `session-a`，输入 `/send P4 Round7 SlashPathMessage|/trigger`。
  5. 刷新 `session-a`，复验用户消息是否仍保留。
  6. 切换到 `session-b`，复验跨会话隔离。

## 关键断言

- slash 直达链路命中：UI 渲染 `P4 Round7 SlashPathMessage`，不再渲染原始脚本文本（`/send ...|/trigger`）。
- 刷新一致性通过：刷新后 `session-a` 仍可见 `P4 Round7 SlashPathMessage`（用户输入未丢失）。
- 会话隔离保持：切换到 `session-b` 后仅显示 `P4 Round7 Opening B`，不出现 `session-a` 用户消息。

## Console 摘要

- 总计：`196` 条日志（`Errors=2`, `Warnings=0`）。
- 关键错误均为静态资源噪音：
  - `background_red.png -> 404`
  - `background_yellow.png -> 404`
- 未观测到 `No response returned from workflow` 类业务错误。

## Network 摘要

- 详情见：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-network.log`
- 核心链路：
  - `/session?id=...`（`session-a`/`session-b`）=> `200`
  - `plugins/plugin-registry.json` / `plugins/dialogue-stats/*` => `200`
- 非阻断噪音：
  - 背景图 `404`
  - Google Analytics `net::ERR_ABORTED`
- 本轮未出现 `api.openai.com/v1/chat/completions -> 401` 请求（符合 slash 直达不走普通 LLM 包装路径的预期）。
