# 06. Session Preset

> 入口：`/session?id={sessionId}` 的 preset 视图，或右侧 `presets` 面板

## 1. 用户目标

用户维护全局 prompt 预设，控制上下文结构、系统提示、prompt 条目顺序、采样参数和 instruct 后处理。

## 2. 当前定位

预设是全局工作区，不强制绑定当前角色或会话。用户从会话进入时，页面只显示当前会话角色作为上下文提示。

## 3. 预设字段

| 字段 | 说明 |
|------|------|
| `id` | 预设标识 |
| `name` | 预设名称 |
| `enabled` | 是否为 active preset |
| `prompts` | prompt 条目 |
| `prompt_order` | 排序与启用状态 |
| `sampling` | temperature/top_p/max tokens 等 |
| `context` | story string/context preset |
| `sysprompt` | 系统提示词与 post-history |
| `created_at/updated_at` | 元数据 |

## 4. Prompt 条目字段

| 字段 | 说明 |
|------|------|
| `identifier` | 条目标识 |
| `name` | 显示名 |
| `enabled` | 是否启用 |
| `marker` | 是否为占位符 |
| `role` | system/user/assistant |
| `content` | prompt 内容 |
| `forbid_overrides` | 禁止角色卡覆盖 |
| `injection_position/depth/order` | 注入控制 |

## 5. 页面交互

- 导入预设。
- 新建预设。
- 复制预设。
- 重命名预设。
- 删除预设。
- 展开预设查看 prompt 列表。
- 编辑 prompt 内容。
- 启用/禁用 preset 或 prompt。
- 按名称、prompt 数、更新时间排序。
- 按 all/active/empty 过滤。

## 6. Instruct 与后处理

当前支持内置本地模型模板：

- ChatML
- Llama 3 / Llama 2
- Mistral / Mixtral
- Alpaca
- Vicuna
- Gemma
- Phi
- Command-R

Prompt post-processing 模式来自 `PostProcessingMode`，包括 `none/merge/semi/strict/single` 等运行时模式；effective mode 由 instruct enabled 状态和显式 post-processing 配置决定。

## 7. 数据依赖

- `components/PresetEditor.tsx`
- `components/panels/PresetsPanel.tsx`
- `function/preset/global.ts`
- `function/preset/edit.ts`
- `function/preset/import.ts`
- `function/preset/download.ts`
- `lib/prompt-config/service.ts`
- `lib/prompt-config/state.ts`
- `lib/core/instruct/templates.ts`
