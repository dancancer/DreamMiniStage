# 搜索工具栏组件

## 概述

`SearchToolbar` 是提示词查看器的核心搜索控制组件，提供搜索输入、匹配模式切换、刷新等功能。

## 特性

- ✅ **搜索输入框** - 支持实时搜索和清除功能
- ✅ **仅显示匹配切换** - 控制是否只显示匹配的内容
- ✅ **刷新按钮** - 手动刷新提示词内容
- ✅ **加载状态** - 自动禁用控件并显示加载动画
- ✅ **响应式设计** - 适配不同屏幕尺寸
- ✅ **无障碍支持** - 完整的 ARIA 标签和键盘导航

## 使用方法

### 基础用法

```tsx
import { SearchToolbar } from "@/components/prompt-viewer";

function MyComponent() {
  const [searchInput, setSearchInput] = useState("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <SearchToolbar
      searchInput={searchInput}
      onSearchChange={setSearchInput}
      matchedOnly={matchedOnly}
      onMatchedOnlyChange={setMatchedOnly}
      onRefresh={() => console.log("刷新")}
      isLoading={isLoading}
    />
  );
}
```

### 与状态管理集成

```tsx
import { SearchToolbar } from "@/components/prompt-viewer";
import { useViewerUIState, useSearchActions } from "@/lib/store/prompt-viewer-store";

function PromptViewerModal({ dialogueKey, characterId }) {
  const uiState = useViewerUIState(dialogueKey);
  const { setSearchInput, toggleMatchedOnly } = useSearchActions();
  const { refreshPrompt } = useInterceptionActions();

  return (
    <SearchToolbar
      searchInput={uiState.searchInput}
      onSearchChange={(value) => setSearchInput(dialogueKey, value)}
      matchedOnly={uiState.matchedOnly}
      onMatchedOnlyChange={() => toggleMatchedOnly(dialogueKey)}
      onRefresh={() => refreshPrompt(dialogueKey, characterId)}
      isLoading={uiState.isLoading}
    />
  );
}
```

## API 参考

### SearchToolbarProps

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `searchInput` | `string` | ✅ | 当前搜索输入值 |
| `onSearchChange` | `(value: string) => void` | ✅ | 搜索输入变化回调 |
| `matchedOnly` | `boolean` | ✅ | 是否仅显示匹配内容 |
| `onMatchedOnlyChange` | `(checked: boolean) => void` | ✅ | 匹配模式切换回调 |
| `onRefresh` | `() => void` | ✅ | 刷新按钮点击回调 |
| `isLoading` | `boolean` | ✅ | 是否处于加载状态 |

## 设计原则

### 好品味 (Good Taste)
- **消除特殊情况**: 统一处理所有输入状态，无需特殊分支
- **简洁直观**: 每个控件职责单一，交互清晰
- **一致性**: 与项目整体设计语言保持一致

### 实用主义
- **真实需求**: 解决实际的搜索和控制需求
- **性能优化**: 使用 `useCallback` 避免不必要的重渲染
- **错误处理**: 优雅处理加载和错误状态

### 可维护性
- **类型安全**: 完整的 TypeScript 类型定义
- **组件分离**: UI 组件与业务逻辑分离
- **测试覆盖**: 包含完整的单元测试

## 样式定制

组件使用项目的设计 token，支持主题切换：

```tsx
// 主要颜色
- bg-overlay: 输入框背景
- border-border: 边框颜色
- text-cream: 主文本颜色
- text-muted-foreground: 次要文本颜色
- text-primary-soft: 按钮文本颜色

// 交互状态
- hover:bg-muted-surface: 悬停背景
- focus:border-primary-soft: 焦点边框
- disabled:opacity-50: 禁用透明度
```

## 无障碍支持

- ✅ 完整的 ARIA 标签
- ✅ 键盘导航支持
- ✅ 屏幕阅读器友好
- ✅ 焦点管理
- ✅ 语义化 HTML

## 测试

运行组件测试：

```bash
pnpm test SearchToolbar
```

测试覆盖：
- ✅ 基础渲染
- ✅ 事件处理
- ✅ 状态管理
- ✅ 边界情况
- ✅ 类型安全

## 相关组件

- `PromptContent` - 提示词内容显示
- `ImageGallery` - 图片画廊
- `PromptViewerModal` - 主弹窗组件