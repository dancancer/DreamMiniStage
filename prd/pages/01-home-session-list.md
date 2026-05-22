# 01. Home Session List

> 路由：`/`
> 入口：`app/page.tsx` -> `components/HomeContent.tsx`

## 1. 用户目标

用户打开产品后首先看到已有会话，并能继续叙事、管理会话名称，或创建新会话。

## 2. 页面结构

- 顶部文案：`Session Stage / 会话舞台`。
- 主操作：`New Session`，跳转 `/character-cards?mode=create-session`。
- 会话列表：`components/home/SessionList.tsx` 渲染 `SessionCard`。
- 空状态：没有会话时展示创建会话入口。
- 弹窗：会话重命名、删除确认。

## 3. 字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `session.id` | `sessions_record` | 会话唯一 ID |
| `session.name` | `sessions_record` | 用户可编辑的会话名 |
| `characterName` | `characters_record` 补全 | 会话绑定角色名 |
| `characterAvatar` | `characters_record` 补全 | 会话卡头像 |
| `updatedAt` | `sessions_record` | 排序与展示时间 |

## 4. 交互

| 操作 | 行为 |
|------|------|
| 打开会话 | 跳转 `/session?id={sessionId}` |
| 新建会话 | 跳转角色卡库创建模式 |
| 重命名 | 校验非空后调用 `useSessionStore.updateSessionName` |
| 删除 | 删除 session 及对应 dialogue tree |

## 5. 状态与异常

- 初次 mounted 后调用 `fetchAllSessions`。
- 加载中显示列表 loading 状态。
- 删除/重命名失败时通过 toast 或弹窗状态反馈。
- 被删除角色的会话仍可被补全为“已删除的角色”，但进入聊天会失败并显示错误。

## 6. 数据依赖

- `lib/store/session-store.ts`
- `lib/data/roleplay/session-operation.ts`
- `lib/data/roleplay/character-record-operation.ts`
- `lib/data/roleplay/character-dialogue-operation.ts`
