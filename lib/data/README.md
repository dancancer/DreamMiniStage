**一旦我所属的文件夹有所变化，请更新我**

# data/

数据操作层。业务数据的 CRUD 与持久化操作。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `local-storage.ts` | 核心 | IndexedDB record store、record map 读取与备份导入导出 |
| `agent/` | 子目录 | Agent 数据操作 |
| `import-export/` | 子目录 | 导入导出操作 |
| `roleplay/` | 子目录 | 角色扮演数据操作 |

## 最新变更（2026-06-04）

- `local-storage.ts` 移除未启用的 array-store 兼容路径，新增 `getRecordMap()` 作为 collection listing Interface；常规更新保持单 record 写入，只有备份恢复显式执行 full replace。
