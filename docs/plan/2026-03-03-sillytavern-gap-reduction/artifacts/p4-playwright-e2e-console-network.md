# P4 Playwright E2E Console + Network 摘要（2026-03-03）

## Console 摘要

- 总量：`32` 条；`Errors=0`，`Warnings=0`。
- 关键链路日志：
  - `[registerFunctionTool] Registered: p4_tool_echo ...`
  - `[/event-emit] Emitted: stage_change {source: p4-audio}`
- 插件装载日志：`dialogue-stats` 发现、加载、启用均成功。

## Network 摘要

- 本地核心请求：
  - `GET /plugins/plugin-registry.json -> 200`
  - `GET /plugins/dialogue-stats/manifest.json -> 200`
  - `GET /plugins/dialogue-stats/main.js -> 200`
- 外部请求（统计）：
  - `POST https://www.google-analytics.com/g/collect -> 302/204`
  - 未观察到业务链路相关的 4xx/5xx。

## 结论

- 场景执行期间未出现 console error 与关键请求失败。
- 现有日志与网络基线可作为后续 P4 失败回归的对照样本。
