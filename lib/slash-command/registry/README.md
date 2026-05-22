**一旦我所属的文件夹有所变化，请更新我**

# registry/

命令注册表。管理命令定义与处理器绑定。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出注册表功能 |
| `command-group-foundation.ts` | 命令清单 | 基础、UI、工具与数据命令 |
| `command-group-conversation.ts` | 命令清单 | 会话、消息、角色、表达式与扩展命令 |
| `command-group-generation.ts` | 命令清单 | 生成、世界书、变量与提示词命令 |
| `command-group-operators.ts` | 命令清单 | 算子与 JS-Slash-Runner 命令 |
| `types.ts` | 类型定义 | 注册表类型定义 |
| `handlers/` | 子目录 | 命令处理器集合 |
| `utils/` | 子目录 | 注册表工具函数 |
