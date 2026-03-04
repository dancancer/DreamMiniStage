**一旦我所属的文件夹有所变化，请更新我**

# script-bridge/

脚本桥接层。连接 React 组件与脚本运行时的事件与数据通道。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出桥接功能 |
| `types.ts` | 类型定义 | 桥接类型定义 |
| `audio-handlers.ts` | 处理器 | 音频事件处理 |
| `capability-matrix.ts` | 能力矩阵 | shim/handler/slash 单一能力声明 |
| `character-handlers.ts` | 处理器 | 角色事件处理 |
| `compat-handlers.ts` | 处理器 | JS-Slash-Runner 高频兼容 API（import_raw / extension / script buttons / version） |
| `compat-displayed-message-handlers.ts` | 处理器 | JS-Slash-Runner displayed-message 兼容 API（format/retrieve） |
| `compat-regex-handlers.ts` | 处理器 | JS-Slash-Runner regex 兼容 API（format/get/enabled/replace） |
| `event-handlers.ts` | 处理器 | 通用事件处理 |
| `extension-handlers.ts` | 门面 | 扩展 API 门面层（聚合函数工具与 slash 回调桥接） |
| `function-tool-bridge.ts` | 子模块 | 函数工具注册/调用/回调与清理 |
| `generation-handlers.ts` | 处理器 | 生成事件处理 |
| `iframe-dispatcher-registry.ts` | 子模块 | iframe dispatcher 注册与消息派发 |
| `lorebook-handlers.ts` | 处理器 | 知识库事件处理 |
| `message-handlers.ts` | 处理器 | 消息事件处理 |
| `mvu-handlers.ts` | 处理器 | MVU 事件处理 |
| `preset-handlers.ts` | 处理器 | 预设事件处理 |
| `quickreply-handlers.ts` | 处理器 | 快速回复处理 |
| `scoped-variables.ts` | 处理器 | 作用域变量处理 |
| `slash-command-bridge.ts` | 子模块 | Slash 命令回调桥接与生命周期清理 |
| `slash-handlers.ts` | 处理器 | 斜杠命令处理 |
| `tool-handlers.ts` | 处理器 | 工具调用处理 |
| `variable-handlers.ts` | 处理器 | 变量事件处理 |
| `worldbook-handlers.ts` | 处理器 | 世界书事件处理 |

## 近期约束

- `slash-handlers.ts` 的 `triggerSlash` 仅接收命令字符串参数，回调统一从 `ApiCallContext` 注入，不再支持额外 options 覆盖。
- `slash-handlers.ts` 已补齐 JS-Slash-Runner 音频通道能力（`bgm|ambient` 的 mode/enable/playlist 状态控制）。
- `public/iframe-libs/slash-runner-shim.js` 不再导出 `window.getVariables`/`window.triggerSlash` 等顶层别名；脚本统一通过 `window.TavernHelper` / `window.SillyTavern` 访问 API。
- `variable-handlers.ts` 的集合操作默认作用域为 `chat`，并支持上游常用参数形态 `{ type, message_id }`（含 `latest` 与负索引）。
- `mvu-handlers.ts` 的 `mvu.getVariable/mvu.getVariables` 已支持 `{ type, message_id }` 与 `messageId`，并统一 `chatId > dialogueId > characterId` 的会话键优先级。
- `capability-matrix.ts` 已作为能力单源，`api-surface-contract.test.ts` 会同步校验 shim 暴露面、handler 注册面与 slash 注册面。
- `slash-handlers.ts` 现在会在上下文内注入 `runSlashCommand` 递归执行入口，供 `/run` 命令走单一路径闭环；`reload-page` 通过 `ApiCallContext.onReloadPage` 显式注入，未注入时 fail-fast。
- `registerFunctionTool` 已收敛为单一注册表路径：`extension-handlers` 统一负责注册、调度、回调落地；`tool-handlers` 仅保留适配导出，避免双状态源漂移。
- `extension-handlers.ts` 现为门面层：具体实现拆分到 `function-tool-bridge.ts` 与 `slash-command-bridge.ts`，通过 `iframe-dispatcher-registry.ts` 共享派发能力。
- `slash-command-bridge.ts` 已收敛 `registerSlashCommand` 执行期参数约束：当定义了 `namedArgumentList/unnamedArgumentList` 时，缺失必填参数、未知命名参数、位置参数溢出均显式 fail-fast，并向 callback 上下文注入结构化参数列表（`namedArgumentList/unnamedArgumentList`）。
- `ScriptSandbox` 卸载时会同时清理 `event listeners + function tools + slash command ownership`，避免跨 iframe 生命周期残留。
- 变量 API 已补齐 `registerVariableSchema / updateVariablesWith / insertVariables`：其中 `updateVariablesWith` 在 shim 内先执行 updater，再通过 handler 单路径回写并 fail-fast 校验对象输入。
- 已新增 `compat-handlers.ts`，补齐 `importRaw* / extension 管理最小集 / getAllEnabledScriptButtons / getTavernHelperVersion` 等高频迁移 API；其中宿主不支持的写能力（`installExtension/uninstallExtension/reinstallExtension/updateExtension/updateTavernHelper/updateFrontendVersion`）保持显式 fail-fast。
- 已新增 `compat-displayed-message-handlers.ts`，补齐 `formatAsDisplayedMessage/retrieveDisplayedMessage` 最小闭环；消息定位参数（`last/last_user/last_char/number`）异常时统一显式 fail-fast。
- 已新增 `compat-regex-handlers.ts`，补齐 `formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes/replaceTavernRegexes` regex 读写链路，继续保持参数错误显式 fail-fast。
- `public/iframe-libs/slash-runner-shim.js` 已补齐低频兼容入口：`replaceTavernRegexes/updateTavernRegexesWith`（写链路 + updater 包装）与 `injectPrompts/uninjectPrompts`（宿主模式显式 fail-fast）。
- 群聊相关 `getGroupMembers` / `isGroupChat` 目前为显式未支持（fail-fast），不再返回静默默认值。
- 新增 `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`，覆盖 `registerFunctionTool/registerSlashCommand` 的注册→调用→清理→再注册回归链路。
- `ApiCallContext` 已增加 UI 注入位（`onTogglePanels/onResetPanels/onToggleVisualNovelMode/onSetBackground/onSetTheme/onSetMovingUiPreset/onSetCssVariable`），`slash-handlers.ts` 会透传到 Slash 执行上下文，未注入时对应命令显式 fail-fast。
