# STMacroEvaluator API 文档

`STMacroEvaluator` 是 DreamMiniStage 的宏替换引擎，兼容 SillyTavern 宏格式。

## 导入

```typescript
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type { MacroEnv, MacroHandler } from "@/lib/core/st-preset-types";
```

## 构造函数

```typescript
constructor()
```

创建一个新的宏替换器实例，自动注册内置宏。

```typescript
const evaluator = new STMacroEvaluator();
```

## 方法

### evaluate()

执行完整的宏替换管线。

```typescript
evaluate(content: string, env: MacroEnv): string
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `content` | `string` | 包含宏的原始内容 |
| `env` | `MacroEnv` | 环境变量对象 |

#### 返回值

替换后的字符串。

#### 示例

```typescript
const evaluator = new STMacroEvaluator();

const result = evaluator.evaluate(
  "Hello {{user}}, I am {{char}}.",
  { user: "Alice", char: "Bob" }
);
// 输出: "Hello Alice, I am Bob."
```

### registerMacro()

注册自定义宏。

```typescript
registerMacro(name: string, handler: MacroHandler): void
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 宏名称（大小写不敏感） |
| `handler` | `MacroHandler` | 处理函数 |

#### MacroHandler 类型

```typescript
type MacroHandler = (
  args: string[],
  env: MacroEnv
) => string | undefined;
```

#### 示例

```typescript
// 简单宏
evaluator.registerMacro("version", () => "1.0.0");

// 带环境的宏
evaluator.registerMacro("greeting", (args, env) => {
  return `Hello, ${env.user}!`;
});

// 使用
evaluator.evaluate("{{version}} - {{greeting}}", { user: "Alice" });
// 输出: "1.0.0 - Hello, Alice!"
```

### unregisterMacro()

注销已注册的宏。

```typescript
unregisterMacro(name: string): boolean
```

#### 返回值

如果成功注销返回 `true`，否则返回 `false`。

### setLocalVariable()

设置本地变量。

```typescript
setLocalVariable(name: string, value: string | number): void
```

### getLocalVariable()

获取本地变量。

```typescript
getLocalVariable(name: string): string | number | undefined
```

### setGlobalVariable()

设置全局变量。

```typescript
setGlobalVariable(name: string, value: string | number): void
```

### getGlobalVariable()

获取全局变量。

```typescript
getGlobalVariable(name: string): string | number | undefined
```

### clearLocalVariables()

清除所有本地变量。

```typescript
clearLocalVariables(): void
```

### clearGlobalVariables()

清除所有全局变量。

```typescript
clearGlobalVariables(): void
```

## 内置宏

### 自动注册的宏

| 宏名 | 环境字段 |
|------|----------|
| `user` | `env.user` |
| `char` | `env.char` |
| `description` | `env.description` |
| `personality` | `env.personality` |
| `scenario` | `env.scenario` |
| `persona` | `env.persona` |
| `mesExamples` | `env.mesExamples` |
| `wiBefore` | `env.wiBefore` |
| `wiAfter` | `env.wiAfter` |
| `chatHistory` | `env.chatHistory` |
| `group` | `env.group` |

## 替换管线

宏替换按以下顺序执行：

### 1. preEnvMacros

- 变量宏 (`setvar`, `getvar`, `incvar`, `decvar`)
- 工具宏 (`trim`, `newline`, `noop`)
- 骰子宏 (`roll`)

### 2. envMacros

- 注册的宏
- 环境变量

### 3. postEnvMacros

- 时间宏 (`time`, `date`, `isodate`)
- 消息宏 (`lastMessage`, `lastUserMessage`)
- 随机宏 (`random`, `pick`)
- 注释宏 (`//`)
- 反转宏 (`reverse`)

## 类型定义

### MacroEnv

```typescript
interface MacroEnv {
  user?: string;
  char?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  persona?: string;
  mesExamples?: string;
  wiBefore?: string;
  wiAfter?: string;
  chatHistory?: string;
  group?: string;
  system?: string;
  lastMessage?: string;
  lastUserMessage?: string;
  lastCharMessage?: string;
  lastMessageId?: number;
  anchorBefore?: string;
  anchorAfter?: string;
  [key: string]: string | number | boolean | undefined;
}
```

### MacroHandler

```typescript
type MacroHandler = (
  args: string[],
  env: MacroEnv
) => string | undefined;
```

### MacroRegistry

```typescript
type MacroRegistry = Map<string, MacroHandler>;
```

## 使用示例

### 基础替换

```typescript
const evaluator = new STMacroEvaluator();

const env: MacroEnv = {
  user: "玩家",
  char: "秋青子",
};

const result = evaluator.evaluate(
  "{{user}} 正在与 {{char}} 对话。",
  env
);
// 输出: "玩家 正在与 秋青子 对话。"
```

### 变量操作

```typescript
const evaluator = new STMacroEvaluator();
const env: MacroEnv = { user: "Alice", char: "Bob" };

// 设置变量
evaluator.evaluate("{{setvar::counter::10}}", env);

// 获取变量
const value = evaluator.evaluate("{{getvar::counter}}", env);
// 输出: "10"

// 增加变量
evaluator.evaluate("{{incvar::counter}}", env);
const newValue = evaluator.evaluate("{{getvar::counter}}", env);
// 输出: "11"
```

### 随机选择

```typescript
const result = evaluator.evaluate(
  "今天的心情是: {{random::开心::难过::平静}}",
  env
);
// 输出: "今天的心情是: 开心" (随机)
```

### 时间宏

```typescript
const result = evaluator.evaluate(
  "当前时间: {{time}}, 日期: {{date}}",
  env
);
// 输出: "当前时间: 14:30:00, 日期: 2024年12月11日"
```

### 自定义宏

```typescript
const evaluator = new STMacroEvaluator();

// 注册计算宏
evaluator.registerMacro("add", (args, env) => {
  const a = parseInt(args[0] || "0", 10);
  const b = parseInt(args[1] || "0", 10);
  return String(a + b);
});

// 使用（需要自定义解析逻辑）
```

## 大小写不敏感

宏名称大小写不敏感：

```typescript
evaluator.evaluate("{{USER}}", env);  // 等效于 {{user}}
evaluator.evaluate("{{User}}", env);  // 等效于 {{user}}
evaluator.evaluate("{{user}}", env);  // 标准形式
```

## 相关文档

- [宏系统参考](./MACRO_REFERENCE.md)
- [Preset 格式说明](./PRESET_FORMAT.md)
- [STPromptManager API](./API_PROMPT_MANAGER.md)
