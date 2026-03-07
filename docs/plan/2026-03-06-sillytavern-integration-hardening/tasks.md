# 执行清单（2026-03-06）

## 1. M1：宿主注入闭环

- [x] 审计 `components/CharacterChatPanel.tsx` 当前缺失的 Script Bridge 注入位。
- [x] 为 `CharacterChatPanel` Props 与 `useScriptBridge(...)` 调用补齐：`onOpenTemporaryChat`、`onTranslateText`、`onGetYouTubeTranscript`、`onSelectProxyPreset`、`onGetWorldInfoTimedEffect`、`onSetWorldInfoTimedEffect`。
- [x] 审计 `/session` 页面与相关宿主组件，确认上述能力的真实实现或显式 fail-fast 策略。
- [x] 新增 bridge 注入完整性契约测试，覆盖 `UseScriptBridgeOptions -> ApiCallContext -> ExecutionContext`。

## 2. M2：组件级 / 页面级集成测试

- [x] 为 `CharacterChatPanel` 增补集成测试 harness，验证 slash -> hook -> host callback 的真实调用链。
- [x] 优先覆盖 `tempchat / translate / proxy / yt-script / wi-get-timed-effect / wi-set-timed-effect / floor-teleport`。
- [x] 为 `/session` 页面补最小集成用例，验证输入执行、错误回显、消息跳转与刷新保持。
  - 已落地输入执行 / 错误回显 / 消息跳转 / refresh-remount 保持断言：`app/session/__tests__/page.slash-integration.test.tsx`。
- [x] 记录缺失宿主实现的能力，并区分“待接通”和“故意 fail-fast”。
  - 结论已同步到 `docs/analysis/sillytavern-integration-gap-2026-03.md` 与 `handoff.md`。

## 3. M3：Playwright Replay

- [x] 复用 `scripts/p4-session-replay-e2e.mjs` 增加新的 `/session` replay 场景。
  - 已新增 round9：覆盖 `/floor-teleport` 锚点滚动与 `/proxy` fail-fast 错误链路。
- [x] 让 replay 覆盖 slash 执行、refresh 持久化、session 隔离、失败链路。
  - round7/8 保持 slash 直达 + refresh + session 隔离 + 401 失败链路；round9-12 补宿主 wiring 的成功/失败路径，其中 round10 已切到 `/translate` 默认 provider 固定种子。
- [x] 将产物写入现有 artifacts 目录，并更新 run index。
  - 最新通过 run：`p4r15-1772894030582`（`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/`）。

## 4. 文档 / 交接

- [x] 每轮结束更新 `docs/plan/2026-03-06-sillytavern-integration-hardening/handoff.md`。
- [x] 若真实宿主行为发生变化，同步更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 保持 `docs/plan/README.md` 指向当前计划。

## 5. 追加加固（2026-03-06 当前轮）

- [x] `/session` 将 `/proxy` 从 fail-fast 升级为真实宿主路径（`model-store` 读取/切换 + localStorage 同步）。
- [x] `/session` 为 `/translate`、`/yt-script` 接入 `window.__DREAMMINISTAGE_SESSION_HOST__` provider 通道，并保留未注入 fail-fast。
- [x] 页面级集成测试补齐“成功 + 失败”成对守卫：`/proxy` 与 `/yt-script`。

## 6. Replay 回归门对齐（2026-03-07）

- [x] round9 将 `/proxy` 从 fail-fast 断言升级为“真实 preset 成功切换”断言，并校验 localStorage 同步字段。
- [x] round9 `/yt-script` 已升级为默认 provider 成功回放，断言 canonical URL/lang 透传到默认 backend 提取链路。
- [x] replay 产物清单与 summary 同步更新，新增 `round9-proxy-switch-pass.png` 与 `round9-yt-script-provider-pass.png`。

## 7. Extension Provider 双命令闭环（2026-03-07 当前轮）

- [x] 页面级集成测试补齐 `/translate` 成对守卫：provider 成功 + 未注入 fail-fast。
- [x] `scripts/p4-session-replay-e2e.mjs` round10 已切到 `/translate` 默认 provider 成功回放，断言 text/target 透传正确。
- [x] replay 产物与 summary 清单新增 `round10-translate-provider-pass.png`，并完成一次新 run 回归。

## 8. Provider Fail-Fast Replay Guard（2026-03-07 当前轮）

- [x] `scripts/p4-session-replay-e2e.mjs` 新增 round11 `/translate` 未注入 provider 的 fail-fast 回放，断言 `/session` 页面显式暴露错误。
- [x] `scripts/p4-session-replay-e2e.mjs` 新增 round11 `/yt-script` 未注入 provider 的 fail-fast 回放，避免成功路径覆盖下的宿主缺失回归漏检。
- [x] replay 产物与 summary 清单新增 `round11-translate-provider-failfast-pass.png`、`round11-yt-script-provider-failfast-pass.png`，并完成一次新 run 回归（`p4r13-1772863786323`）。

## 9. Proxy Negative Replay Guard（2026-03-07 当前轮）

- [x] `scripts/p4-session-replay-e2e.mjs` 新增 round12 `/proxy missing-profile` fail-fast 回放，断言页面显式暴露 `/proxy preset not found`。
- [x] round12 在负向断言前先显式切回默认 preset，并校验 bad preset 失败后 `model-config-storage + llmType/model/baseUrl/apiKey` 保持不变，避免回放受上轮成功切换状态污染。
- [x] replay 产物与 summary 清单新增 `round12-proxy-unknown-preset-failfast-pass.png`，并完成一次新 run 回归（`p4r14-1772882882394`）。

## 10. Session Host Protocol 收口（2026-03-07 当前轮）

- [x] 新增 `app/session/session-host-bridge.ts`，统一收口 `/session` 宿主桥接 window key、方法签名与错误明细路径，移除 `page.tsx` 内散落的局部协议定义。
- [x] 新增 `docs/analysis/session-host-bridge/README.md` 作为正式协议文档，并同步更新 `app/session/README.md` 与 `docs/analysis/README.md` 入口。
- [x] 新增协议级单测 `app/session/__tests__/session-host-bridge.test.ts`，并让页面级集成测试复用统一 bridge key，避免测试与页面协议漂移。

## 11. Translate 默认 Provider 固定化（2026-03-07 当前轮）

- [x] 新增 `app/session/session-host-defaults.ts`，为 `/translate` 提供默认 provider=`session-host`：读取 active model preset，并支持 openai/ollama/gemini。
- [x] `/session` 页面改为合并“默认宿主能力 + window 注入能力”：`/translate` 默认可用，`/yt-script` 继续由外部宿主注入并保持未注入 fail-fast。
- [x] round10 replay 从临时 translate probe 切到默认 provider 固定种子；round11 `/translate` 负向守卫切换为 unsupported provider fail-fast，并同步更新噪声基线与新 run（`p4r15-1772890368392`）。

## 12. YT 默认 Provider 固定化（2026-03-07 当前轮）

- [x] `app/session/session-host-defaults.ts` 为 `/yt-script` 提供默认 provider=`session-host`：通过 `Jina Reader -> active model` 提取 transcript/lyrics，并在 reader/提取失败时显式 fail-fast。
- [x] 页面级与默认宿主单测补齐 `/yt-script`：默认 provider 成功、默认 provider 失败、外部注入覆盖默认实现。
- [x] round9 `/yt-script` 成功回放已从临时探针切到默认 provider 固定种子；round11 `/yt-script` 负向守卫切到默认 provider fail-fast，并完成新 run 回归（`p4r15-1772894030582`）。

