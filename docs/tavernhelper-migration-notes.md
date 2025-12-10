# JS-Slash-Runner 移植工作摘要（续作备忘）

## 已完成
- 嵌入兼容：`components/chatHtmlHelpers.ts`、`public/iframe-libs/script-runner.html` 暴露 TavernHelper/SillyTavern 常用 API（variables/events/log/getChatMessages/getCurrentMessageId/eventEmit）并新增 generate/stop、世界书/预设导入导出/绑定接口；API 调用超时提升到 120s。
- 父端桥接：`hooks/useScriptBridge.ts` 处理 TavernHelper API_CALL，支持：
  - 生成：调用 `handleCharacterChatRequest`，按当前激活 API 配置或 custom_api；可 stop by id/all（AbortController 层面）。
  - 世界书：get/search/create/update/delete，导入/导出，全局 worldbook 列表、导入/删除、绑定 char/chat/worldbook create/replace/bulk entries。
  - 预设：列表/获取/创建/更新/删除/导入/启用/重命名/替换，查询当前激活预设，ordered prompts。
  - 变量：作用域快照修正（全局+角色）。
  - 事件：eventEmit 透传到 window CustomEvent。
- 数据层：`WorldBookOperations` 增加 deleteWorldBook，便于 replace/delete 调用。
- 执行器兜底：`lib/script-runner/executor.ts` 在 iframe 初始化时对 `getChatMessages`/`getCurrentMessageId`/`eventEmit` 直接回 API_RESPONSE，避免脚本执行器场景超时。

## 已知限制 / 待补
- 生成取消仅中断本地 Promise，`handleCharacterChatRequest` 无原生取消钩子，后台流程仍会跑；若需彻底中断需在 dialogue pipeline 加 abort 支持。
- 音频控制、脚本按钮/宏、UI 面板等 SillyTavern 扩展尚未实现（按用户指示暂跳过）。
- TavernHelper event bus 只做了基本 emit/on（无持久订阅管理）；如需完整 button listener 行为需补充。
- 没有端到端测试验证；建议手动：1) iframe 内调用 generate→stop→再 generate；2) worldbook JSON 导入/全局绑定；3) 预设导入并 load；观察 API_RESPONSE。

## 目录提示
- 兼容 shim：`components/chatHtmlHelpers.ts`、`public/iframe-libs/script-runner.html`
- 桥接核心：`hooks/useScriptBridge.ts`
- 生成入口：`function/dialogue/chat.ts`（被 generate API 调用）
- 世界书数据：`lib/data/roleplay/world-book-operation.ts` (+ `function/worldbook/*`)
- 预设数据：`lib/data/roleplay/preset-operation.ts` (+ `function/preset/*`)
- 执行器兜底：`lib/script-runner/executor.ts`
