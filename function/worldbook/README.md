**一旦我所属的文件夹有所变化，请更新我**

# worldbook/

世界书操作。世界书条目的完整管理功能。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `info.ts` | 操作 | 世界书信息查询 |
| `edit.ts` | 操作 | 条目编辑 |
| `delete.ts` | 操作 | 条目删除 |
| `import.ts` | 操作 | 世界书导入 |
| `settings.ts` | 操作 | 世界书设置 |
| `global.ts` | 操作 | 全局世界书 |
| `global-management.ts` | 操作 | 全局世界书管理 |
| `bulk-operations.ts` | 操作 | 批量操作 |
| `dialogue-worldbook.ts` | 操作 | 对话级世界书 |

## 最新变更（2026-06-04）

- 全局 World Book action 统一使用 `global:` record key，不再生成或扫描 `global_` 老格式。
- `dialogue-worldbook.ts` 通过 `world-book-keys.ts` 生成 `dialogue:` record key，不再手拼存储 key。
- `global.ts` 的删除路径改为 `WorldBookOperations.deleteWorldBook()`，删除主记录与 settings 记录，不再写空记录和空 metadata。
