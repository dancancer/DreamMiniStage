**一旦我所属的文件夹有所变化，请更新我**

# dialogue-store/

对话状态存储。重构后的对话状态管理模块。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出对话存储 |
| `types.ts` | 类型定义 | 状态类型定义 |
| `actions/` | 子目录 | 状态操作集合 |
| `utils/` | 子目录 | 工具函数 |

## 最新变更（2026-06-04）

- `types.ts` 的生成参数现在复用 `DialogueGenerationProfile`，dialogue store 不再维护一份本地 `LLMConfig` 字段副本。
