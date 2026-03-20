**一旦我所属的文件夹有所变化，请更新我**

# mvu/

MVU 架构层。Model-View-Update 模式的变量与状态管理。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `index.ts` | 模块入口 | 导出 MVU 功能 |
| `types.ts` | 类型定义 | MVU 类型定义 |
| `variable-init.ts` | 核心 | 变量初始化 |
| `json-patch.ts` | 核心 | JSON Patch 操作 |
| `math-eval.ts` | 核心 | 数学表达式求值 |
| `snapshot.ts` | 核心 | 状态快照 |
| `floor-management.ts` | 核心 | 楼层管理 |
| `floor-replay.ts` | 核心 | 楼层回放 |
| `function-call.ts` | 核心 | 函数调用处理 |
| `auto-cleanup.ts` | 核心 | 自动清理 |
| `worldbook-filter.ts` | 核心 | 世界书过滤 |
| `extra-model.ts` | 核心 | 扩展模型 |
| `extra-model-runtime.ts` | 核心 | extra-model 运行时接入 |
| `protocol.ts` | 核心 | MVU 协议块清理 |
| `route-trace.ts` | 核心 | MVU 路径观测构建 |
| `core/` | 子目录 | MVU 核心引擎 |
| `data/` | 子目录 | MVU 数据层 |


## 最新变更（2026-03-09）

- `function-call.ts` 新增 Gemini 工具声明导出，MVU 工具 schema 现在由同一处定义同时服务 OpenAI 与 Gemini 调用链。

## 最新变更（2026-03-19）

- `protocol.ts` 统一收口 `<UpdateVariable>...</UpdateVariable>` 协议块的剥离逻辑，避免协议文本污染 UI、正则处理和向量记忆。
- `extra-model-runtime.ts` 已接入最小可运行的 extra-model 路径：当 Phase 6 策略显式切到 `extra-model` 时，会复用当前激活模型做二次变量解析，并将更新结果写回节点变量快照。
- `extra-model.ts` 的 `ExtraModelResponse` 现已显式返回 `updatedVariables`，不再只给出文本 delta 而无法持久化。
- `route-trace.ts` 统一构建节点级 MVU 路径观测，当前 `/session` 的 MVU Debugger 已能显示“当前节点 / 选中节点”实际走过的路径。
