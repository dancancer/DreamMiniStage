**一旦我所属的文件夹有所变化，请更新我**

# roleplay/

角色扮演数据操作。核心业务数据的完整 CRUD。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `character-dialogue-operation.ts` | 操作类 | 角色对话操作 |
| `character-record-operation.ts` | 操作类 | 角色记录操作 |
| `macro-variable-operation.ts` | 操作类 | 宏变量操作 |
| `memory-operation.ts` | 操作类 | 记忆操作 |
| `persona-operation.ts` | 操作类 | 人设操作 |
| `preset-operation.ts` | 操作类 | 预设操作 |
| `regex-allow-list-operation.ts` | 操作类 | 正则白名单操作 |
| `regex-preset-operation.ts` | 操作类 | 正则预设操作 |
| `regex-script-operation.ts` | 操作类 | 正则脚本操作 |
| `session-operation.ts` | 操作类 | 会话操作 |
| `world-book-operation.ts` | 操作类 | 世界书操作 |

## 最新变更（2026-03-08）

- `preset-operation.ts` 现已保留 ST 预设中的关键采样参数，导入后不会再丢失 `openai_max_context`、`openai_max_tokens`、`temperature`、`top_p` 等信息。
