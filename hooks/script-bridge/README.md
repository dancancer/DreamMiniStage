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
| `prompt-injection-handlers.ts` | 处理器 | 注入提示词处理（inject/uninject） |
| `quickreply-handlers.ts` | 处理器 | 快速回复处理 |
| `scoped-variables.ts` | 处理器 | 作用域变量处理 |
| `slash-context-adapter.ts` | 子模块 | Slash 执行上下文总适配（变量/音频/角色/preset） |
| `slash-context-lore-regex.ts` | 子模块 | Slash 执行上下文 world/lore/regex 适配 |
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
- `slash-handlers.ts` 已收敛为薄桥接层；Slash 上下文注入逻辑迁移到 `slash-context-adapter.ts`，其中继续提供 `runSlashCommand` 递归执行入口与 `reload-page` 的显式注入 fail-fast 行为。
- `registerFunctionTool` 已收敛为单一注册表路径：`extension-handlers` 统一负责注册、调度、回调落地；`tool-handlers` 仅保留适配导出，避免双状态源漂移。
- `extension-handlers.ts` 现为门面层：具体实现拆分到 `function-tool-bridge.ts` 与 `slash-command-bridge.ts`，通过 `iframe-dispatcher-registry.ts` 共享派发能力。
- `slash-command-bridge.ts` 已收敛 `registerSlashCommand` 执行期参数约束：当定义了 `namedArgumentList/unnamedArgumentList` 时，缺失必填参数、未知命名参数、位置参数溢出均显式 fail-fast，并向 callback 上下文注入结构化参数列表（`namedArgumentList/unnamedArgumentList`）。
- `ScriptSandbox` 卸载时会同时清理 `event listeners + function tools + slash command ownership`，避免跨 iframe 生命周期残留。
- 变量 API 已补齐 `registerVariableSchema / updateVariablesWith / insertVariables`：其中 `updateVariablesWith` 在 shim 内先执行 updater，再通过 handler 单路径回写并 fail-fast 校验对象输入。
- 已新增 `compat-handlers.ts`，补齐 `importRaw* / extension 管理最小集 / getAllEnabledScriptButtons / getTavernHelperVersion` 等高频迁移 API；其中宿主不支持的写能力（`installExtension/uninstallExtension/reinstallExtension/updateExtension/updateTavernHelper/updateFrontendVersion`）保持显式 fail-fast。
- 已新增 `compat-displayed-message-handlers.ts`，补齐 `formatAsDisplayedMessage/retrieveDisplayedMessage` 最小闭环；消息定位参数（`last/last_user/last_char/number`）异常时统一显式 fail-fast。
- 已新增 `compat-regex-handlers.ts`，补齐 `formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes/replaceTavernRegexes` regex 读写链路，继续保持参数错误显式 fail-fast。
- `public/iframe-libs/slash-runner-shim.js` + `prompt-injection-handlers.ts` 已补齐 `injectPrompts/uninjectPrompts` 闭环：shim 返回可复用 `uninject` 句柄，handler 负责参数校验、注入记录与事件广播，保持 fail-fast。
- `public/iframe-libs/slash-runner-shim.js` + `message-handlers.ts` + `compat-handlers.ts` 已补齐长尾兼容入口：`setChatMessage/rotateChatMessages` 与 `builtin/tavern_events/iframe_events/builtin_prompt_default_order/getScriptTrees/replaceScriptTrees/updateScriptTreesWith`，并统一保持参数校验 fail-fast。
- `public/iframe-libs/slash-runner-shim.js` 已补齐 `macro_like/raw_character` 长尾入口：`registerMacroLike/unregisterMacroLike` 本地注册表可用；`RawCharacter/Character` 构造器与 `getCharAvatarPath/getCharData/getChatHistoryBrief/getChatHistoryDetail` 已接入最小读链路并保持 fail-fast。
- `public/iframe-libs/slash-runner-shim.js` 已补齐 `_th_impl/_bind` 最小子集（日志透传占位 + util/global/variables 宿主绑定），并新增 `audioEnable/audioImport/audioMode/audioPlay/audioSelect` helper 别名，统一收敛到现有音频 API 单路径。
- 群聊相关 `getGroupMembers` / `isGroupChat` 目前为显式未支持（fail-fast），不再返回静默默认值。
- 新增 `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`，覆盖 `registerFunctionTool/registerSlashCommand` 的注册→调用→清理→再注册回归链路。
- 新增 `hooks/script-bridge/__tests__/material-replay-round34.test.ts` + `hooks/script-bridge/__tests__/fixtures/round34-migration-material.json`，用于真实迁移素材回放守卫（`rotateChatMessages` + script tree helper）。
- `ApiCallContext` Slash 注入位已扩展为 `onTogglePanels/onResetPanels/onToggleVisualNovelMode/onSetBackground/onSetTheme/onSetMovingUiPreset/onSetCssVariable/onSetAverageBackgroundColor/onSetChatDisplayMode/onShowButtonsPopup/onShowPopup/onPickIcon/onIsMobile/onGenerateCaption/onPlayNotificationSound/onJumpToMessage/onRenderChatMessages/onCloseChat/onGetChatName/onSetInput/onOpenTemporaryChat/onDuplicateCharacter/onNewChat/onGenerateImage/onTranslateText/onGetYouTubeTranscript/onGetImageGenerationConfig/onSetImageGenerationConfig/onGetInstructMode/onSetInstructMode/onGetStopStrings/onSetStopStrings/onGetModel/onSetModel/onSelectProxyPreset/onNarrateText/onGetGroupMemberCount/onRemoveGroupMember/onMoveGroupMember/onPeekGroupMember/onAskCharacter/onSelectContextPreset/onGetClipboardText/onSetClipboardText/onImportVariables/onIsExtensionInstalled/onGetExtensionEnabledState/onSetExtensionEnabled/onGetWorldInfoTimedEffect/onSetWorldInfoTimedEffect/onRemovePromptInjections`；Quick Reply 透传位已补齐第二/三批命令所需的 `onToggle/Add/Remove(Global|Chat)QuickReplySet/onListQuickReplySets/onUpdateQuickReply/onAdd/Remove/ClearQuickReplyContextSet(s)/onCreate|onUpdate|onDeleteQuickReplySet`；`slash-context-adapter.ts` 会统一透传到 Slash 执行上下文，`useScriptBridge.ts` 现已同步转发 `tempchat/translate/timed-effect/proxy/yt-script` 所需注入位，并在宿主未注入时为 `setChatDisplayMode/bgcol/buttons/popup/pick-icon/is-mobile/removePromptInjections/closechat/custom-stop-strings/model` 提供单路径默认实现（stop/model 默认落 localStorage），仍保持参数/返回值异常显式 fail-fast。
- Profile/Prompt 长尾命令新增注入位：`onGetCurrentProfileName/onSetCurrentProfileName/onListConnectionProfiles/onCreateConnectionProfile/onUpdateConnectionProfile/onGetConnectionProfile/onGetPromptPostProcessing/onSetPromptPostProcessing`；`slash-context-adapter.ts` 在宿主未注入时提供 localStorage 默认实现（`connection-profiles/selected-profile/prompt-post-processing`）。
