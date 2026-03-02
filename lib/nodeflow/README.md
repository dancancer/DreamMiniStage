**一旦我所属的文件夹有所变化，请更新我**

# nodeflow/

节点流引擎。基于节点的工作流执行框架，串联对话生成各环节。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `WorkflowEngine.ts` | 核心引擎 | 工作流执行引擎 |
| `NodeBase.ts` | 基类 | 节点抽象基类 |
| `NodeContext.ts` | 核心 | 节点执行上下文 |
| `NodeTool.ts` | 核心 | 节点工具抽象 |
| `types.ts` | 类型定义 | 节点类型定义 |
| `ContextNode/` | 节点 | 上下文收集节点 |
| `OutputNode/` | 节点 | 输出处理节点 |
| `MemoryNode/` | 节点 | 记忆存取节点 |
| `WorldBookNode/` | 节点 | 世界书查询节点 |
| `LLMNode/` | 节点 | LLM 调用节点 |
| `PresetNode/` | 节点 | 预设处理节点 |
| `UserInputNode/` | 节点 | 用户输入节点 |
| `RegexNode/` | 节点 | 正则处理节点 |
| `PluginNode/` | 节点 | 插件执行节点 |
| `HistoryPreNode/` | 节点 | 历史预处理节点 |
