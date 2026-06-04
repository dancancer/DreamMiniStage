**一旦我所属的文件夹有所变化，请更新我**

# store/

状态存储层。Zustand 状态管理与持久化。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `model-store.ts` | 存储 | 模型配置状态 |
| `persona-store.ts` | 存储 | 人设状态 |
| `prompt-viewer-store.ts` | 存储 | 提示词查看器状态 |
| `script-variables.ts` | 存储 | 脚本变量状态 |
| `session-store.ts` | 存储 | 会话状态 |
| `toast-store.ts` | 存储 | Toast 通知状态 |
| `ui-store.ts` | 存储 | UI 状态 |
| `user-store.ts` | 存储 | 用户状态 |
| `dialogue-store/` | 子目录 | 对话状态（重构版） |

## 最新变更（2026-06-04）

- `dialogue-store/actions/lifecycle-actions.ts` 删除初始化状态的单开场 fallback，统一由一个 helper 构造初始对话数据。
- `dialogue-store/types.ts` 的初始化参数不再继承生成 Profile，开场初始化路径只表达真实依赖。
- `dialogue-store/types.ts` 复用共享的 `DialogueGenerationProfile`，避免 store 层复制生成模型字段契约。

## 之前变更（2026-03-08）

- `model-store.ts` 现已把模型高级参数（context window / max tokens / penalties / streaming 等）并入同一配置对象，作为会话生成链路的单一状态源。
