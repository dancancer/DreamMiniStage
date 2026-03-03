# P4 Playwright MCP E2E（2026-03-03 首轮 + 二轮 + 三轮 + 四轮 + 五轮 + 六轮）

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
| `audio-callback-missing-failfast` | 故障注入 | 宿主缺失 `/audioplay` 音频回调路径 | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | 返回 `/audioplay is not available in current context` 并判定 PASS |
| `chain-failfast-consistency` | 故障注入 | 多命令串联中段失败的状态一致性路径 | `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json` | `guard` 写入成功、`tail` 未写入、音频状态保持不变 |

### 2.1 五轮附加场景（真实 `/session` UI）

| 场景 ID | 场景类型 | 能力链路 | 关联资产 | 通过标准 |
|---|---|---|---|---|
| `session-ui-input-switch` | 主链路 + 故障注入 | `/session` 输入提交 -> 用户消息渲染 -> 首页卡片切换会话 -> 状态隔离 | `IndexedDB` 注入双角色/双会话测试数据 | `session-a` 可渲染输入消息；切换到 `session-b` 后不出现 `session-a` 的用户消息 |

### 2.2 六轮附加场景（真实 `/session` UI 审计）

| 场景 ID | 场景类型 | 能力链路 | 关联资产 | 验收标准 |
|---|---|---|---|---|
| `session-ui-slash-direct-audit` | 现状审计 | `/session` 输入 slash 指令（`/send ...|/trigger`） | `IndexedDB` 注入双角色/双会话测试数据 | 明确记录是“slash 直达执行”还是“普通输入走 LLM” |
| `session-ui-refresh-persistence-audit` | 故障注入审计 | 输入提交触发 `401` -> 页面刷新 -> 重进会话 | 同上 | 明确记录失败后用户输入是否持久化 |
| `session-ui-switch-isolation-recheck` | 回归复验 | 切换 `session-a -> session-b` | 同上 | `session-b` 不出现 `session-a` 输入（隔离不回退） |

## 3. 执行步骤（Playwright MCP）

1. 执行 `scripts/p4-playwright-preflight.sh` 清理 `mcp-chrome/Playwright` 残留进程。
2. `pnpm dev` 启动开发服务器（端口 `3303`）。
3. Playwright MCP 打开 `http://127.0.0.1:3303/test-script-runner` 并执行既有场景。
4. 五轮额外打开 `/session`，注入测试数据并执行“输入提交 + 会话切换”链路。
5. 六轮在 `/session` 追加“slash 输入链路 + 刷新后持久化 + 会话隔离复验”审计。
6. 采集：页面全屏截图、console 消息、network 请求摘要。

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

### 4.3 三轮（补齐音频回调缺失注入）

- 汇总：`8/8` 场景通过，`0` 失败。
- 三轮执行时间：`2026-03-03T08:21:28.328Z` ~ `2026-03-03T08:21:28.437Z`。

```json
{
  "phase": "P4-Playwright-MCP-E2E",
  "total": 8,
  "passed": 8,
  "failed": 0,
  "allPassed": true
}
```

### 4.4 四轮（串联命令 fail-fast 一致性注入）

- 汇总：`9/9` 场景通过，`0` 失败。
- 四轮执行时间：`2026-03-03T08:37:15.779Z` ~ `2026-03-03T08:37:15.890Z`。

```json
{
  "phase": "P4-Playwright-MCP-E2E",
  "total": 9,
  "passed": 9,
  "failed": 0,
  "allPassed": true
}
```

### 4.5 五轮（`/session` 真实 UI：输入提交 + 会话切换隔离）

- 汇总：`1/1` 附加场景通过（与前四轮 `9/9` 形成互补覆盖）。
- 五轮执行时间：`2026-03-03T10:47:xxZ` ~ `2026-03-03T10:51:xxZ`。
- 关键断言：
  - `session-a` 渲染 `P4 Round5 Opening A`，输入 `P4 Round5 UI Message A2` 后消息立即出现在 UI。
  - 切换到 `session-b` 渲染 `P4 Round5 Opening B`，且不出现 `session-a` 的用户消息（无跨会话污染）。
  - API 未配置路径命中 `401`（fail-fast），但不阻断本轮 UI 断言链路。

```json
{
  "phase": "P4-Playwright-MCP-E2E-session-ui",
  "total": 1,
  "passed": 1,
  "failed": 0,
  "allPassed": true
}
```

### 4.6 六轮（`/session` slash 直达 + 失败后刷新一致性审计）

- 汇总：`3` 条审计检查全部执行完成，其中 `1` 条维持通过，`2` 条暴露缺口。
- 六轮执行时间：`2026-03-03T11:06:xxZ` ~ `2026-03-03T11:10:xxZ`。
- 关键结论：
  - `session-ui-slash-direct-audit`：当前输入 `/send ...|/trigger` 会作为普通用户消息写入并进入 LLM 链路，**未打通 slash 直达执行**。
  - `session-ui-refresh-persistence-audit`：`401` 失败后刷新，`session-a` 仅保留 opening，用户刚提交的输入消失，**存在失败后持久化缺口**。
  - `session-ui-switch-isolation-recheck`：切换到 `session-b` 后未出现 `session-a` 输入，**隔离语义仍成立**。

```json
{
  "phase": "P4-Playwright-MCP-E2E-session-ui-round6-audit",
  "checks": 3,
  "passed": 1,
  "findings": 2,
  "allExecuted": true
}
```

## 5. 证据资产

- 首轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
- 首轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`
- 二轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-pass.png`
- 二轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-console-network.md`
- 三轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-pass.png`
- 三轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-console-network.md`
- 四轮截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-pass.png`
- 四轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-console-network.md`
- 四轮原始日志：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-console.log`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-network.log`
- 五轮截图（输入提交）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-input-pass.png`
- 五轮截图（会话切换）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-pass.png`
- 五轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console-network.md`
- 五轮原始日志：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console.log`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-network.log`
- 六轮截图（slash 输入现状）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-slash-input-raw-path.png`
- 六轮截图（刷新后状态）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-refresh-state.png`
- 六轮截图（会话隔离复验）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-session-b-isolation-pass.png`
- 六轮日志摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console-network.md`
- 六轮原始日志：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console.log`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-network.log`
- 五轮前置清理脚本：`scripts/p4-playwright-preflight.sh`

## 6. 备注

- 五轮已补齐 `/session` 真实 UI 最小链路（输入提交 + 会话切换隔离），P4 回归资产从“脚本执行页”扩展到“真实交互页”。
- 六轮已将“slash 直达执行 + 失败后刷新一致性”从建议项推进为已执行审计项，并固化证据。
- 当前待修复缺口：
  1. `/session` 输入 slash 仍走普通输入链路，未命中 slash 执行器。
  2. `401` 失败后用户输入未持久化，刷新后会话状态与提交前不一致。
