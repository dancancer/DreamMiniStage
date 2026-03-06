# Handoff（2026-03-06）

## 本轮完成

- 收掉最后 3 个 slash 命令缺口：`/proxy`、`/yt-script`、`/floor-teleport`。
- `proxy` 统一走显式宿主回调 `selectProxyPreset(name?)`：Slash 层只做参数串接与返回值校验，读路径返回当前 preset，写路径返回宿主确认后的 preset 名称。
- `yt-script` 统一走显式宿主回调 `getYouTubeTranscript(urlOrId, { lang })`：支持 URL/视频 ID、`lang=` 透传、pipe 输入与非字符串返回 fail-fast。
- `floor-teleport` 直接收敛到既有 `/chat-jump` 单路径实现，不再重复维护第二套滚动逻辑。
- 修补 Script Bridge 注入漂移：`useScriptBridge` 现已实际透传 `onOpenTemporaryChat`、`onTranslateText`、`onGetWorldInfoTimedEffect`、`onSetWorldInfoTimedEffect`，并新增 `onSelectProxyPreset`、`onGetYouTubeTranscript`，避免 adapter 已支持但 Hook 层未转发的断层。
- 同步更新能力矩阵与契约守卫：`SLASH_COMMAND_MATRIX` 新增 `api/api-url/server/proxy`、`floor-teleport`、`yt-script`，对应测试已覆盖 `proxy`、`yt-script`、`floor-teleport` 的读写/别名/异常路径。

## 回归结果

- `pnpm typecheck`：通过。
- `pnpm vitest run lib/slash-command/__tests__/p2-api-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`4 files / 46 tests` 全通过。
- `pnpm vitest run lib/core/__tests__/st-baseline-*.test.ts lib/slash-command/__tests__/material-replay-control-flow.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/slash-command/__tests__/p2-api-command-gaps.test.ts lib/slash-command/__tests__/p2-chat-command-gaps.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`：`16 files / 338 tests` 全通过。
- `pnpm analyze:sillytavern-gap`：
  - slash coverage：`100.00%`（上一轮 `99.30%`，+`0.70`pp）
  - api matrix coverage：`100.00%`
  - api facade coverage：`100.00%`
  - Top25 priority gaps：已清空

## 下一步建议

1. 给 `useScriptBridge` 补一条“注入位透传完整性”契约测试，直接比较 `UseScriptBridgeOptions` -> `handleApiCall(ApiCallContext)` 的关键 slash 注入位，防止以后再出现 adapter 已支持但 Hook 未转发的漂移。
2. 如果产品侧真要开放 `/proxy` 与 `/yt-script`，下一轮优先在真实 Session 宿主接上 `selectProxyPreset/getYouTubeTranscript`，避免命令只停留在桥接层可用。
3. slash coverage 已到 `100%`，后续重心可以切到真实素材回放与宿主运行时一致性，而不是继续堆命令总数。
