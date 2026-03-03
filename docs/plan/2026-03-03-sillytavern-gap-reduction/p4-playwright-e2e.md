# P4 Playwright MCP E2E（2026-03-03 首轮）

## 1. 目标与范围

- 目标：在浏览器真实运行态验证 P4 四条主场景（脚本工具、Slash 控制流、MVU 变量链路、音频事件链路）。
- 页面入口：`/test-script-runner`。
- 场景执行实现：`app/test-script-runner/scenarios.ts`。

## 2. 场景映射（来自 test-baseline-assets）

| 场景 ID | 能力链路 | 关联资产 | 通过标准 |
|---|---|---|---|
| `script-tool-loop` | `registerFunctionTool -> invokeFunctionTool -> iframe callback` | `test-baseline-assets/character-card/Sgw3.card.json` | 工具注册成功，回调返回 `echo:ping` |
| `slash-control-flow` | `/while` + `/if` + `{{getvar::}}` 宏条件 | `test-baseline-assets/character-card/Sgw3.card.json`、`test-baseline-assets/preset/明月秋青v3.94.json` | 最终 pipe 为 `control-flow-ok` 且 `i=3` |
| `mvu-variable-chain` | `replaceVariables -> updateVariablesWith -> insertVariables` | `test-baseline-assets/worldbook/服装随机化.json` | 更新结果保持 `hp=15`，插入后补齐 `nested.bonus/fresh` |
| `audio-event-chain` | `/audioimport -> /audioplay -> /event-emit` | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | 播放列表为 2 条、播放状态为 true、事件 detail 含 `source=p4-audio` |

## 3. 执行步骤（Playwright MCP）

1. `pnpm dev` 启动开发服务器（端口 `3303`）。
2. Playwright MCP 打开 `http://127.0.0.1:3303/test-script-runner`。
3. 点击 `运行全部 P4 场景`。
4. 采集：页面全屏截图、console 消息、network 请求摘要。

## 4. 本轮结果

- 汇总：`4/4` 场景通过，`0` 失败。
- 页面报告关键字段：

```json
{
  "phase": "P4-Playwright-MCP-E2E",
  "total": 4,
  "passed": 4,
  "failed": 0,
  "allPassed": true
}
```

## 5. 证据资产

- 截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
- 日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`

## 6. 备注

- 本轮未出现失败场景，因此“失败截图”为空。
- 已固定成功态截图与 console/network 基线，可在后续回归中对比差异并定位新回归。
