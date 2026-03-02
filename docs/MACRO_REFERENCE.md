# 宏系统参考

本文档描述 DreamMiniStage 支持的宏替换系统，兼容 SillyTavern 宏格式。

## 概述

宏系统采用三阶段管线架构：

1. **preEnvMacros** - 预处理宏（变量宏、工具宏）
2. **envMacros** - 环境宏（用户名、角色名、注册宏）
3. **postEnvMacros** - 后处理宏（时间、消息、随机选择）

## 基础宏

### 角色信息宏

| 宏 | 说明 | 示例 |
|---|------|------|
| `{{user}}` | 用户名 | Alice |
| `{{char}}` | 角色名 | Bob |
| `{{description}}` | 角色描述 | 角色的详细描述 |
| `{{personality}}` | 角色性格 | 温柔、聪慧 |
| `{{scenario}}` | 场景 | 在办公室中 |
| `{{persona}}` | 用户人设 | 我是一名上班族 |
| `{{mesExamples}}` | 示例对话 | 对话示例内容 |

**注意**: 宏名称**大小写不敏感**，`{{USER}}`、`{{User}}`、`{{user}}` 等效。

### 旧版占位符

旧版尖括号占位符（如 `<USER>`、`<BOT>`）已不再支持运行时替换，请统一改为现代宏格式（如 `{{user}}`、`{{char}}`）。

## 变量宏

### 本地变量

| 宏 | 说明 |
|---|------|
| `{{setvar::name::value}}` | 设置本地变量 |
| `{{getvar::name}}` | 获取本地变量 |
| `{{addvar::name::value}}` | 增加变量值（数字相加，字符串拼接） |
| `{{incvar::name}}` | 变量值 +1 |
| `{{decvar::name}}` | 变量值 -1 |

### 全局变量

| 宏 | 说明 |
|---|------|
| `{{setglobalvar::name::value}}` | 设置全局变量 |
| `{{getglobalvar::name}}` | 获取全局变量 |
| `{{addglobalvar::name::value}}` | 增加全局变量值 |
| `{{incglobalvar::name}}` | 全局变量值 +1 |
| `{{decglobalvar::name}}` | 全局变量值 -1 |

### 示例

```
{{setvar::counter::10}}
当前计数: {{getvar::counter}}
{{incvar::counter}}
增加后: {{getvar::counter}}
```

输出：
```
当前计数: 10
增加后: 11
```

## 工具宏

| 宏 | 说明 | 输出 |
|---|------|------|
| `{{newline}}` | 换行符 | `\n` |
| `{{noop}}` | 空操作 | (空字符串) |
| `{{trim}}` | 删除自身及周围换行符 | (空字符串) |

### {{trim}} 特殊行为

`{{trim}}` 会删除自身以及**前后的换行符**：

```
line1
{{trim}}
line2
```

输出：
```
line1line2
```

## 随机宏

### {{random}}

从选项中随机选择一个：

```
{{random::选项A::选项B::选项C}}
```

或使用逗号分隔：

```
{{random 选项A,选项B,选项C}}
```

### {{pick}}

基于内容哈希确定性选择（相同输入总是返回相同结果）：

```
{{pick::选项A::选项B::选项C}}
```

### {{roll}}

骰子宏，返回 1 到 N 的随机整数：

```
{{roll 6}}    // 返回 1-6
{{roll 20}}   // 返回 1-20
```

## 时间宏

| 宏 | 说明 | 示例输出 |
|---|------|----------|
| `{{time}}` | 当前时间 | 14:30:00 |
| `{{date}}` | 当前日期（本地化长格式） | 2024年12月11日 |
| `{{isodate}}` | ISO 日期 | 2024-12-11 |
| `{{isotime}}` | ISO 时间 | 14:30:00 |
| `{{weekday}}` | 星期几 | 星期三 |
| `{{datetimeformat FORMAT}}` | 自定义格式 | 见下文 |

### 自定义日期格式

```
{{datetimeformat {"year":"numeric","month":"long","day":"numeric"}}}
```

## 消息宏

| 宏 | 说明 |
|---|------|
| `{{lastMessage}}` | 最后一条消息 |
| `{{lastUserMessage}}` | 最后一条用户消息 |
| `{{lastCharMessage}}` | 最后一条角色消息 |
| `{{lastMessageId}}` | 最后一条消息的 ID |

## 注释宏

注释宏会被完全移除，不产生任何输出：

```
{{// 这是注释，不会出现在输出中}}
```

## 反转宏

反转字符串：

```
{{reverse:Hello}}
```

输出：`olleH`

## World Info 宏

| 宏 | 说明 |
|---|------|
| `{{wiBefore}}` | World Info 前置内容 |
| `{{wiAfter}}` | World Info 后置内容 |

## 自定义宏注册

### TypeScript API

```typescript
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";

const evaluator = new STMacroEvaluator();

// 注册简单宏
evaluator.registerMacro("myMacro", () => "Hello World");

// 注册带环境的宏
evaluator.registerMacro("greeting", (args, env) => {
  return `Hello, ${env.user}!`;
});

// 使用
const result = evaluator.evaluate("{{myMacro}} - {{greeting}}", { user: "Alice" });
// 输出: "Hello World - Hello, Alice!"
```

### 注销宏

```typescript
evaluator.unregisterMacro("myMacro");
```

## 宏替换顺序

1. 变量宏 (`setvar`, `getvar` 等)
2. 工具宏 (`trim`, `newline`, `noop`)
3. 骰子宏 (`roll`)
4. 环境宏 (`user`, `char` 等)
5. 时间宏 (`time`, `date` 等)
6. 消息宏 (`lastMessage` 等)
7. 随机宏 (`random`, `pick`)
8. 注释宏 (`//`)
9. 反转宏 (`reverse`)

## 最佳实践

### 1. 变量初始化

在 Preset 开头初始化所有变量：

```
{{setvar::output_language::简体中文}}
{{setvar::word_min::1500}}
{{setvar::word_max::2000}}
{{trim}}
```

### 2. 使用 {{trim}} 清理空行

```
{{setvar::a::1}}{{trim}}
{{setvar::b::2}}{{trim}}
```

### 3. 条件内容

结合变量实现条件内容：

```
{{setvar::mode::creative}}
当前模式: {{getvar::mode}}
```

## 相关文档

- [Preset 格式说明](./PRESET_FORMAT.md)
- [事件系统](./EVENT_SYSTEM.md)
- [STMacroEvaluator API](./API_MACRO_EVALUATOR.md)
