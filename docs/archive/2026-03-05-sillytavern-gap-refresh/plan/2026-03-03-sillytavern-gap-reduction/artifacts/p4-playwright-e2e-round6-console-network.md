# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 六轮 / session slash + refresh）

## 场景与步骤

- 运行标识：`p4r6-1772535993689`
- 执行入口：
  1. 执行 `scripts/p4-playwright-preflight.sh`。
  2. 启动 `pnpm dev`（`http://127.0.0.1:3303`）。
  3. 注入 `IndexedDB` 双会话测试数据（`session-a` / `session-b`）。
  4. 打开 `session-a` 输入 `/send P4 Round6 SlashPathMessage|/trigger`。
  5. 刷新 `session-a` 校验失败后的消息持久化。
  6. 切换到 `session-b` 校验会话隔离。

## 关键断言

- `/session` 输入 slash 文本后，UI 直接渲染原始输入（`/send ...|/trigger`），未走 slash 直达执行链路。
- 同一请求触发 LLM 路径并命中 `401`（无 API key，fail-fast）。
- 刷新后 `session-a` 仅保留 opening，上一条用户输入未持久化（暴露失败后持久化缺口）。
- 切换到 `session-b` 仅显示 `P4 Round6 Opening B`，无跨会话污染。

## Console 摘要

- 关键告警：
  - `找不到节点类型的工具类: userInput/pluginMessage/plugin/output`（基线噪音）。
- 关键错误：
  - `https://api.openai.com/v1/chat/completions -> 401`。
  - `Processing error: No response returned from workflow`。
- 结论：错误可见性满足 fail-fast，但 slash 直达与失败后持久化仍待补齐。

## Network 摘要

- 详情见：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-network.log`
- 核心链路：
  - `session-a/session-b` 页面请求 `200`。
  - 插件清单与脚本加载 `200`。
  - OpenAI 请求 `401`（预期失败注入）。
  - 背景图 `404`（非阻断噪音）。
