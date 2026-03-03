# P4 Playwright MCP E2E（2026-03-03 首轮 + 二轮）

## 1. 目标与范围

- 目标：在浏览器真实运行态验证 P4 主链路与故障注入链路。
- 页面入口：`/test-script-runner`。
- 场景执行实现：`app/test-script-runner/scenarios.ts`。

## 2. 场景映射（来自 test-baseline-assets）

| 场景 ID | 场景类型 | 能力链路 | 关联资产 | 通过标准 |
|---|---|---|---|---|
| `script-tool-loop` | 主链路 | `registerFunctionTool -> invokeFunctionTool -> iframe callback` | `test-baseline-assets/character-card/Sgw3.card.json` | 工具注册成功，回调返回 `echo:ping` |
| `slash-control-flow` | 主链路 | `/while` + `/if` + `{{getvar::}}` 宏条件 | `test-baseline-assets/character-card/Sgw3.card.json`、`test-baseline-assets/preset/明月秋青v3.94.json` | 最终 pipe 为 `control-flow-ok` 且 `i=3` |
| `mvu-variable-chain` | 主链路 | `replaceVariables -> updateVariablesWith -> insertVariables` | `test-baseline-assets/worldbook/服装随机化.json` | 更新结果保持 `hp=15`，插入后补齐 `nested.bonus/fresh` |
| `audio-event-chain` | 主链路 | `/audioimport -> /audioplay -> /event-emit` | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | 播放列表为 2 条、播放状态为 true、事件 detail 含 `source=p4-audio` |
| `tool-timeout-failfast` | 故障注入 | 未回调 tool call 的超时路径 | `test-baseline-assets/character-card/Sgw3.card.json` | 返回 `Function tool timeout` 错误并判定 PASS |
| `macro-unknown-failfast` | 故障注入 | 条件表达式未知宏路径 | `test-baseline-assets/preset/明月秋青v3.94.json` | 返回 `unsupported macro` 错误并判定 PASS |
| `reload-page-failfast` | 故障注入 | 宿主缺失 `/reload-page` 回调路径 | `test-baseline-assets/character-card/Sgw3.card.json` | 返回 `not available in current context` 错误并判定 PASS |

## 3. 执行步骤（Playwright MCP）

1. `pnpm dev` 启动开发服务器（端口 `3303`）。
2. Playwright MCP 打开 `http://127.0.0.1:3303/test-script-runner`。
3. 点击 `运行全部 P4 场景`。
4. 采集：页面全屏截图、console 消息、network 请求摘要。

## 4. 本轮结果

### 4.1 首轮（主链路）

- 汇总：`4/4` 场景通过，`0` 失败。

```json
{
  "phase": "P4-Playwright-MCP-E2E",
  "total": 4,
  "passed": 4,
  "failed": 0,
  "allPassed": true
}
```

### 4.2 二轮（主链路 + 故障注入）

- 汇总：`7/7` 场景通过，`0` 失败。
- 二轮执行时间：`2026-03-03T07:55:45.994Z` ~ `2026-03-03T07:55:46.103Z`。

```json
{
  "phase": "P4-Playwright-MCP-E2E",
  "total": 7,
  "passed": 7,
  "failed": 0,
  "allPassed": true
}
```

## 5. 证据资产

- 首轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
- 首轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`
- 二轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-pass.png`
- 二轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-console-network.md`

## 6. 备注

- 二轮已补齐故障注入最小集，避免只停留在 happy path。
- 仍未覆盖 `/session` 真实交互链路，建议作为下一轮重点（输入 slash -> UI 反馈 -> 状态验证）。
