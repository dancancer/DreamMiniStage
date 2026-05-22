# 02. Character Cards

> 路由：`/character-cards`
> 创建会话模式：`/character-cards?mode=create-session`

## 1. 用户目标

用户管理角色卡资产，并从角色卡创建新的叙事会话。

## 2. 页面能力

- 加载所有角色卡。
- 支持 grid/carousel 两种展示；移动端强制 grid。
- `prefers-reduced-motion` 下禁用 carousel/tilt 这类强动效。
- 支持 PNG 多文件导入，非 PNG 文件跳过并提示。
- 支持角色编辑、删除、置顶。
- 创建会话模式下，选择角色后创建 session 并跳转 `/session?id={sessionId}`。

## 3. 字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `id` | `CharacterRecord` | 角色唯一 ID |
| `data.name` | PNG 角色卡 / 编辑器 | 显示名 |
| `data.personality` | PNG 角色卡 / 编辑器 | 角色性格信息 |
| `imagePath` | IndexedDB Blob key/data URL | 头像 |
| `order` | 本地记录 | 置顶排序依据 |
| `updated_at` | 本地记录 | 最近更新时间 |

## 4. 导入规则

- 只接受 PNG。
- 角色卡解析由 `handleCharacterUpload` 和 `function/character/import.ts` 负责。
- 导入结果可能包含角色、世界书、正则脚本等扩展摘要。
- 多文件导入按队列顺序处理，单个文件失败不应阻断全部队列。

## 5. 交互

| 操作 | 行为 |
|------|------|
| 点击角色卡 | 普通模式打开/编辑相关操作；创建模式创建新会话 |
| 置顶 | 更新 `order = Date.now()` |
| 删除 | 删除角色记录及 characterId 对应旧 dialogue tree |
| 切换视图 | 写入 `characterCardsViewMode` localStorage |

## 6. 数据依赖

- `function/character/list.ts`
- `function/character/import.ts`
- `function/character/delete.ts`
- `function/character/move-to-top.ts`
- `lib/store/session-store.ts`
- `lib/data/roleplay/character-record-operation.ts`
