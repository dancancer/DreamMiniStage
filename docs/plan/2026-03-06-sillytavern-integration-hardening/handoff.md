# Handoff（2026-03-07）

## 当前状态

- M1 / M2 / M3 已全部落地：
  - M1：高价值宿主注入位 + bridge 注入契约守卫已完成。
  - M2：`CharacterChatPanel` harness 与 `/session` 页面级最小集成守卫已完成（含 refresh-remount）。
  - M3：`scripts/p4-session-replay-e2e.mjs` 已扩到 round12，当前覆盖 `/floor-teleport` 宿主锚点滚动、`/proxy` 成功切换、`/proxy unknown preset` fail-fast、`/yt-script` provider 成功路径、`/translate` provider 成功路径，以及 `translate/yt-script` provider 未注入 fail-fast 路径。
- 本轮（加固增量）已完成：
  - `/session` 的 `/proxy` 从 fail-fast 改为真实宿主路径：接入 `model-store`，支持读取当前 preset 与按 preset 名/ID 切换，并同步 `llmType/model/baseUrl/apiKey` 到 localStorage。
  - `/session` 为 `/translate` 与 `/yt-script` 增加宿主 provider 入口：`window.__DREAMMINISTAGE_SESSION_HOST__`；宿主已注入时走成功路径，未注入保持显式 fail-fast。
  - 页面级测试补齐成对守卫：
    - `/proxy`：成功切换 + unknown preset 失败。
    - `/translate`：provider 成功 + 未注入 fail-fast。
    - `/yt-script`：provider 成功 + 未注入 fail-fast。
- 本轮（回归门对齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` round9 从 `/proxy` fail-fast 断言切换为成功断言，补入 `model-config-storage` 种子并校验 `activeConfigId + llmType/model/baseUrl/apiKey` 同步结果。
  - round9 新增 `/yt-script` provider 成功回放：注入 `window.__DREAMMINISTAGE_SESSION_HOST__.getYouTubeTranscript` 探针并断言 URL/lang 透传。
  - round10 新增 `/translate` provider 成功回放：注入 `window.__DREAMMINISTAGE_SESSION_HOST__.translateText` 探针并断言 text/target/provider 透传。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round9-proxy-switch-pass.png`
    - `round9-yt-script-provider-pass.png`
    - `round10-translate-provider-pass.png`
- 本轮（Replay 负向回归门补齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` 新增 round11 `/translate` 未注入 provider 回放，断言 `/session` 页面显式暴露 `/translate is not wired in /session host yet`。
  - round11 新增 `/yt-script` 未注入 provider 回放，断言 `/yt-script is not wired in /session host yet`，补齐成功/失败双向回归门。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round11-translate-provider-failfast-pass.png`
    - `round11-yt-script-provider-failfast-pass.png`
- 本轮（Proxy 负向回归门补齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` 新增 round12 `/proxy missing-profile` 回放，断言 `/session` 页面显式暴露 `/proxy preset not found: missing-profile`。
  - round12 在负向断言前先显式执行一次 `/proxy Default Proxy`，将回放状态重置到已知 preset，随后校验 bad preset 失败后 `model-config-storage + llmType/model/baseUrl/apiKey` 保持不变。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round12-proxy-unknown-preset-failfast-pass.png`
- Replay 回归现状：
  - 最新通过 run：`p4r14-1772882882394`。
  - 产物目录：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r14-1772882882394`。
  - run index 已更新：`p4-session-replay-run-index.json/.md`。
- 为让 replay 噪声基线恢复稳定，本轮顺手修复了 `/session` 页 header 注入循环源头：
  - `app/session/page.tsx` 将 `currentCharacter` 改为 `useMemo`，消除 render 周期对象重建导致的 effect 高频触发。
- `/session` 宿主能力清单（最新）：
  - 已接通：`tempchat`、`floor-teleport`、`proxy`。
  - provider 模式接通：`translate`、`yt-script`（依赖 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入真实能力）。
  - 故意 fail-fast：`wi-get-timed-effect`、`wi-set-timed-effect`。
- 本轮已验证：
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx`
  - `pnpm p4:session-replay`（最新 run：`p4r14-1772882882394`）

## 推荐下一步

1. 为 `translate / yt-script` 选定默认 provider，或至少补一份正式的 `window.__DREAMMINISTAGE_SESSION_HOST__` 协议文档，把“可注入成功”推进到“默认可用成功”。
2. 若继续扩 replay，优先把宿主桥接协议文档里的默认 provider 场景做成固定种子，避免 provider 成功路径只依赖临时注入探针。
3. `wi-* timed effect` 继续维持显式 fail-fast，先冻结 metadata 结构，再一次性接通，避免临时兼容分支。
