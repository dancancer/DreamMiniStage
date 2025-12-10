# 提示词查看器资源清理系统

## 概述

提示词查看器实现了完整的资源清理和生命周期管理系统，确保不会造成内存泄漏，所有资源都能被正确释放。

## 核心组件

### 1. 资源管理器 (ResourceManager)

统一管理所有资源的生命周期：

```typescript
import { resourceManager } from "@/lib/prompt-viewer/resource-manager";

// 注册清理函数
resourceManager.registerCleanup("my-resource", async () => {
  // 清理逻辑
});

// 执行清理
await resourceManager.cleanup("my-resource");

// 清理所有资源
await resourceManager.cleanupAll();
```

### 2. 拦截器清理

PromptInterceptor 自动管理定时器和缓存：

```typescript
import { promptInterceptor } from "@/lib/prompt-viewer/prompt-interceptor";

// 拦截器会自动：
// - 启动清理定时器
// - 清理过期的拦截器配置
// - 清理角色缓存
// - 在页面卸载时销毁所有资源

// 手动销毁
promptInterceptor.destroy();
```

### 3. Store 清理

Zustand Store 提供清理方法：

```typescript
import { usePromptViewerStore } from "@/lib/store/prompt-viewer-store";

const store = usePromptViewerStore.getState();

// 清理指定对话
store.cleanup("dialogue-key");

// 清理过期数据
store.cleanupExpired();

// 销毁整个 Store
await store.destroy();
```

### 4. 组件生命周期管理

React 组件自动注册清理函数：

```typescript
import { useEffect } from "react";
import { registerComponentCleanup, unregisterComponentCleanup } from "@/lib/prompt-viewer/resource-manager";

function MyComponent({ dialogueKey }: { dialogueKey: string }) {
  useEffect(() => {
    // 注册清理函数
    registerComponentCleanup("MyComponent", dialogueKey, async () => {
      // 组件特定的清理逻辑
    });

    return () => {
      // 组件卸载时取消注册
      unregisterComponentCleanup("MyComponent", dialogueKey);
    };
  }, [dialogueKey]);

  return <div>My Component</div>;
}
```

## 清理触发时机

### 自动清理

1. **定期清理**: 每5分钟清理过期的拦截器和缓存
2. **页面隐藏**: 当页面变为隐藏状态时执行轻量清理
3. **页面卸载**: 页面卸载前清理所有资源
4. **内存压力**: 检测到内存压力时执行清理（实验性）

### 手动清理

```typescript
import { cleanupDialogue, cleanupAll, cleanupExpired } from "@/lib/prompt-viewer/cleanup";

// 清理指定对话的所有资源
await cleanupDialogue("dialogue-key");

// 清理所有提示词查看器资源
await cleanupAll();

// 清理过期资源
await cleanupExpired();
```

## 清理内容

### 拦截器清理
- 停止所有活跃的拦截
- 清理拦截器配置
- 清理角色缓存
- 停止清理定时器
- 移除事件监听器

### Store 清理
- 清理提示词数据
- 清理 UI 状态
- 清理拦截状态
- 重置为默认状态

### 组件清理
- 停止组件相关的拦截
- 清理组件状态
- 移除事件监听器
- 取消定时器

## 错误处理

清理系统具有强大的错误恢复能力：

- **部分失败继续**: 即使某个清理函数失败，其他清理仍会继续执行
- **错误隔离**: 清理错误不会影响应用的正常功能
- **优雅降级**: 在错误情况下返回安全的默认状态

## 开发工具

### 状态监控

```typescript
import { getCleanupStatus } from "@/lib/prompt-viewer/cleanup";

const status = getCleanupStatus();
console.log("清理状态:", status);
// {
//   resourceManagerDestroyed: false,
//   registeredResourceCount: 5,
//   interceptorDestroyed: false
// }
```

### 开发环境监控

在开发环境下，清理系统会：
- 在控制台输出详细的清理日志
- 定期报告清理状态
- 在 `window` 对象上暴露清理函数供调试使用

```javascript
// 在浏览器控制台中
window.__promptViewerCleanup.cleanupAll();
window.__promptViewerCleanup.getStatus();
```

## 最佳实践

### 1. 组件设计
- 总是在 `useEffect` 的清理函数中注册资源清理
- 使用 `registerComponentCleanup` 统一管理组件资源
- 避免在组件中直接操作全局资源

### 2. 错误处理
- 清理函数应该是幂等的（可以安全地多次调用）
- 清理函数不应该抛出异常
- 使用 try-catch 包装可能失败的清理操作

### 3. 性能优化
- 避免在清理函数中执行耗时操作
- 使用异步清理避免阻塞 UI
- 合理设置清理频率，避免过度清理

## 测试

资源清理系统包含完整的测试覆盖：

```bash
# 运行资源管理器测试
pnpm test lib/prompt-viewer/__tests__/resource-manager.test.ts

# 运行清理功能测试
pnpm test lib/prompt-viewer/__tests__/cleanup.test.ts

# 运行所有相关测试
pnpm test lib/prompt-viewer lib/store/__tests__/prompt-viewer-store.test.ts components/__tests__/PromptViewer
```

## 架构优势

1. **统一管理**: 所有资源清理通过统一的接口管理
2. **自动化**: 大部分清理操作自动触发，无需手动干预
3. **可靠性**: 多层次的错误处理确保清理的可靠性
4. **可观测性**: 完整的日志和状态监控
5. **可测试性**: 全面的测试覆盖确保功能正确性

这个资源清理系统确保了提示词查看器在各种使用场景下都不会造成内存泄漏，为用户提供稳定可靠的体验。