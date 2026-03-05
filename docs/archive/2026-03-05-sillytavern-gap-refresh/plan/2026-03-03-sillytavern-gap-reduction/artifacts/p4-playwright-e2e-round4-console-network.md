# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 四轮）

## Console 摘要

- 总量：`31` 条；`Errors=0`，`Warnings=0`。
- 关键链路日志：
  - `[registerFunctionTool] Registered: p4_tool_echo ...`
  - `[registerFunctionTool] Registered: p4_tool_timeout ...`
  - `[/event-emit] Emitted: stage_change {source: p4-audio}`
- 四轮新增故障注入命中（预期失败并判定 PASS）：
  - `Command /reload-page failed: /reload-page is not available in current context`
  - `guard=before-fail` 且 `tail` 未写入（后续命令未执行）
  - 音频状态保持 `isPlaying=true`（`/audiostop` 被 fail-fast 截断）

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

- 四轮执行期间未出现 console error / warning。
- 主链路 + 5 条故障注入链路全部通过，P4 回归稳定性由 `8/8` 提升为 `9/9`。
