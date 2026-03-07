**一旦我所属的文件夹有所变化，请更新我**

# session/

会话页面。角色对话的主入口，承载核心交互体验。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `page.tsx` | 页面入口 | 会话界面、slash 直达执行、宿主回调 wiring |
| `session-host-bridge.ts` | 协议模块 | `/session` 宿主桥接协议、window key、解析工具 |
| `session-switch.ts` | 工具 | 会话切换/临时会话命名策略 |

## 最新变更（2026-03-07）

- `page.tsx` 已把 `/tempchat` 接到真实宿主：会为当前角色创建带 `[temp]` 后缀的新会话并跳转。
- `page.tsx` 已把 `/chat-jump` / `/floor-teleport` 接到真实页面锚点滚动。
- `page.tsx` 已把 `/proxy` 接到 `model-store`：支持读取当前 preset，并按名称或 `configId` 切换 active config；切换后会同步 `llmType/model/baseUrl/apiKey` 到 localStorage。
- `session-host-bridge.ts` 已统一收口 `/session` 宿主桥接协议：集中管理 `window.__DREAMMINISTAGE_SESSION_HOST__`、`translateText`、`getYouTubeTranscript` 与错误明细路径，避免魔法字符串继续散落。
- `page.tsx` 已为 `/translate` 与 `/yt-script` 接入宿主 provider 入口：`window.__DREAMMINISTAGE_SESSION_HOST__`，未注入时保持显式 fail-fast；正式协议文档见 `docs/analysis/session-host-bridge/README.md`。
- `wi-* timed effect` 继续显式 fail-fast，等待 chat metadata 结构冻结后再接通。
- `session-switch.ts` 新增 `buildTemporarySessionName`，统一临时会话命名，避免页面内继续散落字符串拼接规则。
