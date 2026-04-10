**一旦我所属的文件夹有所变化，请更新我**

# PresetNode/

预设处理节点。加载和应用提示词预设模板。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `PresetNode.ts` | 节点实现 | 预设节点主逻辑 |
| `PresetNodeTools.ts` | 工具函数 | 预设处理工具 |

## 最新变更（2026-03-22）

- `PresetNodeTools.ts` 现在优先尊重 prompt-config 里的运行时选中 preset，不再只扫描持久层里 `enabled=true` 的那一条。
- 运行时指定 preset 若存在，会直接按该 preset 的 prompts 组装请求；仅在完全没有可用 preset 时才回退极简默认模板。

## 历史变更（2026-03-08）

- `PresetNodeTools.ts` 现已从内部 preset 模型恢复 ST 采样参数，避免启用预设后被默认值硬编码覆盖。
