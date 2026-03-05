# P4 Playwright E2E Console + Network 摘要（2026-03-03 / 八轮 / 普通输入失败链路）

## 场景与步骤

- 运行标识：`p4r8-1772539665354`
- 执行入口：
  1. 执行 `scripts/p4-playwright-preflight.sh`（本轮也新增了 `pnpm p4:preflight` / `pnpm p4:session-dev` 固定入口）。
  2. 使用 Playwright 注入 `IndexedDB` 单会话测试数据（`session-a`）。
  3. 打开 `session-a`，发送普通文本 `P4 Round8 Plain401 Message A3`（非 slash 路径）。
  4. 在刷新前导出 `pre-refresh` console/network 原始日志。
  5. 刷新同一会话，验证用户消息是否仍保留。
  6. 导出刷新后 `post-refresh` console/network 原始日志与截图。

## 关键断言

- 普通输入失败链路命中：`pre-refresh` 日志出现 `https://api.openai.com/v1/chat/completions => 401`，并包含 `No response returned from workflow`。
- 刷新一致性通过：刷新后 UI 仍保留用户输入（`P4 Round8 Plain401 Message A2`、`P4 Round8 Plain401 Message A3`）。
- 结论：普通输入路径与七轮 slash 路径一致，均满足“先落库 user 节点，再执行 LLM，失败不丢输入”的持久化语义。

## Console 摘要

- `pre-refresh`：`Total messages: 195 (Errors: 4, Warnings: 4)`
  - 业务关键错误：`401`、`No response returned from workflow`（符合 fail-fast 预期）。
  - 非阻断警告：`找不到节点类型的工具类`（`userInput/pluginMessage/plugin/output`）。
- `post-refresh`：`Total messages: 140 (Errors: 0, Warnings: 0)`
  - 仅保留常规解析/插件日志，无新增业务错误。

## Network 摘要

- `pre-refresh` 关键请求：
  - `https://api.openai.com/v1/chat/completions => [401]`
  - `http://127.0.0.1:3303/__nextjs_original-stack-frames => [200]`
- `post-refresh` 核心链路：
  - `/session?id=... => 200`
  - `plugins/plugin-registry.json` / `plugins/dialogue-stats/* => 200`
- 非阻断噪音：GA 请求 `net::ERR_ABORTED`。

## 证据文件

- 刷新后通过截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-plain-refresh-pass.png`
- 刷新前日志：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-console.log`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-network.log`
- 刷新后日志：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-console.log`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-network.log`
