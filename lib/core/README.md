**一旦我所属的文件夹有所变化，请更新我**

# core/

核心引擎层。角色对话、提示词处理、正则引擎等核心功能实现。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `character.ts` | 核心模块 | 角色数据处理 |
| `character-dialogue.ts` | 核心模块 | 角色对话核心逻辑 |
| `character-history.ts` | 核心模块 | 对话历史管理 |
| `config-manager.ts` | 核心模块 | 配置管理器 |
| `dialogue-key.ts` | 核心模块 | 对话唯一标识生成 |
| `extension-prompts.ts` | 核心模块 | 扩展提示词处理 |
| `gemini-client.ts` | 核心模块 | Gemini API 客户端 |
| `macro-evaluator-manager.ts` | 核心模块 | 宏求值管理器 |
| `macro-substitutor.ts` | 核心模块 | 宏替换引擎 |
| `memory-manager.ts` | 核心模块 | 记忆管理器 |
| `memory-utils.ts` | 辅助工具 | 记忆工具函数 |
| `regex-debugger.ts` | 调试工具 | 正则调试器 |
| `regex-processor.ts` | 核心模块 | 正则处理引擎 |
| `st-macro-evaluator.ts` | 核心模块 | ST 宏求值器 |
| `st-preset-types.ts` | 类型定义 | ST 预设类型 |
| `token-manager.ts` | 核心模块 | Token 计数管理 |
| `trim-string-filter.ts` | 辅助工具 | 字符串裁剪过滤 |
| `world-book-advanced.ts` | 核心模块 | 高级世界书处理 |
| `prompt/` | 子目录 | 提示词处理模块 |
