# 04. Session Chat

> 路由：`/session?id={sessionId}`
> 主组件：`SessionPageContent` -> `SessionPageLayout` -> `SessionChatView` -> `CharacterChatPanel`

## 1. 用户目标

用户在一个具体会话中与角色持续叙事，并能控制生成、分支、上下文、脚本和调试工具。

## 2. 页面状态

| 状态 | 条件 | 表现 |
|------|------|------|
| 空会话 | URL 缺少 `id` | `EmptySessionScreen`，提供返回首页与创建会话 |
| 路由错误 | session 无法解析角色 | `ErrorScreen` |
| 加载中 | 角色或 dialogue tree 加载中 | `LoadingScreen` |
| 可聊天 | 角色和 dialogue 加载完成 | 渲染 chat/worldbook/preset/regex 主视图 |

## 3. 聊天字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `messages` | `useDialogueStore` | 当前 dialogue tree 的可见消息 |
| `openingMessages` | dialogue root children | 多开场白候选 |
| `openingIndex` | dialogue state | 当前开场白索引 |
| `openingLocked` | 是否已有 user 消息 | 锁定后不再切开场白 |
| `suggestedInputs` | assistant parsed content | 建议输入按钮 |
| `isSending` | dialogue state | 生成中锁 |
| `activeModes` | `useSessionToolModesStore` | 剧情推进、视角、场景过渡 |

## 4. 核心交互

| 操作 | 行为 |
|------|------|
| 发送普通文本 | 先写用户节点，再组装 prompt，调用 LLM，回填 assistant |
| 输入 slash command | 走 `createSessionSlashExecutor`，不发送给 LLM |
| 继续生成 | 调用 `triggerGeneration` |
| 再生消息 | 以当前上下文重新生成指定 assistant 节点 |
| Swipe | 切换或生成同位置替代回复 |
| 截断 | 删除指定节点之后的分支内容 |
| 隐藏/恢复 | 更新消息 hidden 状态 |
| JSONL 导入导出 | 通过右侧 SessionTools 触发 UI 事件 |
| 分支树 | 打开 `DialogueTreeModal` |
| Prompt Viewer | 查看 prompt 构成和图片素材 |

## 5. 生成链路

1. `useCharacterDialogue` 读取模型配置、语言、回复长度、fast model 和 advanced settings。
2. `handleCharacterChatRequest` 校验会话、角色、消息。
3. 读取 active prompt preset 和 prompt runtime config。
4. 确保 dialogue tree 和 opening 节点存在。
5. 先写入 pending user turn。
6. `prepareDialogueExecution` 组装 prompt、世界书、正则、MVU、向量记忆。
7. 根据 `streaming` 选择 SSE 或 buffered JSON。
8. `processPostResponseAsync` 回填 assistant，触发向量记忆、MVU 和 summary refresh。

## 6. Slash/Script Host 能力

`/session` 把默认宿主和 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入宿主合并。默认宿主提供：

- `/translate`
- `/yt-script`
- clipboard read/write
- extension installed/enabled state read
- gallery list/show
- checkpoint/group/timed world info store callbacks
- UI host commands，如 popup/bubble/theme/panels/background 等

不支持的宿主写能力必须 fail-fast，不伪装成功。

## 7. 数据依赖

- `app/session/use-session-page-actions.ts`
- `hooks/useCharacterDialogue.ts`
- `hooks/useCharacterLoader.ts`
- `function/dialogue/chat.ts`
- `function/dialogue/chat-shared.ts`
- `function/dialogue/chat-streaming.ts`
- `lib/prompt-config/service.ts`
- `lib/generation-runtime/*`
- `lib/data/roleplay/character-dialogue-operation.ts`

## 8. 非目标

- 聊天页不负责猜测缺失 session；必须让用户回首页或创建会话。
- 聊天页不直接承载所有低频工具；这些工具收口到右侧 `SessionToolsPanel`。
