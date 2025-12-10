# Design Document: Session Route Refactor

## Overview

将聊天界面的路由从 `/character` 重构为 `/session`，与 session-management 功能保持一致。核心变更：

1. **新建 `/session` 路由**：作为聊天界面的主入口
2. **重定向旧路由**：`/character` 重定向到 `/session`，保持向后兼容
3. **统一内部导航**：所有代码中的导航逻辑使用新路由

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Route Layer                              │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ /session (NEW)      │  │ /character (DEPRECATED)         │   │
│  │ - 主聊天界面         │  │ - 重定向到 /session             │   │
│  │ - id 参数 (sessionId)│  │ - 兼容旧链接                    │   │
│  └──────────┬──────────┘  └───────────────┬─────────────────┘   │
│             │                             │                      │
│             ▼                             ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SessionPage Component                    ││
│  │  (原 CharacterPage，移动到 app/session/page.tsx)            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Route Structure

```
app/
├── session/
│   └── page.tsx          # 新的聊天界面（从 character/page.tsx 移动）
├── character/
│   └── page.tsx          # 重定向组件（新建）
└── character-cards/
    └── page.tsx          # 更新导航逻辑
```

### 2. Session Page Interface

```typescript
// app/session/page.tsx
// 接受 id 作为必需参数（sessionId）
// URL: /session?id={uuid}

interface SessionPageParams {
  id: string;  // 必需，会话 ID
}
```

### 3. Character Route Redirect

```typescript
// app/character/page.tsx
// 重定向逻辑：
// - /character?sessionId={id} → /session?id={id}
// - /character?id={characterId} → / (首页，显示 toast)
// - /character → / (首页)
```

### 4. Navigation Updates

需要更新的导航点：

| 文件 | 当前导航 | 新导航 |
|------|----------|--------|
| `components/HomeContent.tsx` | `/character?id=...&sessionId=...` | `/session?id=...` |
| `app/character-cards/page.tsx` | `/character?id=...&sessionId=...` | `/session?id=...` |
| `components/CharacterCardCarousel.tsx` | `/character?id=...` | 需要先创建 session |
| `components/CharacterCardGrid.tsx` | `/character?id=...` | 需要先创建 session |
| `components/panels/AdvancedSettingsPanel.tsx` | `/character?id=...` | `/session?id=...` |

## Data Models

无新增数据模型。路由参数变更：

| 参数 | 旧格式 | 新格式 |
|------|--------|--------|
| 会话标识 | `id` + `sessionId` | `id` only (sessionId) |
| URL 路径 | `/character` | `/session` |

## Error Handling

| 场景 | 处理策略 |
|------|----------|
| id 参数缺失 | 重定向到首页 |
| sessionId 无效 | 显示错误页面，提供返回首页链接 |
| 旧格式 `/character?id=...` | 重定向到首页，显示 toast 提示 |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session route loads correct session

*For any* valid sessionId stored in the Session_Store, navigating to `/session?id={sessionId}` SHALL load the chat interface with that session's data.

**Validates: Requirements 1.1**

---

### Property 2: Legacy route redirect preserves sessionId

*For any* sessionId, navigating to `/character?sessionId={id}` SHALL result in a redirect to `/session?id={id}` with the sessionId preserved.

**Validates: Requirements 2.1**

---

### Property 3: Internal navigation uses session route

*For any* navigation action that opens a session (from home page, character cards, or session creation), the resulting URL SHALL match the pattern `/session?id={uuid}`.

**Validates: Requirements 3.1, 3.2, 3.3**

---

## Testing Strategy

### Unit Testing

使用 Vitest 进行单元测试：

1. **重定向逻辑测试**：验证 `/character` 路由的重定向行为
2. **导航 URL 生成测试**：验证各组件生成的导航 URL 格式正确

### Property-Based Testing

使用 fast-check 进行属性测试：

1. **Property 2: Legacy route redirect preserves sessionId**
   - 生成随机 UUID 作为 sessionId
   - 验证重定向 URL 包含相同的 sessionId

2. **Property 3: Internal navigation uses session route**
   - 生成随机 sessionId
   - 验证导航 URL 匹配 `/session?id=...` 模式

测试配置：每个属性测试运行 100 次迭代。

每个属性测试必须使用以下格式标注：
`**Feature: session-route-refactor, Property {number}: {property_text}**`
