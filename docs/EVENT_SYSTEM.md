# 事件系统

本文档描述 DreamMiniStage 的事件发布/订阅系统，兼容 SillyTavern 事件类型。

## 概述

事件系统提供了一个发布/订阅机制，允许不同模块之间松耦合通信。

## 核心 API

### EventEmitter

```typescript
import { EventEmitter } from "@/lib/events/emitter";

const emitter = new EventEmitter();
```

### 订阅事件

```typescript
// 订阅特定事件
emitter.on("GENERATION_STARTED", (data) => {
  console.log("Generation started:", data);
});

// 一次性订阅
emitter.once("MESSAGE_RECEIVED", (data) => {
  console.log("First message:", data);
});

// 订阅所有事件
emitter.onAny((data) => {
  console.log("Any event:", data);
});

// 带优先级订阅（数字越小优先级越高）
emitter.on("GENERATION_STARTED", handler, { priority: 10 });
```

### 取消订阅

```typescript
// 取消特定处理器
emitter.off("GENERATION_STARTED", handler);

// 取消所有处理器
emitter.offAll("GENERATION_STARTED");
```

### 发布事件

```typescript
// 同步发布
emitter.emit("GENERATION_STARTED", {
  type: "GENERATION_STARTED",
  timestamp: Date.now(),
  generationType: "normal",
});

// 异步发布（等待所有处理器完成）
await emitter.emitAsync("MESSAGE_RECEIVED", {
  type: "MESSAGE_RECEIVED",
  timestamp: Date.now(),
  message: "Hello",
});
```

## 事件类型

### 生成相关事件

| 事件 | 说明 | 数据 |
|------|------|------|
| `GENERATION_STARTED` | 生成开始 | `{ generationType, isDryRun }` |
| `GENERATION_ENDED` | 生成结束 | `{ generationType, result }` |
| `GENERATION_STOPPED` | 生成中止 | `{ reason }` |

### 消息相关事件

| 事件 | 说明 | 数据 |
|------|------|------|
| `MESSAGE_RECEIVED` | 收到消息 | `{ message, messageId }` |
| `MESSAGE_SENT` | 发送消息 | `{ message, messageId }` |
| `MESSAGE_EDITED` | 编辑消息 | `{ messageId, oldContent, newContent }` |
| `MESSAGE_DELETED` | 删除消息 | `{ messageId }` |
| `MESSAGE_SWIPED` | 切换消息 | `{ messageId, direction }` |

### 聊天相关事件

| 事件 | 说明 | 数据 |
|------|------|------|
| `CHAT_CHANGED` | 切换聊天 | `{ chatId }` |
| `CHAT_CREATED` | 创建聊天 | `{ chatId }` |
| `CHAT_DELETED` | 删除聊天 | `{ chatId }` |

### 角色相关事件

| 事件 | 说明 | 数据 |
|------|------|------|
| `CHARACTER_SELECTED` | 选择角色 | `{ characterId }` |
| `CHARACTER_EDITED` | 编辑角色 | `{ characterId }` |

### World Info 事件

| 事件 | 说明 | 数据 |
|------|------|------|
| `WORLD_INFO_ACTIVATED` | World Info 激活 | `{ entries }` |

## 事件数据结构

所有事件数据必须包含 `type` 和 `timestamp` 字段：

```typescript
interface EventData {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}
```

### 示例

```typescript
// GENERATION_STARTED 事件
{
  type: "GENERATION_STARTED",
  timestamp: 1702300000000,
  generationType: "normal",
  isDryRun: false
}

// MESSAGE_RECEIVED 事件
{
  type: "MESSAGE_RECEIVED",
  timestamp: 1702300001000,
  message: "Hello, how are you?",
  messageId: "msg_123",
  role: "user"
}
```

## 优先级

处理器按优先级顺序执行，数字越小优先级越高：

```typescript
emitter.on("EVENT", handlerA, { priority: 10 });  // 先执行
emitter.on("EVENT", handlerB, { priority: 20 });  // 后执行
emitter.on("EVENT", handlerC);                     // 默认优先级 100
```

## 错误处理

单个处理器抛出错误不会影响其他处理器的执行：

```typescript
emitter.on("EVENT", () => {
  throw new Error("Handler error");
});

emitter.on("EVENT", () => {
  console.log("This will still execute");
});

emitter.emit("EVENT", data);  // 两个处理器都会被调用
```

## 异步处理

使用 `emitAsync` 等待所有异步处理器完成：

```typescript
emitter.on("EVENT", async (data) => {
  await someAsyncOperation();
});

// 等待所有处理器完成
await emitter.emitAsync("EVENT", data);
```

## 使用示例

### 监听生成事件

```typescript
import { eventEmitter } from "@/lib/events";
import { EVENT_TYPES } from "@/lib/events/types";

// 监听生成开始
eventEmitter.on(EVENT_TYPES.GENERATION_STARTED, (data) => {
  console.log(`Generation started: ${data.generationType}`);
});

// 监听生成结束
eventEmitter.on(EVENT_TYPES.GENERATION_ENDED, (data) => {
  console.log(`Generation ended with result: ${data.result}`);
});
```

### 监听消息事件

```typescript
eventEmitter.on(EVENT_TYPES.MESSAGE_RECEIVED, (data) => {
  // 处理收到的消息
  processMessage(data.message);
});
```

### 在 React 组件中使用

```typescript
import { useEffect } from "react";
import { eventEmitter } from "@/lib/events";

function MyComponent() {
  useEffect(() => {
    const handler = (data) => {
      // 处理事件
    };

    eventEmitter.on("EVENT", handler);

    return () => {
      eventEmitter.off("EVENT", handler);
    };
  }, []);

  return <div>...</div>;
}
```

## 与 SillyTavern 兼容性

DreamMiniStage 的事件系统设计兼容 SillyTavern 的 `eventSource`：

| SillyTavern | DreamMiniStage |
|-------------|----------------|
| `eventSource.on()` | `eventEmitter.on()` |
| `eventSource.once()` | `eventEmitter.once()` |
| `eventSource.emit()` | `eventEmitter.emit()` |
| `eventSource.emitAndWait()` | `eventEmitter.emitAsync()` |

## 相关文档

- [Preset 格式说明](./PRESET_FORMAT.md)
- [宏系统参考](./MACRO_REFERENCE.md)
- [SillyTavern 兼容性分析](./sillytavern-gap-analysis.md)
