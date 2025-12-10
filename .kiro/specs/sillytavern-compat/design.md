# Design Document: SillyTavern Compatibility Layer

## Overview

本设计文档描述 DreamMiniStage 系统对 SillyTavern 接口兼容性的实现方案。核心目标是让现有的 SillyTavern 脚本（特别是 JS-Slash-Runner 生态中的脚本）能够在 DreamMiniStage 中无缝运行。

### 设计原则

1. **最小侵入** - 不修改现有核心架构，通过适配层实现兼容
2. **渐进增强** - 优先实现高频使用的 API，低频 API 可返回合理默认值
3. **好品味** - 用数据结构消灭分支，新增 API 只需在 handler registry 添加条目

### 当前系统状态

已实现的功能（在 `hooks/script-bridge/` 中）：
- 变量管理（variable-handlers.ts）
- Worldbook 操作（worldbook-handlers.ts）
- Lorebook 操作（lorebook-handlers.ts）
- Preset 管理（preset-handlers.ts）
- 生成控制（generation-handlers.ts）
- 消息查询（message-handlers.ts）
- MVU 状态（mvu-handlers.ts）

待实现的核心功能：
- Slash Command 解析器
- Quick Reply 触发机制
- 完整的事件系统

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        iframe 沙箱                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  slash-runner-shim.js                                    │   │
│  │  • window.TavernHelper                                   │   │
│  │  • window.SillyTavern                                    │   │
│  │  • window.DreamMiniStage                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                    postMessage                                   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     主应用 (React)                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  useScriptBridge Hook                                    │   │
│  │  • handleScriptMessage()                                 │   │
│  │  • broadcastMessage()                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Script Bridge Handler Registry                          │   │
│  │  hooks/script-bridge/index.ts                            │   │
│  │  • handleApiCall(method, args, context)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌───────────┐     ┌───────────┐     ┌───────────┐             │
│  │ variable  │     │ worldbook │     │  slash    │  ← 新增     │
│  │ handlers  │     │ handlers  │     │ handlers  │             │
│  └───────────┘     └───────────┘     └───────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Slash Command Parser

新增 `lib/slash-command/parser.ts`：

```typescript
// ════════════════════════════════════════════════════════════════
//  Slash Command 解析器
//  将命令字符串解析为可执行的命令序列
// ════════════════════════════════════════════════════════════════

interface SlashCommand {
  name: string;           // 命令名，如 "send"
  args: string[];         // 位置参数
  namedArgs: Record<string, string>;  // 命名参数
}

interface ParseResult {
  commands: SlashCommand[];
  isError: boolean;
  errorMessage?: string;
}

function parseSlashCommands(input: string): ParseResult;
```

### 2. Slash Command Executor

新增 `lib/slash-command/executor.ts`：

```typescript
// ════════════════════════════════════════════════════════════════
//  Slash Command 执行器
//  执行解析后的命令序列，支持管道传递
// ════════════════════════════════════════════════════════════════

interface ExecutionResult {
  pipe: string;           // 管道输出值
  isError: boolean;
  errorMessage?: string;
}

interface ExecutionContext {
  characterId?: string;
  messages: DialogueMessage[];
  onSend: (text: string) => Promise<void>;
  onTrigger: () => Promise<void>;
}

async function executeSlashCommands(
  commands: SlashCommand[],
  context: ExecutionContext
): Promise<ExecutionResult>;
```

### 3. Command Registry

新增 `lib/slash-command/registry.ts`：

```typescript
// ════════════════════════════════════════════════════════════════
//  命令注册表
//  好品味：用 Map 消灭 switch/case
// ════════════════════════════════════════════════════════════════

type CommandHandler = (
  args: string[],
  namedArgs: Record<string, string>,
  context: ExecutionContext,
  pipe: string
) => Promise<string>;

const COMMAND_REGISTRY: Map<string, CommandHandler> = new Map([
  ["send", handleSend],
  ["trigger", handleTrigger],
  ["setvar", handleSetVar],
  ["getvar", handleGetVar],
  // ... 更多命令
]);
```

### 4. Slash Handlers (Script Bridge)

新增 `hooks/script-bridge/slash-handlers.ts`：

```typescript
// ════════════════════════════════════════════════════════════════
//  Slash Command API Handlers
//  桥接 iframe 调用到 Slash Command 执行器
// ════════════════════════════════════════════════════════════════

export const slashHandlers: ApiHandlerMap = {
  "triggerSlash": async (args, ctx) => {
    const [command] = args as [string];
    const parsed = parseSlashCommands(command);
    if (parsed.isError) {
      return { isError: true, errorMessage: parsed.errorMessage, pipe: "" };
    }
    return executeSlashCommands(parsed.commands, {
      characterId: ctx.characterId,
      messages: ctx.messages,
      onSend: ctx.onSend,
      onTrigger: ctx.onTrigger,
    });
  },
};
```

### 5. Event System Enhancement

增强 `hooks/script-bridge/event-handlers.ts`：

```typescript
// ════════════════════════════════════════════════════════════════
//  事件系统增强
//  支持 SillyTavern 风格的事件订阅
// ════════════════════════════════════════════════════════════════

// iframe 事件监听器注册表
const iframeListeners: Map<string, Map<string, Set<Function>>> = new Map();

export const eventHandlers: ApiHandlerMap = {
  "eventOn": (args, ctx) => {
    const [eventType, handlerId] = args as [string, string];
    registerListener(ctx.iframeId, eventType, handlerId);
    return { stop: () => removeListener(ctx.iframeId, eventType, handlerId) };
  },
  "eventOnce": (args, ctx) => {
    const [eventType, handlerId] = args as [string, string];
    registerOnceListener(ctx.iframeId, eventType, handlerId);
    return { stop: () => removeListener(ctx.iframeId, eventType, handlerId) };
  },
  "eventEmit": (args, ctx) => {
    const [eventType, ...data] = args as [string, ...unknown[]];
    emitEvent(eventType, data);
    return eventType;
  },
  "eventRemoveListener": (args, ctx) => {
    const [eventType, handlerId] = args as [string, string];
    removeListener(ctx.iframeId, eventType, handlerId);
  },
  "eventClearAll": (args, ctx) => {
    clearAllListeners(ctx.iframeId);
  },
};
```

## Data Models

### SlashCommand

```typescript
interface SlashCommand {
  name: string;
  args: string[];
  namedArgs: Record<string, string>;
  raw: string;  // 原始命令字符串，用于错误报告
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  pipe: string;
  isError: boolean;
  errorMessage?: string;
  aborted?: boolean;
}
```

### EventSubscription

```typescript
interface EventSubscription {
  iframeId: string;
  eventType: string;
  handlerId: string;
  once: boolean;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following consolidated correctness properties have been identified:

### Property 1: Slash Command Parse-Execute Round-Trip

*For any* valid slash command string, parsing should produce a valid command object, and executing that command should produce a result with `isError: false` and a defined `pipe` value.

**Validates: Requirements 1.1, 1.4**

### Property 2: Pipe Propagation in Command Sequences

*For any* sequence of piped commands `/cmd1|/cmd2|/cmd3`, the output of command N should be available as input to command N+1, and the final result should contain the output of the last command.

**Validates: Requirements 1.2**

### Property 3: Error Handling for Invalid Commands

*For any* invalid command string (malformed syntax, unknown command name, or execution failure), the result should have `isError: true` and `errorMessage` should be a non-empty string describing the failure.

**Validates: Requirements 1.3, 1.5**

### Property 4: Variable CRUD Round-Trip

*For any* set of variables, the following operations should be consistent:
- After `replaceVariables(vars)`, `getVariables()` should return exactly `vars`
- After `insertOrAssignVariables(newVars)`, `getVariables()` should contain all keys from both old and new, with new values taking precedence
- After `deleteVariable(key)`, `getVariables()` should not contain `key`

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 5: Event Subscription Lifecycle

*For any* event type and handler:
- After `eventOn(type, handler)`, emitting `type` should invoke `handler`
- After `eventOnce(type, handler)`, emitting `type` twice should invoke `handler` exactly once
- After `eventRemoveListener(type, handler)`, emitting `type` should not invoke `handler`
- After iframe cleanup, no handlers from that iframe should remain registered

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 6: Message CRUD Round-Trip

*For any* chat state:
- `getChatMessages()` should return all messages in order
- After `createChatMessages(newMsgs)`, the chat length should increase by `newMsgs.length`
- After `deleteChatMessages(ids)`, none of the specified IDs should appear in `getChatMessages()`
- `getCurrentMessageId()` should return the ID of the last message in `getChatMessages()`

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 7: Lorebook Entry CRUD Round-Trip

*For any* worldbook and entry:
- After `createLorebookEntry(wb, entry)`, `getLorebookEntries(wb)` should include `entry`
- After `deleteLorebookEntry(wb, id)`, `getLorebookEntries(wb)` should not include an entry with that ID
- After `updateLorebookEntriesWith(wb, updates)`, matching entries should have the updated fields

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 8: Preset CRUD Round-Trip

*For any* preset name and configuration:
- After `createPreset(name, config)`, `getPreset(name)` should return `config`
- After `loadPreset(name)`, `getLoadedPresetName()` should return `name`
- After `deletePreset(name)`, `getPresetNames()` should not include `name`

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 9: TavernHelper API Completeness

*For any* iframe that loads the compatibility shim:
- `window.TavernHelper` should be defined and contain all expected methods
- `window.SillyTavern.getContext()` should return an object with `variables` and `sessionId`
- Each TavernHelper method call should route to the corresponding DreamMiniStage handler

**Validates: Requirements 9.1, 9.2, 9.3, 9.5**

## Error Handling

### Slash Command Errors

| Error Type | Handling Strategy |
|------------|-------------------|
| Parse Error | Return `{ isError: true, errorMessage: "Parse error at position X: ..." }` |
| Unknown Command | Return `{ isError: true, errorMessage: "Unknown command: /xyz" }` |
| Execution Error | Return `{ isError: true, errorMessage: "Command /xyz failed: ..." }` |
| Timeout | Return `{ isError: true, errorMessage: "Command /xyz timed out after 240s" }` |

### Event System Errors

| Error Type | Handling Strategy |
|------------|-------------------|
| Invalid Event Type | Log warning, proceed with registration |
| Handler Throws | Catch error, log to console, continue with other handlers |
| Circular Emit | Detect and break cycle after 100 iterations |

### API Call Errors

| Error Type | Handling Strategy |
|------------|-------------------|
| Unknown Method | Return `undefined`, log warning |
| Invalid Arguments | Throw descriptive error |
| Timeout | Reject promise after 240s |

## Testing Strategy

### Dual Testing Approach

本项目采用单元测试和属性测试相结合的策略：

- **单元测试** - 验证具体示例和边界情况
- **属性测试** - 验证跨所有输入的通用属性

### Property-Based Testing Framework

使用 **fast-check** 作为属性测试库（已在项目中使用 Vitest）。

配置要求：
- 每个属性测试运行至少 100 次迭代
- 使用 `fc.assert` 进行断言
- 每个测试必须标注对应的正确性属性

### Test File Structure

```
lib/slash-command/__tests__/
├── parser.test.ts          # 解析器单元测试
├── parser.property.test.ts # 解析器属性测试 (P1, P3)
├── executor.test.ts        # 执行器单元测试
├── executor.property.test.ts # 执行器属性测试 (P2)
└── registry.test.ts        # 命令注册表测试

hooks/script-bridge/__tests__/
├── variable-handlers.property.test.ts  # P4
├── event-handlers.property.test.ts     # P5
├── message-handlers.property.test.ts   # P6
├── lorebook-handlers.property.test.ts  # P7
├── preset-handlers.property.test.ts    # P8
└── slash-handlers.test.ts              # 集成测试

public/iframe-libs/__tests__/
└── slash-runner-shim.property.test.ts  # P9
```

### Test Annotation Format

每个属性测试必须使用以下格式标注：

```typescript
/**
 * **Feature: sillytavern-compat, Property 1: Slash Command Parse-Execute Round-Trip**
 * **Validates: Requirements 1.1, 1.4**
 */
test.prop([fc.string()], (commandStr) => {
  // ...
});
```

### Generator Strategy

为属性测试定义智能生成器：

```typescript
// 有效的 Slash 命令生成器
const validSlashCommand = fc.oneof(
  fc.constant("/send Hello"),
  fc.constant("/trigger"),
  fc.constant("/setvar key=value"),
  fc.record({
    cmd: fc.constantFrom("send", "trigger", "setvar", "getvar"),
    arg: fc.string({ minLength: 1, maxLength: 100 }),
  }).map(({ cmd, arg }) => `/${cmd} ${arg}`)
);

// 管道命令序列生成器
const pipedCommands = fc.array(validSlashCommand, { minLength: 1, maxLength: 5 })
  .map(cmds => cmds.join("|"));

// 变量对象生成器
const variablesObject = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean())
);
```
