**一旦我所属的文件夹有所变化，请更新我**

# session/

会话页面。角色对话的主入口，承载核心交互体验。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `page.tsx` | 页面入口 | 会话界面、slash 直达执行、宿主回调 wiring |
| `session-switch.ts` | 工具 | 会话切换/临时会话命名策略 |

## 最新变更（2026-03-06）

- `page.tsx` 已把 `/tempchat` 接到真实宿主：会为当前角色创建带 `[temp]` 后缀的新会话并跳转。
- `page.tsx` 已把 `/chat-jump` / `/floor-teleport` 接到真实页面锚点滚动；未接通的 `translate / proxy / yt-script / wi-* timed effect` 统一显式 fail-fast。
- `session-switch.ts` 新增 `buildTemporarySessionName`，统一临时会话命名，避免页面内继续散落字符串拼接规则。
