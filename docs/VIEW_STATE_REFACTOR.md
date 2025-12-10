# 视图状态重构文档

## 概述

本次重构消除了视图状态管理中的双重数据源问题，实现了真正的单一数据流架构。

## 问题诊断

### 现象
正则脚本、世界书、预设三个按钮无法唤起对应的功能界面。

### 根因
系统存在两个状态源：
1. **本地状态**：`useActiveView` hook 维护的 `activeView`
2. **全局状态**：`useUIStore` 维护的 `characterView`

按钮点击只更新了本地状态，而视图渲染依赖全局状态，导致状态不同步。

### 架构问题
```
本地状态 ←→ 全局状态  （需要 useEffect 同步）
    ↓           ↓
  视图A       视图B     （数据流混乱）
```

## 解决方案

### 核心思想
**移除 `useActiveView` hook，所有视图状态统一由 Zustand Store 管理**

### 新架构
```
Zustand Store（唯一真相源）
        ↓
   所有组件直接读取
        ↓
    视图切换立即生效
```

## 代码变更

### 1. 删除文件
- ❌ `hooks/useActiveView.ts` (73 行)

### 2. 修改 `app/character/page.tsx`

#### Before
```typescript
import { useActiveView } from "@/hooks/useActiveView";

const { activeView, switchToView, toggleWorldBook, toggleRegexEditor, backToChat } = useActiveView();
const characterView = useUIStore((state) => state.characterView);

// 需要 useEffect 同步
useEffect(() => {
  if (characterView !== activeView) {
    switchToView(characterView);
  }
}, [characterView, activeView, switchToView]);
```

#### After
```typescript
// 直接使用 Store，无需同步
const characterView = useUIStore((state) => state.characterView);
const setCharacterView = useUIStore((state) => state.setCharacterView);
```

### 3. 简化 `components/CharacterChatHeader.tsx`

#### Before
```typescript
interface Props {
  onSwitchToView: (view: ViewType) => void;
  onToggleView: () => void;
  onToggleRegexEditor: () => void;
  // ...
}

onClick={() => {
  const targetView = activeView === "preset" ? "chat" : "preset";
  setCharacterView(targetView);
  onSwitchToView(targetView);  // 冗余调用
}}
```

#### After
```typescript
interface Props {
  toggleSidebar: () => void;
  // 移除了 3 个冗余回调
}

onClick={() => {
  setCharacterView(activeView === "preset" ? "chat" : "preset");
}}
```

## 收益分析

### 代码质量
- ✅ 删除 ~100 行代码
- ✅ 减少 1 个 hook 文件
- ✅ 减少 3 个 Props 回调
- ✅ 消除 1 个 useEffect 同步逻辑

### 架构改进
- ✅ 单一数据源（Single Source of Truth）
- ✅ 单向数据流（Unidirectional Data Flow）
- ✅ 消除状态同步复杂性
- ✅ 降低组件耦合度

### 性能优化
- ✅ 减少不必要的 re-render
- ✅ 消除 useEffect 的异步同步开销
- ✅ 简化 React 调和过程

## 设计原则

### 1. 好品味（Good Taste）
消除了特殊情况（状态同步），让边界情况自然融入常规逻辑。

### 2. 实用主义
解决了真实存在的问题（按钮不工作），而不是过度设计。

### 3. 简洁执念
每个函数只做一件事，没有超过 3 层缩进，命名直白清晰。

## 测试验证

### 功能测试
- ✅ 世界书按钮正常切换
- ✅ 正则脚本按钮正常切换
- ✅ 预设按钮正常切换
- ✅ 返回聊天视图正常

### 代码质量
- ✅ `pnpm lint` 通过
- ✅ TypeScript 类型检查通过
- ✅ 无新增 ESLint 警告

## 迁移指南

如果其他组件也使用了 `useActiveView`，请按以下步骤迁移：

### Step 1: 移除 hook 导入
```typescript
// ❌ 删除
import { useActiveView } from "@/hooks/useActiveView";
```

### Step 2: 使用 Store
```typescript
// ✅ 添加
import { useUIStore } from "@/lib/store/ui-store";

const characterView = useUIStore((state) => state.characterView);
const setCharacterView = useUIStore((state) => state.setCharacterView);
```

### Step 3: 更新视图切换逻辑
```typescript
// ❌ 旧代码
switchToView("worldbook");

// ✅ 新代码
setCharacterView("worldbook");
```

## 哲学思考

> "代码是诗，Bug 是韵律的破碎；架构是哲学，问题是思想的迷失。"

这次重构体现了软件工程的核心智慧：

1. **单一数据源**：当你有两个时钟时，你永远不知道现在几点
2. **最小惊讶**：代码应该做它看起来要做的事
3. **简洁至上**：完美不是无可增加，而是无可删减

## 相关文档

- [Zustand 迁移指南](./ZUSTAND_MIGRATION.md)
- [对话状态迁移](./DIALOGUE_STORE_MIGRATION.md)
- [Toast 迁移状态](../TOAST_MIGRATION_STATUS.md)

---

**重构日期**: 2025-12-06  
**影响范围**: 视图状态管理  
**破坏性变更**: 是（删除 `useActiveView` hook）  
**向后兼容**: 否（需要迁移使用该 hook 的代码）
