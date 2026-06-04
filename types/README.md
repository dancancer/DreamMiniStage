**一旦我所属的文件夹有所变化，请更新我**

# types/

跨 Module 共享的 TypeScript Interface。只放稳定契约，不放运行时 Implementation。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `character-dialogue.ts` | 对话契约 | 消息、开场选择、角色、LLM 配置、生成 Profile 与 `useCharacterDialogue` 返回类型 |
| `content-segment.ts` | 渲染契约 | HTML / sandbox 内容段类型 |
| `session.ts` | 会话契约 | 会话数据类型 |
| `slash-callback-domains.ts` | Slash host 契约 | slash callback 域分组类型 |
| `script-message.ts` | Script bridge 契约 | iframe script 消息类型 |

## 最新变更（2026-06-04）

- `character-dialogue.ts` 新增 `DialogueGenerationProfile`，让 Hook、dialogue store 与生成操作共享同一生成模型契约，避免各层维护字段副本。
- `character-dialogue.ts` 新增 `OpeningSelection` 与 `OpeningDirection`，把开场白 UI 选择状态从 `messages/index/locked` 三件套收口为单一 Interface。
