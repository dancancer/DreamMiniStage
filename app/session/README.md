**一旦我所属的文件夹有所变化，请更新我**

# session/

会话页面。角色对话的主入口，承载核心交互体验。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `page.tsx` | 页面入口壳 | Suspense fallback 与内容模块装配 |
| `session-page-content.tsx` | 内容模块 | `/session` 页面主逻辑与视图编排 |
| `session-page-layout.tsx` | 视图装配 | chat/editor/modal 主界面组合与 CharacterChatPanel props 收口 |
| `session-content-view.tsx` | 视图路由 | chat/worldbook/preset/regex 主视图切换 |
| `session-dialogue-tree.ts` | 对话树工具 | 扁平消息到 DialogueTree 快照的单路径构建 |
| `session-dialogue-actions.ts` | 对话动作 | hide/unhide/save/reasoning 这批消息级动作收口 |
| `use-session-host-debug.ts` | 调试状态 | `/session` 页面直输 slash 与 script bridge 共享的 host-debug 控制器 |
| `session-host-bridge.ts` | 协议模块 | `/session` 宿主桥接协议、window key、解析工具 |
| `session-host.ts` | 宿主工具 | 默认宿主 + 注入宿主的合并与高价值命令回调 |
| `session-host-defaults.ts` | 默认能力 | `/session` 内建 translate / yt-script provider 与默认宿主实现 |
| `session-gallery.ts` | 画廊工具 | `/show-gallery` / `/list-gallery` 的最小可信素材解析 |
| `session-message-events.ts` | 消息工具 | `DreamMiniStage:*ChatMessages` 事件的解析、补丁与刷新逻辑 |
| `session-quick-reply-store.ts` | QR 适配 | Quick Reply store 到 slash 执行器接口的适配层 |
| `session-store-hosts.ts` | store 宿主 | checkpoint / group / timed-effect 宿主收口 |
| `session-slash-executor.ts` | slash 执行器 | slash 上下文组装、变量读写、Quick Reply 执行 |
| `session-switch.ts` | 工具 | 会话切换/临时会话命名策略 |
| `use-session-page-effects.tsx` | 页面副作用 | header / preset / reload / message events 副作用收口 |
| `use-session-route-state.ts` | 路由状态 | sessionId -> characterId / error 解析 |

## 最新变更（2026-03-07）

- `page.tsx` 已把 `/tempchat` 接到真实宿主：会为当前角色创建带 `[temp]` 后缀的新会话并跳转。
- `page.tsx` 已把 `/chat-jump` / `/floor-teleport` 接到真实页面锚点滚动。
- `page.tsx` 已把 `/proxy` 接到 `model-store`：支持读取当前 preset，并按名称或 `configId` 切换 active config；切换后会同步 `llmType/model/baseUrl/apiKey` 到 localStorage。
- `session-host-bridge.ts` 已统一收口 `/session` 宿主桥接协议：集中管理 `window.__DREAMMINISTAGE_SESSION_HOST__`、`translateText`、`getYouTubeTranscript` 与错误明细路径，避免魔法字符串继续散落。
- `session-host-defaults.ts` 已为 `/translate` 提供内建默认 provider：读取当前 active model preset，走 OpenAI/Ollama/Gemini 真实后端；默认 provider 名称为 `session-host`。
- `session-host-defaults.ts` 已为 `/yt-script` 提供内建默认 provider：通过 Jina Reader 拉取 YouTube 页面转储，再用当前 active model 提取 transcript/lyrics；提取不到时显式 fail-fast。
- `page.tsx` 现在会将内建默认宿主能力与 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入能力合并：`/translate` 与 `/yt-script` 默认可用，外部宿主可按协议覆盖默认实现；正式协议文档见 `docs/analysis/session-host-bridge/README.md`。
- `session-timed-world-info.ts` 已接通 `/wi-get-timed-effect` 与 `/wi-set-timed-effect`：运行时状态统一落在 dialogue root `chat_metadata.timedWorldInfo`，并按 `file -> uid -> effect` 组织。
- `session-switch.ts` 新增 `buildTemporarySessionName`，统一临时会话命名，避免页面内继续散落字符串拼接规则。

## 最新变更（2026-03-08）补充

- `page.tsx` 继续复用统一的 `syncModelConfigToStorage`，确保 `/session` 切换模型 preset 时，基础字段与高级参数一并同步到运行时存储。

## 最新变更（2026-03-13）

- `session-page-content.tsx` 现已固定 header 注入所用的 `onOpenBranches` 回调引用，避免 `useSessionHeaderContent -> setHeaderContent -> context rerender` 形成自激重渲染，消除 `/session` 首屏挂载时的 `Maximum update depth exceeded` 噪声。
- `session-host-bridge.ts` 已扩展 `/session` 宿主协议：除 `translateText/getYouTubeTranscript` 外，现还显式声明 `get/setClipboardText`、`isExtensionInstalled/getExtensionEnabledState/setExtensionEnabled`，避免 clipboard / extension-state 的宿主来源继续漂浮。
- `session-host-defaults.ts` 已补齐默认 clipboard 宿主：优先走浏览器 Clipboard API；不可用时显式 fail-fast，不再依赖隐式注入。
- `session-host-defaults.ts` 已补齐 extension-state / extension-exists 默认读路径：通过 `window.pluginRegistry` 读取安装态与 enabled 状态；扩展写操作仍不伪装成默认支持。
- `page.tsx` 现在会把默认宿主与 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入宿主合并成单一路径，并把 clipboard / extension-state 回调同时透传给页面 slash 宿主和脚本桥宿主。
- `session-host.ts` 已把 `/session` 默认宿主合并逻辑与 `translate / yt-script / clipboard / extension-state` 回调从 `page.tsx` 中提炼出来，避免页面继续堆积重复宿主 wiring。
- `session-gallery.ts` + `components/session-gallery/SessionGalleryDialog.tsx` 已补齐 `gallery` 最小产品面：`/show-gallery` 会在 `/session` 打开真实弹窗，`/list-gallery` 会返回当前角色头像列表；当前仍只支持角色画廊，不支持群组画廊。
- `session-message-events.ts` 已把 `DreamMiniStage:set|create|deleteChatMessages` 与 `refreshOneMessage` 的事件解析从 `page.tsx` 中抽离，页面只负责注册监听，不再内嵌整段消息补丁逻辑。
- `session-gallery.ts` 现已继续扩到“头像 + 会话消息中的图片链接”这一层，`/list-gallery` 不再只会返回单个 avatar。
- `session-store-hosts.ts` 已把 `checkpoint / group / timed-effect` 这批依赖 store 的 slash 宿主从 `page.tsx` 中抽出；页面现在通过单一 helper 组装这些 callback，而不是继续散落一串 `useCallback`。
- `session-gallery.ts` 现会同时收集：
  - 当前角色头像
  - opening messages 中的图片链接
  - 会话消息中的图片链接
- `page.tsx` 现已退回纯入口壳；真正的页面编排逻辑下沉到 `session-page-content.tsx`，避免入口文件继续演化成新的巨石。
- `session-slash-executor.ts` 已把 slash 执行上下文与 Quick Reply 执行路径从 `session-page-content.tsx` 中抽出；内容页不再内嵌整段 execution context 组装。
- `session-content-view.tsx` 已把主视图切换从内容页里抽成独立 router 组件，内容页不再直接堆叠多段 `characterView === ... ? ... : ...` JSX。
- `session-page-content.tsx` 已继续从“巨石内容页”拆成状态壳：
  - `use-session-route-state.ts` 负责 session 路由解析
  - `use-session-host-debug.ts` 负责 `/session` 的共享 host-debug recorder/snapshot
  - `use-session-page-effects.tsx` 负责 header / preset / reload / message events 副作用
  - `session-page-layout.tsx` 负责 chat/editor/modal 主视图装配
  - 当前 `session-page-content.tsx` 已压到 230 行级别，不再同时承担路由、effect、视图三种重职责
- `use-session-page-actions.ts` 已进一步去重并压回 400 行以内：
  - `session-dialogue-actions.ts` 收口 hide / unhide / force-save / reasoning
  - `session-quick-reply-store.ts` 收口 Quick Reply store 到 slash executor 的适配
- `/session` 页面直输 slash 与 iframe `triggerSlash` 现已共用同一 host-debug 记录链；Script Debugger 不再只能观察脚本桥路径。
- `/session` 页面直输 slash 现已继续复用共享默认 UI host：`/popup`、`/bubble`、`/default`、`/closechat` 这类原本只在 script bridge 默认路径可用的命令，现在在页面输入框里也能走同一实现。
- 第二批共享默认 UI host 也已接入 `/session` 页面直输 slash：`/theme`、`/movingui`、`/css-var`、`/panels`、`/resetpanels`、`/vn` 当前都会复用与 script bridge 相同的默认实现。
- 背景命令这组共享默认 UI host 也已接入 `/session` 页面直输 slash：`/bg`、`/lockbg`、`/unlockbg`、`/autobg` 现在与 script bridge 默认路径共用同一实现。

## 最新变更（2026-03-17）

- `session-chat-view.tsx` 已把 `MvuDebuggerPanel` 接到真实聊天页脚，MVU 不再只停留在底层存储与脚本 API。
- `/session` 当前可直接查看当前变量、指定消息快照、schema 与 delta 预览，便于作者调试 MagVarUpdate 工作流。
- `/session` 当前已继续补上状态栏预览：会把 `status_bar` 变量渲染成作者可读卡片，区分“当前状态栏”与“消息状态栏”。
- `/session` 当前已补上 MVU 路径观测：会直接显示“当前节点 / 选中节点”实际走了 `text-delta`、`function-calling` 还是 `extra-model`。
