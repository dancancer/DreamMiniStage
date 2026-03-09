**一旦我所属的文件夹有所变化，请更新我**

# dialogue/

对话操作。对话消息的生成、编辑、删除等核心功能。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `chat.ts` | 核心操作 | 对话生成主入口与非流式路径 |
| `chat-shared.ts` | 核心操作 | workflow 参数构建与响应后处理共享逻辑 |
| `chat-streaming.ts` | 核心操作 | buffered chunked delivery 流式响应封装 |
| `init.ts` | 操作 | 对话初始化 |
| `opening.ts` | 操作 | 开场白处理 |
| `edit.ts` | 操作 | 消息编辑 |
| `delete.ts` | 操作 | 消息删除 |
| `truncate.ts` | 操作 | 对话截断 |
| `update.ts` | 操作 | 消息更新 |
| `info.ts` | 操作 | 对话信息查询 |
| `incremental-info.ts` | 操作 | 增量信息更新 |
| `save-prompts.ts` | 操作 | 提示词保存 |
| `swipe.ts` | 操作 | 滑动变体 |
| `jsonl.ts` | 操作 | JSONL 导入导出 |
| `processed-dialogue.ts` | 操作 | 处理后对话数据 |

## 最新变更（2026-03-09）

- `chat.ts` 现只保留主入口与非流式路径；流式 SSE 实现拆到 `chat-streaming.ts`，共享 workflow/后处理逻辑拆到 `chat-shared.ts`，单文件重新回到 400 行以内。

## 之前变更（2026-03-03）

- `chat.ts` 已改为“先落库用户输入，再触发生成，再回填 assistant 响应”单路径，确保 `401/工作流失败` 后刷新仍可看到用户输入。
