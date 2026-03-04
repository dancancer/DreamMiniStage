# Handoff（2026-03-04 / 主线回归轮）

## 本轮完成（主链路优先）

- 已按“先主线、后基建”回归执行，停止新增 CI 方向改造。
- 本轮核心修复：补齐 `registerSlashCommand` 的 iframe 回调闭环，解决 `hasCallback + iframeId` 注册后在宿主侧无法真正执行的问题。
- 修复落点：
  - `hooks/script-bridge/extension-handlers.ts`
    - 新增 `SLASH_COMMAND_CALL -> SLASH_COMMAND_RESULT` pending/timeout 机制。
    - `registerSlashCommand` 支持 `hasCallback` 与 `iframeId`，并在缺失回调路径时 fail-fast。
    - `clearIframeSlashCommands` 增加未完成回调清理，避免 iframe 卸载后悬挂 promise。
  - `components/ScriptSandbox.tsx`
    - 新增 `SLASH_COMMAND_RESULT` 消息处理，回传到 extension-handlers。
  - `public/iframe-libs/slash-runner-shim.js`
    - `registerSlashCommand` 统一透传 `iframeId`。
    - 新增 `SLASH_COMMAND_CALL` 处理分支，支持同步/异步 callback 回传。
  - `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`
    - 新增 iframe callback 闭环回归用例。
    - 新增“无 callback 路径 fail-fast”用例。

## 方向调整（按用户要求）

- 本项目当前不继续投入 CI 功能扩展；保留已有可监测回归基线即可。
- P4 基建在“可监测”层面暂时冻结，后续优先投入 gap 主线能力收敛。

## 本轮验证（命令级）

```bash
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
pnpm vitest run lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：全部通过。

## 优先级判断与下一步建议（主线）

1. 优先收敛 `registerSlashCommand` 参数语义与上游等价性（`namedArgumentList/unnamedArgumentList` 的执行期约束与错误语义）。
2. 优先推进 parser 深语义缺口（`flags/debug/scope chain`），先补最小可迁移子集并配基线用例。
3. 在不新增 CI 投入前提下，保持 `p4-session-replay` 作为回归基线，仅在主线修复后按需复跑。

---

## 历史记录（简版）

- 本轮：`registerSlashCommand` iframe callback 闭环修复 + 方向回归主线。
- 十一轮 P4：新增 run-index 与规则健康审计，`11/11` 通过，新增噪音 `0`、stale 规则 `0`。
- 十轮 P4：新增噪音基线差分门禁，`11/11` 通过，新增噪音 `0`。
- 九轮 P4：round7+8 自动回放脚本落地并接入 CI，`10/10` 通过。
- 八轮 P4：普通输入 `401` 失败链路独立证据补齐，刷新后用户输入持久化通过。
- 七轮 P4：`/session` 修复复验 `3/3` 通过（slash 直达、刷新持久化、会话隔离）。
- 六轮 P4：审计链路 `3/3` 已执行，确认两项缺口（slash 直达未命中、失败后输入未持久化）。
- 五轮 P4：`/session` 真实 UI 场景 `1/1` 通过。
- P2/P3 指标门槛维持达标：Slash `30.23%`，TavernHelper API `60.77%`。
