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
  - round7/8 保持 slash 直达 + refresh + session 隔离 + 401 失败链路；round9 补宿主 wiring 路径。
- [x] 将产物写入现有 artifacts 目录，并更新 run index。
  - 最新通过 run：`p4r11-1772804943599`（`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/`）。

## 4. 文档 / 交接

- [x] 每轮结束更新 `docs/plan/2026-03-06-sillytavern-integration-hardening/handoff.md`。
- [x] 若真实宿主行为发生变化，同步更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 保持 `docs/plan/README.md` 指向当前计划。

## 5. 追加加固（2026-03-06 当前轮）

- [x] `/session` 将 `/proxy` 从 fail-fast 升级为真实宿主路径（`model-store` 读取/切换 + localStorage 同步）。
- [x] `/session` 为 `/translate`、`/yt-script` 接入 `window.__DREAMMINISTAGE_SESSION_HOST__` provider 通道，并保留未注入 fail-fast。
- [x] 页面级集成测试补齐“成功 + 失败”成对守卫：`/proxy` 与 `/yt-script`。
