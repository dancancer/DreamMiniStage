# Handoff（2026-03-06）

## 当前状态

- M1 已完成；M2 也完成组件级与页面级最小集成守卫：
  - `CharacterChatPanel` harness 已覆盖 `tempchat / translate / proxy / yt-script / wi-get-timed-effect / wi-set-timed-effect / floor-teleport` 的 slash -> hook -> host callback 链路。
  - `/session` 页面级用例已覆盖输入执行、错误回显、消息定位，以及 refresh-remount 后 `floor-teleport` 继续可用。
- `/session` 宿主能力清单已明确分组：
  - 已接通：`tempchat`、`floor-teleport`（复用 `chat-jump` 锚点滚动）。
  - 待接通：`translate`、`proxy`、`yt-script`。
  - 故意 fail-fast：`wi-get-timed-effect`、`wi-set-timed-effect`（缺少稳定的 timed effect metadata 设计，先不接）。
- 本轮已验证：
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
  - `pnpm vitest run components/__tests__/CharacterChatPanel.bridge.test.tsx`
  - `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts`

## 推荐下一步

1. 进入 M3：基于 `scripts/p4-session-replay-e2e.mjs` 新增一轮 `/session` replay case，并把 refresh 持久化与失败链路一起纳入 artifact。
2. 在页面宿主里优先接通 `proxy` 与 `yt-script`，然后补对应页面级成功路径断言，形成“成功 + fail-fast”双边守卫。
3. `wi-* timed effect` 继续保持显式 fail-fast，先补设计约束（metadata shape + 生命周期）再实现，避免兼容分支扩散。
