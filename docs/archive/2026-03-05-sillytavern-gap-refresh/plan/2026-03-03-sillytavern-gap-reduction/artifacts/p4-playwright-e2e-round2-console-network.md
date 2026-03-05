# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 二轮）

## Console 摘要

- 总量：`63` 条；`Errors=0`，`Warnings=0`。
- 关键链路日志：
  - `[registerFunctionTool] Registered: p4_tool_echo ...`
  - `[registerFunctionTool] Registered: p4_tool_timeout ...`
  - `[/event-emit] Emitted: stage_change {source: p4-audio}`
- 二轮故障注入已触发并被识别为预期失败：
  - `Function tool timeout: p4_tool_timeout`
  - `unsupported macro {{unknown::p4_case}}`
  - `/reload-page is not available in current context`

## Network 摘要

- 本地核心请求：
  - `GET /plugins/plugin-registry.json -> 200`
  - `GET /plugins/dialogue-stats/manifest.json -> 200`
  - `GET /plugins/dialogue-stats/main.js -> 200`
- 外部请求（统计）：
  - `POST https://www.google-analytics.com/g/collect -> 302/204`
  - `GET https://www.google-analytics.com/privacy-sandbox/register-conversion -> 204`
- 未观察到业务链路相关的 `4xx/5xx` 失败请求。

## 结论

- 二轮执行期间未出现 console error / warning。
- 主链路与故障注入链路均可稳定复现，可作为 P4 轮次 diff 基线。
