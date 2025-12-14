# SillyTavern Preset 格式说明

本文档描述 DreamMiniStage 支持的 SillyTavern Preset 格式。

## 概述

DreamMiniStage 兼容 SillyTavern 的三层预设结构：

1. **OpenAI Preset** - prompts 数组 + prompt_order 排序 + 采样参数
2. **Context Preset** - story_string Handlebars 模板
3. **Sysprompt Preset** - content + post_history

## OpenAI Preset 格式

### 基础结构

```json
{
  "temperature": 1.0,
  "top_p": 0.9,
  "frequency_penalty": 0.2,
  "presence_penalty": 0,
  "openai_max_context": 128000,
  "openai_max_tokens": 4096,
  "prompts": [...],
  "prompt_order": [...]
}
```

### 采样参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `temperature` | number | 温度，控制随机性 (0-2) |
| `top_p` | number | 核采样概率 (0-1) |
| `top_k` | number | Top-K 采样 |
| `frequency_penalty` | number | 频率惩罚 (-2 到 2) |
| `presence_penalty` | number | 存在惩罚 (-2 到 2) |
| `openai_max_context` | number | 最大上下文长度 |
| `openai_max_tokens` | number | 最大生成长度 |

### Prompt 定义

```json
{
  "identifier": "main",
  "name": "Main Prompt",
  "role": "system",
  "content": "You are {{char}}, talking to {{user}}.",
  "enabled": true,
  "injection_position": 0,
  "injection_depth": 4,
  "injection_order": 100,
  "injection_trigger": null,
  "system_prompt": false,
  "marker": false,
  "forbid_overrides": false
}
```

#### Prompt 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `identifier` | string | ✅ | 唯一标识符 |
| `name` | string | ✅ | 显示名称 |
| `role` | string | ✅ | 消息角色: `system`, `user`, `assistant` |
| `content` | string | - | 提示词内容，支持宏替换 |
| `enabled` | boolean | - | 是否启用 (默认 true) |
| `injection_position` | number | - | 注入位置: 0=相对, 1=绝对 |
| `injection_depth` | number | - | 绝对注入深度 (从底部计算) |
| `injection_order` | number | - | 同深度时的排序优先级 |
| `injection_trigger` | string | - | 生成类型触发器 |
| `system_prompt` | boolean | - | 是否为系统提示词 |
| `marker` | boolean | - | 是否为占位符标记 |
| `forbid_overrides` | boolean | - | 禁止角色卡覆盖 |

### 注入位置 (INJECTION_POSITION)

```typescript
const INJECTION_POSITION = {
  RELATIVE: 0,  // 按 prompt_order 排序
  ABSOLUTE: 1,  // 注入到聊天历史的特定深度
};
```

- **RELATIVE (0)**: 按 `prompt_order` 中的顺序排列
- **ABSOLUTE (1)**: 注入到聊天历史的 `injection_depth` 位置

### 标准 Marker Identifiers

| Identifier | 说明 |
|------------|------|
| `main` | 主系统提示词 |
| `nsfw` | 辅助提示词 |
| `jailbreak` | 历史后指令 |
| `worldInfoBefore` | World Info 前置注入点 |
| `worldInfoAfter` | World Info 后置注入点 |
| `charDescription` | 角色描述 |
| `charPersonality` | 角色性格 |
| `scenario` | 场景 |
| `personaDescription` | 用户人设 |
| `dialogueExamples` | 示例对话 |
| `chatHistory` | 聊天历史 |

### Prompt Order

```json
{
  "prompt_order": [
    {
      "character_id": 100001,
      "order": [
        { "identifier": "main", "enabled": true },
        { "identifier": "worldInfoBefore", "enabled": true },
        { "identifier": "charDescription", "enabled": true },
        { "identifier": "jailbreak", "enabled": true }
      ]
    }
  ]
}
```

- `character_id: 100001` - 默认配置
- `character_id: 100000` - 备用默认
- 其他 ID - 角色特定配置

## Context Preset 格式

```json
{
  "name": "default",
  "story_string": "{{description}}\n{{personality}}\n{{scenario}}",
  "example_separator": "---",
  "chat_start": "[Start]"
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `story_string` | Handlebars 模板，定义故事字符串结构 |
| `example_separator` | 示例对话分隔符 |
| `chat_start` | 聊天开始标记 |

## Sysprompt Preset 格式

```json
{
  "name": "custom_sysprompt",
  "content": "系统提示词内容...",
  "post_history": "历史后指令..."
}
```

## 完整示例

```json
{
  "temperature": 1.5,
  "top_p": 0.92,
  "frequency_penalty": 0.2,
  "prompts": [
    {
      "identifier": "main",
      "name": "主提示词",
      "role": "system",
      "content": "你是 {{char}}，正在与 {{user}} 对话。"
    },
    {
      "identifier": "worldInfoBefore",
      "name": "World Info Before",
      "role": "system",
      "marker": true,
      "system_prompt": true
    },
    {
      "identifier": "charDescription",
      "name": "角色描述",
      "role": "system",
      "marker": true,
      "system_prompt": true
    },
    {
      "identifier": "jailbreak",
      "name": "破限",
      "role": "system",
      "content": "请自由发挥创意..."
    },
    {
      "identifier": "depth_inject",
      "name": "深度注入",
      "role": "system",
      "content": "这是深度注入内容",
      "injection_position": 1,
      "injection_depth": 2,
      "injection_order": 100
    }
  ],
  "prompt_order": [
    {
      "character_id": 100001,
      "order": [
        { "identifier": "main", "enabled": true },
        { "identifier": "worldInfoBefore", "enabled": true },
        { "identifier": "charDescription", "enabled": true },
        { "identifier": "jailbreak", "enabled": true },
        { "identifier": "depth_inject", "enabled": true }
      ]
    }
  ]
}
```

## 导入 SillyTavern Preset

DreamMiniStage 可以直接导入 SillyTavern 导出的 `.json` 预设文件：

1. 在 SillyTavern 中导出预设
2. 在 DreamMiniStage 中选择"导入预设"
3. 选择导出的 `.json` 文件

## 相关文档

- [宏系统参考](./MACRO_REFERENCE.md)
- [事件系统](./EVENT_SYSTEM.md)
- [SillyTavern 兼容性分析](./sillytavern-gap-analysis.md)
