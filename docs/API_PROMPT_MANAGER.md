# STPromptManager API 文档

`STPromptManager` 负责根据 SillyTavern 兼容的 preset 组合宏、世界书、正则标记并生成最终消息数组。源码位于 `lib/core/prompt/manager.ts`，类型定义在 `lib/core/st-preset-types.ts`。

## 导入

```typescript
import { STPromptManager } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { PostProcessingMode } from "@/lib/core/st-preset-types";
import type {
  STCombinedPreset,
  MacroEnv,
  BuildMessagesOptions,
  ExtendedChatMessage,
  GenerationType,
  STPromptOrder,
} from "@/lib/core/st-preset-types";
```

## 构造

```typescript
const manager = new STPromptManager(preset: STCombinedPreset, macroEvaluator?: STMacroEvaluator);
```

可传入自定义 `STMacroEvaluator`，默认会创建内置实例。

## 核心方法

| 方法 | 说明 |
|------|------|
| `getOpenAIPreset()` → `STOpenAIPreset` | 获取 OpenAI 预设 |
| `getContextPreset()` → `STContextPreset` | 获取 Context 预设（无则返回默认模板） |
| `getSyspromptPreset()` → `STSyspromptPreset \| undefined` | 获取 Sysprompt 预设 |
| `getMacroEvaluator()` → `STMacroEvaluator` | 获取宏替换器实例 |
| `getPromptOrder(characterId?: number)` → `STPromptOrder \| undefined` | 获取 prompt 排序配置（优先角色专用，再回退默认） |
| `findPrompt(identifier: string)` → `STPrompt \| undefined` | 按 identifier 查找 prompt |
| `getOrderedPrompts(characterId?, generationType?)` → `STPrompt[]` | 过滤排序后的启用 prompts |
| `buildMessages(env, options?)` → `ExtendedChatMessage[]` | 生成消息数组（含宏替换、marker 展开、后处理可选） |
| `buildMessagesWithSysprompt(env, options?)` → `ExtendedChatMessage[]` | 在上述基础上插入 sysprompt |
| `buildMessagesForModel(env, modelType, options?)` → `ChatMessage[] \| ClaudeConversionResult \| GoogleConversionResult` | 针对特定模型格式化消息 |

## BuildMessagesOptions（摘要）

完整定义见 `BuildMessagesOptions`。常用字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | `number` | 使用指定角色的 prompt_order |
| `generationType` | `GenerationType` | 过滤匹配的 prompts（normal/continue 等） |
| `worldInfoDepthInjections` | `DepthInjection[]` | 插入已计算好的 World Info |
| `userInput` | `string` | 当前用户输入（用于宏与占位符） |
| `postProcessingMode` | `PostProcessingMode` | 后处理模式（默认 `NONE`） |
| `promptNames` | `PromptNames` | 名称集合，用于后处理规范化 |
| `tools` | `boolean` | 是否保留工具调用字段 |
| `prefill` | `string` | assistant 预填充内容 |
| `placeholder` | `string` | 无用户输入时的占位文本 |

## 使用示例

```typescript
import { STPromptManager } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv } from "@/lib/core/st-preset-types";

const preset = await loadPreset(); // 需包含 openai/context/sysprompt
const manager = new STPromptManager(preset, new STMacroEvaluator());

const env: MacroEnv = {
  user: "玩家",
  char: "秋青子",
  description: "秋青子是一位温柔的蛇娘秘书",
  personality: "温柔、聪慧、忠诚",
  scenario: "办公室晚班",
};

const messages = manager.buildMessages(env, {
  generationType: "normal",
  promptNames: { charName: "秋青子", userName: "玩家", groupNames: [] },
  postProcessingMode: PostProcessingMode.MERGE,
});
```

### 带 sysprompt

```typescript
const syspromptMessages = manager.buildMessagesWithSysprompt(env, {
  promptNames: { charName: "秋青子", userName: "玩家", groupNames: [] },
});
```

### 模型特定格式

```typescript
const claudePayload = manager.buildMessagesForModel(env, "claude");
const openaiPayload = manager.buildMessagesForModel(env, "openai");
```

## 参考
- 源码：`lib/core/prompt/manager.ts`
- 类型：`lib/core/st-preset-types.ts`
- 宏系统：`lib/core/st-macro-evaluator.ts`
