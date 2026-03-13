# Phase 5 Host Capability Matrix

## 目的

这份文档是 `JS-Slash-Runner` 在 DreamMiniStage 当前产品宿主中的单一语义说明书。
它回答的不是“API 或命令有没有定义”，而是：

- 当前产品宿主是否真实支持
- 支持是否默认可用
- 是否需要额外宿主注入
- 是否明确不支持
- 调试面会把它解释成什么来源

单一事实源代码位于：
- `hooks/script-bridge/host-capability-matrix.ts`
- `hooks/script-bridge/host-debug-resolver.ts`

---

## 判定标准

- `默认支持`
  - 当前产品宿主直接可用
  - 用户无需额外注入宿主回调
  - 调试面会记录真实来源（`session-default` 或 `bridge-only`）

- `条件支持`
  - 当前不默认可用
  - 需要外部宿主显式注入才能启用
  - 未注入时必须 fail-fast，不允许静默兼容

- `显式不支持`
  - 当前产品明确不做
  - 不提供隐式 fallback
  - 文档中直接写明边界，避免用户误判

---

## 默认支持

### `/session` 默认宿主

这些能力在 `/session` 页面中已经有真实产品路径或真实状态源：

| Capability ID | Area | Host Source | Product Entry | 说明 |
|---|---|---|---|---|
| `extension-state-read` | `extension-state` | `session-default` | no | 读取安装态 / enabled 状态 |
| `clipboard-bridge` | `clipboard` | `session-default` | no | 读写浏览器剪贴板 |
| `audio-channel-control` | `audio` | `session-default` | yes | 音频通道控制 |
| `gallery-browser` | `gallery` | `session-default` | yes | avatar / opening / chat 图片集合 |
| `session-navigation` | `navigation` | `session-default` | yes | `tempchat` / `chat-jump` / `floor-teleport` |
| `proxy-preset` | `proxy` | `session-default` | yes | `/proxy` 切模型 preset |
| `quick-reply-execution` | `quick-reply` | `session-default` | yes | `/qr` 与 Quick Reply 面板 |
| `checkpoint-navigation` | `checkpoint` | `session-default` | yes | `/checkpoint-*` / branch |
| `group-member-management` | `group-member` | `session-default` | yes | `/member-*` / `enable` / `disable` |
| `session-translation` | `translation` | `session-default` | yes | `/translate` 默认与注入宿主 |
| `youtube-transcript` | `youtube-transcript` | `session-default` | yes | `/yt-script` 默认与注入宿主 |
| `timed-world-info` | `timed-world-info` | `session-default` | yes | `/wi-*` |

### bridge-only 默认宿主

这些能力不依赖 `/session` 专有 store，但在当前浏览器运行时已有默认实现；页面直输 slash 和 script bridge 现已复用同一条默认路径：

| Capability ID | Area | Host Source | Product Entry | 说明 |
|---|---|---|---|---|
| `function-tool-registry` | `tool-registration` | `bridge-only` | no | function tool 注册 / 观察 |
| `ui-style-control` | `ui-style` | `bridge-only` | yes | `bgcol` / `bubble` / `default` / `theme` / `movingui` / `css-var` |
| `popup-interaction` | `popup` | `bridge-only` | yes | `popup` / `buttons` / `pick-icon` |
| `device-capability-read` | `device` | `bridge-only` | no | `is-mobile` |
| `chat-window-control` | `chat-control` | `bridge-only` | no | `closechat` |
| `panel-layout-control` | `panel-layout` | `bridge-only` | yes | `panels` / `resetpanels` / `vn` |
| `background-control` | `background` | `bridge-only` | yes | `bg` / `lockbg` / `unlockbg` / `autobg` |

---

## 条件支持

| Capability ID | Area | Host Source | 说明 |
|---|---|---|---|
| `extension-state-write` | `extension-state` | `api-context` | `extension-enable` / `extension-disable` / `extension-toggle` 必须显式注入 writer；未注入时 fail-fast |

---

## 显式不支持

这些边界当前已经明确，不做静默兼容：

| 场景 | 说明 |
|---|---|
| `group gallery` | 当前 `gallery` 只覆盖角色 avatar、opening messages、chat messages 中可解析图片；群组画廊不支持 |
| 未注入的 extension write | 不伪装成默认支持，直接 fail-fast |
| 任何未进入矩阵的命令域 | 不宣称已经产品化；若无默认 host 且无显式注入，应维持 fail-fast |

---

## 当前结论

到当前阶段，Phase 5 已经完成了两件事：

1. 高价值宿主能力已经被拉通到真实产品路径或真实默认宿主路径
2. 默认支持 / 条件支持 / 显式不支持 已经可以通过单一矩阵和调试面解释

因此，Phase 5 后续若继续推进，不应再做“盲目横向扩命令覆盖”，而应只处理两类工作：

- 是否还有新的高价值命令域值得进入矩阵
- 是否要把当前文档中标记为显式不支持的边界继续产品化
