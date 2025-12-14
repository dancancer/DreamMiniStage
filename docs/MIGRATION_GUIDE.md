# 迁移指南

本文档帮助你从旧版本迁移到新版本，以及从 SillyTavern 导入预设。

## 从 SillyTavern 导入预设

### 导出 SillyTavern 预设

1. 在 SillyTavern 中打开 **AI Response Configuration**
2. 点击 **Export** 按钮
3. 保存 `.json` 文件

### 导入到 DreamMiniStage

1. 将导出的 `.json` 文件放入项目目录
2. 使用 `STPromptManager` 加载：

```typescript
import { readFileSync } from "fs";
import { STPromptManager } from "@/lib/core/prompt";

const presetData = JSON.parse(readFileSync("preset.json", "utf-8"));
const manager = new STPromptManager({ openai: presetData });
```

### 兼容性说明

| 功能 | 支持状态 |
|------|----------|
| prompts 数组 | ✅ 完全支持 |
| prompt_order | ✅ 完全支持 |
| 采样参数 | ✅ 完全支持 |
| 宏替换 | ✅ 完全支持 |
| INJECTION_POSITION | ✅ 完全支持 |
| injection_depth | ✅ 完全支持 |
| injection_trigger | ✅ 完全支持 |
| marker prompts | ✅ 完全支持 |
| 正则脚本 | ⚠️ 部分支持 |
| extensions | ⚠️ 部分支持 |

## 从旧版 PresetAssembler 迁移

### 旧版代码

```typescript
// ❌ 旧方式 (已废弃)
import { PresetAssembler } from "@/lib/core/preset-assembler";

const { systemMessage, userMessage } = PresetAssembler.assemblePrompts(
  prompts,
  language,
  fastModel,
  contextData,
  systemPresetType
);
```

### 新版代码

```typescript
// ✅ 新方式
import { STPromptManager } from "@/lib/core/prompt";
import type { STCombinedPreset, MacroEnv } from "@/lib/core/st-preset-types";

// 加载预设
const preset: STCombinedPreset = await loadPreset();
const manager = new STPromptManager(preset);

// 构建消息
const env: MacroEnv = {
  user: contextData.username,
  char: contextData.charName,
  description: characterDescription,
  personality: characterPersonality,
  scenario: scenario,
};

const messages = manager.buildMessages(env);
```

### 主要变化

| 旧版 | 新版 |
|------|------|
| `PresetAssembler.assemblePrompts()` | `manager.buildMessages()` |
| 返回 `{ systemMessage, userMessage }` | 返回 `ChatMessage[]` |
| 固定的 prompt 顺序 | 动态 `prompt_order` |
| 简单字符串替换 | 完整宏系统 |

## 从旧版宏系统迁移

### 旧版代码

```typescript
// ❌ 旧方式
import { MacroSubstitutor } from "@/lib/core/macro-substitutor";

const result = MacroSubstitutor.substitute(content, {
  user: "Alice",
  char: "Bob",
});
```

### 新版代码

```typescript
// ✅ 新方式
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";

const evaluator = new STMacroEvaluator();
const result = evaluator.evaluate(content, {
  user: "Alice",
  char: "Bob",
});
```

### 新增功能

- ✅ 大小写不敏感 (`{{USER}}` = `{{user}}`)
- ✅ 旧版占位符 (`<USER>`, `<BOT>`)
- ✅ 变量宏 (`setvar`, `getvar`, `incvar`, `decvar`)
- ✅ 全局变量 (`setglobalvar`, `getglobalvar`)
- ✅ 工具宏 (`trim`, `newline`, `noop`)
- ✅ 随机宏 (`random`, `pick`, `roll`)
- ✅ 时间宏 (`time`, `date`, `isodate`)
- ✅ 自定义宏注册

## 从旧版 World Book 迁移

### 旧版代码

```typescript
// ❌ 旧方式
import { WorldBookManager } from "@/lib/core/world-book";

const manager = new WorldBookManager();
const entries = manager.getMatchingEntries(message, history);
```

### 新版代码

```typescript
// ✅ 新方式
import { WorldBookAdvancedManager } from "@/lib/core/world-book-advanced";

const manager = new WorldBookAdvancedManager();
manager.addEntries(entries, "character");

const matched = manager.getMatchingEntries(message, history, {
  enableProbability: true,
  enableTimeEffects: true,
});
```

### 新增功能

- ✅ 次关键词逻辑 (AND, OR, NOT)
- ✅ 深度注入
- ✅ 时间效果 (sticky, cooldown, delay)
- ✅ 互斥组
- ✅ 概率激活
- ✅ 来源优先级

## 事件系统迁移

### 旧版代码

```typescript
// ❌ 旧方式 (window 事件)
window.dispatchEvent(new CustomEvent("generation-started", { detail: data }));
window.addEventListener("generation-started", handler);
```

### 新版代码

```typescript
// ✅ 新方式
import { eventEmitter } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/events/types";

eventEmitter.emit(EVENT_TYPES.GENERATION_STARTED, {
  type: "GENERATION_STARTED",
  timestamp: Date.now(),
  generationType: "normal",
});

eventEmitter.on(EVENT_TYPES.GENERATION_STARTED, handler);
```

## 类型迁移

### 旧版类型

```typescript
// ❌ 旧类型
interface PresetPrompt {
  identifier: string;
  content: string;
  enabled: boolean;
}
```

### 新版类型

```typescript
// ✅ 新类型
import type { STPrompt, STOpenAIPreset, MacroEnv } from "@/lib/core/st-preset-types";

interface STPrompt {
  identifier: string;
  name: string;
  role: "system" | "user" | "assistant";
  content?: string;
  enabled?: boolean;
  injection_position?: number;
  injection_depth?: number;
  injection_order?: number;
  injection_trigger?: string;
  marker?: boolean;
  system_prompt?: boolean;
  forbid_overrides?: boolean;
}
```

## 常见问题

### Q: 宏不工作了？

确保使用正确的格式：
- ✅ `{{user}}` - 正确
- ❌ `{{ user }}` - 错误（有空格）
- ❌ `{user}` - 错误（单花括号）

### Q: 预设加载失败？

检查 JSON 格式是否正确，特别是：
- `prompts` 数组中每个对象必须有 `identifier` 和 `name`
- `prompt_order` 必须包含 `character_id` 和 `order`

### Q: 消息顺序不对？

检查 `prompt_order` 配置，确保：
- 使用正确的 `character_id`（默认 100001）
- `enabled` 字段设置正确

### Q: World Info 不匹配？

检查：
- 条目的 `enabled` 是否为 `true`
- 关键词是否正确
- 如果使用次关键词，检查 `selectiveLogic` 设置

## 相关文档

- [Preset 格式说明](./PRESET_FORMAT.md)
- [宏系统参考](./MACRO_REFERENCE.md)
- [事件系统](./EVENT_SYSTEM.md)
- [STPromptManager API](./API_PROMPT_MANAGER.md)
- [STMacroEvaluator API](./API_MACRO_EVALUATOR.md)
