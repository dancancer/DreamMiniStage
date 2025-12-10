# Design Document: Session Management

## Overview

本设计将 DreamMiniStage 首页从静态品牌展示页改造为会话管理中心。核心变更包括：

1. **数据模型重构**：引入独立的 Session 实体，解耦角色卡与对话树的 1:1 绑定关系
2. **存储层扩展**：新增 `sessions` IndexedDB 存储，管理会话元数据
3. **状态管理**：新增 `session-store.ts` Zustand store，管理会话列表状态
4. **UI 组件**：重构 HomeContent 组件，新增会话列表、会话卡片、编辑/删除弹窗

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ HomeContent │  │ SessionCard │  │ SessionEditModal        │  │
│  │ (会话列表)   │  │ (会话卡片)   │  │ (编辑/删除确认)          │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      State Layer (Zustand)                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    useSessionStore                          ││
│  │  - sessions: Session[]                                      ││
│  │  - createSession(characterId) → sessionId                   ││
│  │  - updateSessionName(sessionId, name)                       ││
│  │  - deleteSession(sessionId)                                 ││
│  │  - fetchAllSessions()                                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ SessionOperations   │  │ CharacterDialogueOperations     │   │
│  │ (会话 CRUD)          │  │ (对话树 CRUD - 按 sessionId)     │   │
│  └──────────┬──────────┘  └───────────────┬─────────────────┘   │
│             │                             │                      │
│             ▼                             ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    IndexedDB                                ││
│  │  sessions_record  │  character_dialogues  │  characters     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Session Data Model

```typescript
// types/session.ts
interface Session {
  id: string;                    // UUID，会话唯一标识
  characterId: string;           // 关联的角色卡 ID
  name: string;                  // 用户自定义会话名称
  createdAt: string;             // ISO 8601 创建时间
  updatedAt: string;             // ISO 8601 最后更新时间
}

interface SessionWithCharacter extends Session {
  characterName: string;         // 角色名称（展示用）
  characterAvatar: string;       // 角色头像路径（展示用）
}
```

### 2. Session Store Interface

```typescript
// lib/store/session-store.ts
interface SessionState {
  sessions: SessionWithCharacter[];
  isLoading: boolean;
  
  // Actions
  fetchAllSessions: () => Promise<void>;
  createSession: (characterId: string) => Promise<string>;
  updateSessionName: (sessionId: string, name: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  getSessionById: (sessionId: string) => SessionWithCharacter | undefined;
}
```

### 3. Session Operations Interface

```typescript
// lib/data/roleplay/session-operation.ts
class SessionOperations {
  static createSession(characterId: string, name: string): Promise<Session>;
  static getAllSessions(): Promise<Session[]>;
  static getSessionById(sessionId: string): Promise<Session | null>;
  static updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null>;
  static deleteSession(sessionId: string): Promise<boolean>;
}
```

### 4. UI Components

```typescript
// components/home/SessionList.tsx
interface SessionListProps {
  sessions: SessionWithCharacter[];
  onSessionClick: (sessionId: string) => void;
  onSessionEdit: (session: SessionWithCharacter) => void;
  onSessionDelete: (session: SessionWithCharacter) => void;
}

// components/home/SessionCard.tsx
interface SessionCardProps {
  session: SessionWithCharacter;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// components/home/SessionEditModal.tsx
interface SessionEditModalProps {
  session: SessionWithCharacter | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

// components/home/SessionDeleteModal.tsx
interface SessionDeleteModalProps {
  session: SessionWithCharacter | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
```

## Data Models

### Session Record Schema

```typescript
const SessionSchema = {
  id: "string (UUID)",
  characterId: "string (UUID, foreign key to characters_record)",
  name: "string (1-100 characters, trimmed)",
  createdAt: "string (ISO 8601)",
  updatedAt: "string (ISO 8601)"
};
```

### IndexedDB Store Configuration

```typescript
// lib/data/local-storage.ts 新增
export const SESSIONS_RECORD_FILE = "sessions_record";

// 添加到 STORE_NAMES 和 RECORD_STORES 数组
```

### Data Migration Strategy

现有 `character_dialogues` 存储使用 `characterId` 作为 key。迁移策略：

1. **新会话**：使用 `sessionId` 作为对话树的 key
2. **旧数据兼容**：首次加载时，为每个现有对话树自动创建对应的 Session 记录
3. **渐进迁移**：不强制迁移旧数据，新旧数据共存

## Error Handling

| 场景 | 处理策略 |
|------|----------|
| 会话名称为空 | 前端校验阻止提交，显示错误提示 |
| 会话不存在 | 返回 null，UI 显示"会话已删除" |
| 角色卡被删除 | 会话保留，显示"角色已删除"占位符 |
| IndexedDB 写入失败 | 捕获异常，显示 toast 错误提示 |
| 并发更新冲突 | 最后写入胜出（last-write-wins） |

## Testing Strategy

### Unit Testing

使用 Vitest 进行单元测试：

1. **SessionOperations 测试**：CRUD 操作的正确性
2. **useSessionStore 测试**：状态变更的正确性
3. **组件测试**：SessionCard、SessionList 的渲染和交互

### Property-Based Testing

使用 fast-check 进行属性测试，验证核心不变量：

1. **序列化往返**：Session 对象序列化后反序列化应等价
2. **名称校验**：任意非空字符串 trim 后应被接受
3. **删除一致性**：删除会话后，对话树也应被删除

测试配置：每个属性测试运行 100 次迭代。

每个属性测试必须使用以下格式标注：
`**Feature: session-management, Property {number}: {property_text}**`


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, the following redundancies were identified:

1. **3.2 and 1.1 overlap**: Displaying multiple sessions per character (3.2) is a subset of displaying all sessions (1.1)
2. **6.2 and 3.3 overlap**: Both test loading dialogue tree by session ID
3. **7.1 and 7.2 can be combined**: Serialization and deserialization form a round-trip
4. **7.3 and 7.4 can be combined**: Export and import form a round-trip

Consolidated properties below:

---

### Property 1: Session retrieval completeness

*For any* set of sessions stored in the Session_Store, fetching all sessions SHALL return exactly those sessions with no duplicates and no omissions.

**Validates: Requirements 1.1, 3.2**

---

### Property 2: Session creation produces valid linked record

*For any* valid character ID, creating a session SHALL produce a session record with:
- A unique non-empty session ID
- The correct characterId reference
- A non-empty default name containing the character name
- Valid ISO 8601 timestamps for createdAt and updatedAt

**Validates: Requirements 2.2, 2.3, 4.1**

---

### Property 3: Multiple sessions per character independence

*For any* character ID and any positive integer N, creating N sessions for that character SHALL result in N distinct session records, each with a unique session ID.

**Validates: Requirements 3.1**

---

### Property 4: Session-dialogue isolation

*For any* session ID, loading the dialogue tree SHALL return only the dialogue nodes associated with that specific session, not nodes from other sessions.

**Validates: Requirements 3.3, 6.2**

---

### Property 5: Session name validation

*For any* string composed entirely of whitespace characters, updating a session name with that string SHALL be rejected. *For any* string containing at least one non-whitespace character, the trimmed string SHALL be accepted and persisted.

**Validates: Requirements 4.2, 4.3**

---

### Property 6: Session deletion cascade

*For any* session ID, after deletion, both the session record AND its associated dialogue tree SHALL no longer exist in storage.

**Validates: Requirements 5.2**

---

### Property 7: Session serialization round-trip

*For any* valid Session object, serializing to JSON and then deserializing SHALL produce an object equivalent to the original (all fields match).

**Validates: Requirements 7.5**

---

### Property 8: Export-import round-trip

*For any* set of sessions in the Session_Store, exporting all data and then importing into an empty store SHALL result in the same set of sessions being present.

**Validates: Requirements 7.3, 7.4**

---

### Property 9: Session card rendering completeness

*For any* SessionWithCharacter object, the rendered SessionCard component output SHALL contain the session name, character name, and a formatted timestamp.

**Validates: Requirements 1.2**
