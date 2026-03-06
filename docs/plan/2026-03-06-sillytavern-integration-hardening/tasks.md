# 执行清单（2026-03-06）

## 1. M1：宿主注入闭环

- [x] 审计 `components/CharacterChatPanel.tsx` 当前缺失的 Script Bridge 注入位。
- [x] 为 `CharacterChatPanel` Props 与 `useScriptBridge(...)` 调用补齐：`onOpenTemporaryChat`、`onTranslateText`、`onGetYouTubeTranscript`、`onSelectProxyPreset`、`onGetWorldInfoTimedEffect`、`onSetWorldInfoTimedEffect`。
- [x] 审计 `/session` 页面与相关宿主组件，确认上述能力的真实实现或显式 fail-fast 策略。
- [x] 新增 bridge 注入完整性契约测试，覆盖 `UseScriptBridgeOptions -> ApiCallContext -> ExecutionContext`。

## 2. M2：组件级 / 页面级集成测试

- [ ] 为 `CharacterChatPanel` 增补集成测试 harness，验证 slash -> hook -> host callback 的真实调用链。
- [ ] 优先覆盖 `tempchat / translate / proxy / yt-script / wi-get-timed-effect / wi-set-timed-effect / floor-teleport`。
- [ ] 为 `/session` 页面补最小集成用例，验证输入执行、错误回显、消息跳转与刷新保持。
- [ ] 记录缺失宿主实现的能力，并区分“待接通”和“故意 fail-fast”。

## 3. M3：Playwright Replay

- [ ] 复用 `scripts/p4-session-replay-e2e.mjs` 增加新的 `/session` replay 场景。
- [ ] 让 replay 覆盖 slash 执行、refresh 持久化、session 隔离、失败链路。
- [ ] 将产物写入现有 artifacts 目录，并更新 run index。

## 4. 文档 / 交接

- [x] 每轮结束更新 `docs/plan/2026-03-06-sillytavern-integration-hardening/handoff.md`。
- [x] 若真实宿主行为发生变化，同步更新 `docs/analysis/sillytavern-integration-gap-2026-03.md`。
- [x] 保持 `docs/plan/README.md` 指向当前计划。
