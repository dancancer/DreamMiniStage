# Handoff（2026-03-06）

## 当前状态

- M1 / M2 / M3 已全部落地：
  - M1：高价值宿主注入位 + bridge 注入契约守卫已完成。
  - M2：`CharacterChatPanel` harness 与 `/session` 页面级最小集成守卫已完成（含 refresh-remount）。
  - M3：`scripts/p4-session-replay-e2e.mjs` 已扩到 round9，新增 `/floor-teleport` 宿主锚点滚动与 `/proxy` fail-fast 回放断言。
- 本轮（加固增量）已完成：
  - `/session` 的 `/proxy` 从 fail-fast 改为真实宿主路径：接入 `model-store`，支持读取当前 preset 与按 preset 名/ID 切换，并同步 `llmType/model/baseUrl/apiKey` 到 localStorage。
  - `/session` 为 `/translate` 与 `/yt-script` 增加宿主 provider 入口：`window.__DREAMMINISTAGE_SESSION_HOST__`；宿主已注入时走成功路径，未注入保持显式 fail-fast。
  - 页面级测试补齐成对守卫：
    - `/proxy`：成功切换 + unknown preset 失败。
    - `/yt-script`：provider 成功 + 未注入 fail-fast。
- Replay 回归现状：
  - 最新通过 run：`p4r11-1772804943599`。
  - 产物目录：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r11-1772804943599`。
  - run index 已更新：`p4-session-replay-run-index.json/.md`。
- 为让 replay 噪声基线恢复稳定，本轮顺手修复了 `/session` 页 header 注入循环源头：
  - `app/session/page.tsx` 将 `currentCharacter` 改为 `useMemo`，消除 render 周期对象重建导致的 effect 高频触发。
- `/session` 宿主能力清单（最新）：
  - 已接通：`tempchat`、`floor-teleport`、`proxy`。
  - provider 模式接通：`translate`、`yt-script`（依赖 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入真实能力）。
  - 故意 fail-fast：`wi-get-timed-effect`、`wi-set-timed-effect`。
- 本轮已验证：
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
  - `pnpm exec next lint --file app/session/page.tsx --file app/session/__tests__/page.slash-integration.test.tsx`
  - `pnpm typecheck`

## 推荐下一步

1. 为 `translate / yt-script` 选定默认 provider（或正式宿主注入协议文档），把“可注入成功”推进到“默认可用成功”。
2. 同步升级 P4 round9：把 `/proxy` 断言从 fail-fast 改为成功切换，并新增 `/yt-script` provider 成功回放场景，避免回归门与当前行为脱节。
3. `wi-* timed effect` 继续维持显式 fail-fast，先冻结 metadata 结构，再一次性接通，避免临时兼容分支。
