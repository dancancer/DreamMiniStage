# Handoff（2026-03-07）

## 当前状态

- M1 / M2 / M3 已全部落地：
  - M1：高价值宿主注入位 + bridge 注入契约守卫已完成。
  - M2：`CharacterChatPanel` harness 与 `/session` 页面级最小集成守卫已完成（含 refresh-remount）。
  - M3：`scripts/p4-session-replay-e2e.mjs` 已扩到 round13，当前覆盖 `/floor-teleport` 宿主锚点滚动、`/proxy` 成功切换、`/proxy unknown preset` fail-fast、`/yt-script` 默认 provider 成功路径、`/translate` 默认 provider 成功路径、`/wi-set-timed-effect` 成功路径，以及对应负向守卫。
- 本轮（加固增量）已完成：
  - `/session` 的 `/proxy` 从 fail-fast 改为真实宿主路径：接入 `model-store`，支持读取当前 preset 与按 preset 名/ID 切换，并同步 `llmType/model/baseUrl/apiKey` 到 localStorage。
  - `/session` 为 `/translate` 与 `/yt-script` 增加宿主 provider 入口：`window.__DREAMMINISTAGE_SESSION_HOST__`；外部宿主已注入时优先走注入实现，未注入时回退到页面默认 provider（若页面默认不存在则继续 fail-fast）。
  - 页面级测试补齐成对守卫：
    - `/proxy`：成功切换 + unknown preset 失败。
    - `/translate`：外部 provider 成功 + 默认 provider 成功/unsupported 守卫。
    - `/yt-script`：外部 provider 成功 + 默认 provider 成功/失败守卫。
- 本轮（回归门对齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` round9 从 `/proxy` fail-fast 断言切换为成功断言，补入 `model-config-storage` 种子并校验 `activeConfigId + llmType/model/baseUrl/apiKey` 同步结果。
  - round9 `/yt-script` 已升级为默认 provider 成功回放：不再依赖临时宿主探针，而是断言 canonical URL/lang 透传到默认 backend 提取链路。
  - round10 已升级为 `/translate` 默认 provider 成功回放：通过 active model preset 固定种子走真实默认宿主路径，不再依赖临时注入探针。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round9-proxy-switch-pass.png`
    - `round9-yt-script-provider-pass.png`
    - `round10-translate-provider-pass.png`
- 本轮（Replay 负向回归门补齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` round11 `/translate` 现已切换为 unsupported provider 回放，断言 `/session` 页面显式暴露 `/translate provider not available in /session default host: mocker`。
  - round11 新增 `/yt-script` 未注入 provider 回放，断言 `/yt-script is not wired in /session host yet`，补齐成功/失败双向回归门。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round11-translate-unsupported-provider-pass.png`
    - `round11-yt-script-provider-failfast-pass.png`
- 本轮（Proxy 负向回归门补齐）已完成：
  - `scripts/p4-session-replay-e2e.mjs` 新增 round12 `/proxy missing-profile` 回放，断言 `/session` 页面显式暴露 `/proxy preset not found: missing-profile`。
  - round12 在负向断言前先显式执行一次 `/proxy Default Proxy`，将回放状态重置到已知 preset，随后校验 bad preset 失败后 `model-config-storage + llmType/model/baseUrl/apiKey` 保持不变。
  - `scripts/p4-session-replay-lib.mjs` 产物清单与 summary 文案同步更新，新增截图产物：
    - `round12-proxy-unknown-preset-failfast-pass.png`
- 本轮（Session Host 协议收口）已完成：
  - 新增 `app/session/session-host-bridge.ts`，统一管理 `window.__DREAMMINISTAGE_SESSION_HOST__`、`translateText`、`getYouTubeTranscript` 与宿主错误明细路径，去掉 `page.tsx` 内散落的局部协议定义。
  - 新增正式协议文档 `docs/analysis/session-host-bridge/README.md`，明确 `/translate` 与 `/yt-script` 的宿主方法签名、fail-fast 语义、推荐注入方式与兼容性边界。
  - 新增协议级单测 `app/session/__tests__/session-host-bridge.test.ts`，并让页面级集成测试复用统一 bridge key，避免测试代码与页面实现漂移。
- 本轮（Translate 默认 Provider 固定化）已完成：
  - 新增 `app/session/session-host-defaults.ts`，为 `/translate` 提供内建默认 provider：读取当前 active model preset，并支持 `openai`、`ollama`、`gemini`。
  - `app/session/page.tsx` 现在会合并“默认宿主能力 + window 注入能力”：外部宿主可覆盖默认实现；未覆盖的方法优先回退到页面默认能力，因此 `/translate` 默认可用，`/yt-script` 仍保持外部注入优先。
  - 新增 `app/session/__tests__/session-host-defaults.test.ts`，并将页面级集成测试改为验证：默认 translate provider 成功、unsupported provider fail-fast、外部注入仍可覆盖默认实现。
  - `scripts/p4-session-replay-e2e.mjs` round10 已从临时 translate probe 切到默认 provider 固定种子；round11 `/translate` 负向守卫切换为 unsupported provider fail-fast。
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json` 已补入 `network-openai-translate-mock-200` 与 `network-vercel-script-aborted` 规则，避免默认 provider 成功路径被误报为噪声漂移。
- 本轮（YT 默认 Provider 固定化）已完成：
  - `app/session/session-host-defaults.ts` 已为 `/yt-script` 提供内建默认 provider：通过 `Jina Reader -> active model transcript extraction` 获取 transcript/lyrics；reader 拉取失败或提取为空时显式 fail-fast。
  - `app/session/__tests__/session-host-defaults.test.ts` 与 `app/session/__tests__/page.slash-integration.test.tsx` 已补齐 `/yt-script` 默认 provider 成功/失败守卫，并保留外部注入覆盖默认实现的断言。
  - `scripts/p4-session-replay-e2e.mjs` round9 `/yt-script` 成功路径已从临时探针切到默认 provider 固定种子；round11 `/yt-script` 负向守卫已切换为默认 provider fail-fast。
- 本轮（Timed Effect 宿主状态落地）已完成：
  - 新增 `lib/dialogue/chat-metadata.ts`，将 chat metadata 读写从 root node `extra` 里统一收口，并兼容 JSONL 导入时的 `jsonl_metadata.chat_metadata`。
  - 新增 `app/session/session-timed-world-info.ts`，把 `/wi-get-timed-effect` 与 `/wi-set-timed-effect` 的运行时状态冻结到 dialogue root `chat_metadata.timedWorldInfo`；状态结构固定为 `file -> uid -> effect -> number`。
  - `app/session/page.tsx` 已接通 timed effect 真实宿主路径；页面级与单元级测试补齐：读写成功、effect 未配置 fail-fast、metadata 清理与 JSONL metadata 兼容。
  - `scripts/p4-session-replay-e2e.mjs` 新增 round13：覆盖 `wi-set-timed-effect on -> toggle off -> unconfigured fail-fast`，并产出新截图：
    - `round13-wi-timed-effect-success-pass.png`
    - `round13-wi-timed-effect-failfast-pass.png`
- Replay 回归现状：
  - 最新通过 run：`p4r16-1772897017969`。
  - 产物目录：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r16-1772897017969`。
  - run index 已更新：`p4-session-replay-run-index.json/.md`。
- 为让 replay 噪声基线恢复稳定，本轮顺手修复了 `/session` 页 header 注入循环源头：
  - `app/session/page.tsx` 将 `currentCharacter` 改为 `useMemo`，消除 render 周期对象重建导致的 effect 高频触发。
- `/session` 宿主能力清单（最新）：
  - 已接通：`tempchat`、`floor-teleport`、`proxy`。
  - 内建默认 provider：`translate`（provider=`session-host`，读取 active model preset；正式协议见 `docs/analysis/session-host-bridge/README.md`）。
  - 内建默认 provider：`yt-script`（provider=`session-host`，走 `Jina Reader -> active model transcript extraction`）。
  - 已接通：`wi-get-timed-effect`、`wi-set-timed-effect`（运行时状态落在 dialogue root `chat_metadata.timedWorldInfo`）。
- 本轮已验证：
  - `pnpm vitest run app/session/__tests__/page.slash-integration.test.tsx app/session/__tests__/session-timed-world-info.test.ts lib/dialogue/__tests__/chat-metadata.test.ts app/session/__tests__/session-host-bridge.test.ts app/session/__tests__/session-host-defaults.test.ts`
  - `pnpm typecheck`
  - `pnpm p4:session-replay`（最新 run：`p4r16-1772897017969`）

- 本轮（收尾清理）已完成：
  - replay 旧 run 目录已瘦身：仅保留当前最终有效 run `p4r16-1772897017969`，其余历史产物从工作树移除，仍可通过 git 历史追溯。
  - `p4-session-replay-run-index.json/.md` 已重建为单 run 视图，只跟踪最终有效 run，避免旧 run 与 stale rule 继续污染收尾状态。
  - 仓库内不存在 `openspec/` 目录，因此 `.gitignore` 与 `AGENTS.md` 中对应的过期残留已一并清理。

## 推荐下一步

1. 观察 `/yt-script` 默认 backend 在真实视频类型上的稳定性；如果 `Jina Reader -> active model` 对长视频或无描述视频误判偏高，再决定是否引入专门 transcript backend。
2. 若要正式封板，可仅保留当前 handoff/analysis 文档并停止新增 replay 变体，进入观察期。
3. 若后续还有需求变更，再以当前 `p4r16-1772897017969` 为新的回归基线继续迭代。
