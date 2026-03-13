# Session Gallery Object URL Lifecycle Design

## Goal

把 `/session` gallery 中本地头像生成的 `blob:` URL 生命周期收紧到“单次弹窗展示”，避免页面级长期缓存带来的隐式资源泄漏。

## Context

当前 `session-gallery.ts` 会把本地头像 blob key 解析成 `blob:` URL，修复了 `/show-gallery` 与 `/list-gallery` 直接暴露内部 key 的问题。

但现在的实现把解析结果缓存在模块级 `Map<string, string>` 中。这意味着：

- 只要页面还活着，object URL 就一直存在。
- 用户多次打开/关闭 gallery 时，不会触发 `URL.revokeObjectURL(...)`。
- 这个缓存不再跟“是否正在展示图片”绑定，而是跟模块生命周期绑定。

这不符合 object URL 的正确资源语义。

## Chosen Approach

采用“弹窗级生命周期”：

- `session-gallery.ts` 返回结构化 gallery 条目，而不是仅返回裸字符串。
- 每个条目携带：
  - `src`: 实际可展示的 URL
  - `ephemeral`: 是否是当前弹窗持有的临时 object URL
- 远端 URL、绝对路径、已有 `blob:` / `data:` URL 继续直接透传，`ephemeral = false`
- 本地头像 blob key 在解析后生成 object URL，`ephemeral = true`
- `SessionGalleryDialog` 在关闭时统一回收当前条目里的 `ephemeral` URL

## Rejected Alternatives

### 页面级缓存

优点是避免重复解析，缺点是生命周期过长，而且和“只在 gallery 展示时需要 URL”不一致。会把一次展示需求扩展成页面级隐式状态。

### UI 层单独处理本地 key

这样能把 object URL 生命周期完全放到组件里，但会让 `/list-gallery` 和 `/show-gallery` 的数据语义分叉：一个返回内部 key，一个返回真实可展示 URL。这个分裂会让宿主接口重新变脏。

## Data Shape

新增结构：

```ts
interface SessionGalleryItem {
  src: string;
  ephemeral: boolean;
}
```

`listSessionGalleryItems(...)` 返回 `Promise<SessionGalleryItem[]>`。

`session-host-actions.ts`：

- `handleShowGallery` 直接使用结构化条目给 dialog
- `handleListGallery` 把结构化条目映射回 `string[]`

## Cleanup Semantics

- dialog 关闭时扫描当前 `items`
- 仅对 `ephemeral === true` 的 `src` 调用 `URL.revokeObjectURL(src)`
- 回收后关闭 dialog
- 不做跨次打开复用；重复打开允许重新解析本地头像

## Testing

新增/调整测试覆盖：

- `session-gallery.test.ts`
  - 本地头像 key 解析后返回 `src + ephemeral`
- `SessionGalleryDialog` 或相应 session 视图测试
  - 关闭弹窗时对临时 URL 调用 `URL.revokeObjectURL(...)`
- 现有 gallery 展示与 `/list-gallery` 语义保持不变

## Success Criteria

- `/show-gallery` 仍能正确展示本地头像
- `/list-gallery` 仍返回可消费字符串列表
- 关闭 gallery 后会释放本次弹窗创建的 object URL
- 不引入新的页面级 object URL 缓存
