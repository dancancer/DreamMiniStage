# Handoff（2026-03-06）

## 当前状态

- M1 已启动并完成第一轮闭环：`CharacterChatPanel` 已补齐高价值宿主注入位 `onOpenTemporaryChat / onTranslateText / onGetYouTubeTranscript / onSelectProxyPreset / onGetWorldInfoTimedEffect / onSetWorldInfoTimedEffect`，并顺手补上 `onJumpToMessage`，避免 `floor-teleport` 继续停留在纯单测可用状态。
- `/session` 页面宿主已明确分层：
  - `tempchat` 现走真实实现，会为当前角色创建带 `[temp]` 后缀的新会话并跳转。
  - `floor-teleport` / `chat-jump` 现走真实页面消息锚点滚动；`MessageList` 改为保留原始消息索引，`MessageItem` 输出 `data-session-message-*` 锚点，避免过滤隐藏消息后索引漂移。
  - `translate / proxy / yt-script / wi-get-timed-effect / wi-set-timed-effect` 现由 `/session` 宿主显式 fail-fast，不再依赖“未注入所以碰巧报错”的隐式路径。
- 已新增 bridge 注入完整性契约测试，守护 `CharacterChatPanel -> useScriptBridge -> ApiCallContext -> ExecutionContext` 的高价值映射，防止再出现 adapter 支持但组件/Hook 漏传的回归。
- 本轮已验证：`pnpm vitest run app/session/__tests__/session-switch.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`、`pnpm typecheck`。

## 推荐下一步

1. 进入 M2，先补 `CharacterChatPanel` 级 harness，覆盖 `tempchat / translate / proxy / yt-script / wi-* / floor-teleport` 的 slash -> hook -> host callback 调用链。
2. 给 `/session` 页面补最小集成用例，优先验证三类路径：`tempchat` 跳转成功、`floor-teleport` 定位成功、fail-fast 命令能稳定把错误冒泡到页面层。
3. 再决定哪些宿主能力值得真接通：优先级建议为 `selectProxyPreset`、`getYouTubeTranscript`，`wi-* timed effect` 若没有明确 chat metadata 设计，继续保持 fail-fast，不要先堆兼容分支。
