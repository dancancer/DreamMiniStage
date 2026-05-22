# 05. Session Worldbook

> 入口：`/session?id={sessionId}` 的 worldbook 视图，或右侧 `worldbook` 面板

## 1. 用户目标

用户维护能被叙事上下文自动检索和注入的世界设定。世界书既可以绑定角色，也可以绑定当前会话，还可以作为全局设定库复用。

## 2. 层级

| 层级 | storage key | 用途 |
|------|-------------|------|
| character | `character:{characterId}` | 角色自带设定 |
| dialogue | `dialogue:{dialogueId}` | 当前会话专属设定 |
| global | `{globalBookId}` | 跨角色/跨会话复用 |

右侧 `WorldbookPanel` 提供“当前会话世界书”和“全局世界书库”两种模式。

## 3. 条目字段

| 字段 | 说明 |
|------|------|
| `entry_id/id` | 条目标识 |
| `comment` | 备注/标题 |
| `keys` | 主关键词 |
| `secondary_keys` | 次关键词 |
| `content` | 注入内容 |
| `position` | 注入位置 |
| `depth` | 注入深度 |
| `enabled` | 是否启用 |
| `use_regex` | 是否用正则匹配 |
| `selective` | 是否启用次关键词 |
| `constant` | 是否常驻 |
| `insertion_order` | 同层排序 |
| `sticky/cooldown/delay` | 时间效果 |
| `probability/group` | 概率与互斥 |

## 4. 页面交互

- 加载条目并格式化展示统计：关键词数、内容长度、导入状态、最后更新时间。
- 排序：position、priority、characterCount、keywords、comment、depth、lastUpdated。
- 过滤：all、enabled、disabled、constant、imported。
- 新建/编辑条目。
- 删除条目。
- 批量启用/禁用。
- 导入世界书。
- 在全局库中新建、启用/禁用、删除全局世界书。

## 5. 业务规则

- 内容不能为空。
- 关键词会过滤空字符串。
- 层级不可用时自动回到可用层级。
- 全局世界书在右侧面板中维护，不要求用户先进入某个会话。
- 运行时匹配和注入由 generation/runtime 与 world-book 模块完成，编辑器只负责维护资产。

## 6. 数据依赖

- `components/WorldBookEditor.tsx`
- `components/panels/WorldbookPanel.tsx`
- `function/worldbook/info.ts`
- `function/worldbook/edit.ts`
- `function/worldbook/delete.ts`
- `function/worldbook/import.ts`
- `function/worldbook/bulk-operations.ts`
- `lib/worldbook/global-client.ts`
- `lib/models/world-book-model.ts`
