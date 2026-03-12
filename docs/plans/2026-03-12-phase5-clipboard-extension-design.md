# Phase 5 Clipboard And Extension Host Design

## 背景

Phase 5 batch 1 已经把 `JS-Slash-Runner` 宿主能力的第一层真相源立起来了：

- `hooks/script-bridge/host-capability-matrix.ts` 负责描述产品宿主语义
- `hooks/script-bridge/host-debug-resolver.ts` 负责把默认支持 / 条件支持 / fail-fast 解析成统一状态
- `components/ScriptDebugPanel.tsx` 已经能展示宿主能力、最近 API 调用和运行时状态

但当前 `clipboard` 与 `extension-state` 仍有一个明显缺口：

- slash 命令和 bridge API 已经存在
- debugger 也能解释这两类能力
- 可真实 `/session` 默认宿主路径仍然不完整

结果就是这两类能力仍偏“知道怎么失败”，而不是“知道什么时候真的可用”。

## 目标

把 `clipboard` 与 `extension-state` 从“条件能力 + 解释性矩阵”推进到“有真实默认读路径的 `/session` 宿主能力”。

本批次只做最小、可信、可验证的闭环：

1. `/session` 对 `clipboard` 提供默认宿主实现
2. `/session` 对 `extension-state` / `extension-exists` 提供默认读取路径
3. `extension-enable` / `extension-disable` / `extension-toggle` 继续维持条件支持，不伪装成默认可用
4. debugger 与宿主矩阵继续准确反映默认路径 / 条件路径 / fail-fast

## 非目标

本批次不做以下事情：

- 不把所有 extension 写操作强行产品化
- 不做新的 bridge API 大面积扩展
- 不重做 `ScriptDebugPanel` 结构
- 不改变 `tool-registration` / `audio` 的 batch 1 交付边界

## 设计原则

### 1. 默认读路径优先于伪默认写路径

`clipboard` 与 `extension-state` 的真正问题是“默认宿主不清楚”，不是“按钮不够多”。

所以本批次优先补：

- 可稳定实现的默认读取路径
- 不可稳定实现的写路径继续条件支持或 fail-fast

这比“为了让矩阵更好看而假装支持写操作”更有品味。

### 2. 宿主协议必须显式

`app/session/session-host-bridge.ts` 现在只定义了 `translateText` 与 `getYouTubeTranscript`。

这会让 clipboard / extension-state 的真实宿主来源继续漂浮。

本批次要把这些能力提升到显式协议层，避免页面、adapter、debugger 各自猜测。

### 3. `/session` 默认宿主只做可信实现

建议区分两类能力：

- `clipboard`
  - 默认宿主可尝试走浏览器环境能力
  - 不支持的运行环境必须显式 fail-fast
- `extension-state`
  - 默认宿主可走已有 plugin registry 的读取语义
  - 写入若缺稳定 host callback，则继续条件支持

### 4. 调试面继续复用，不新开第二套 UI

当前 `ScriptDebugPanel` 已经足够做 batch 2 的可视化容器。

本批次只增强真实数据来源，不新增结构：

- 最近 API 调用会出现新的 `clipboard` / `extension-state` 命中记录
- resolved path 更真实
- fail-fast 理由更稳定

## 方案比较

### 方案 A：默认读路径落地，写路径继续条件支持

优点：

- 风险低
- 语义诚实
- 复用现有矩阵与调试面
- 最符合当前 roadmap 的“真实宿主责任边界”方向

缺点：

- extension 写路径还不是默认可用

这是推荐方案。

### 方案 B：读写一起产品化到 `/session`

优点：

- 功能面更完整

缺点：

- 很容易为了凑完整性硬造宿主写路径
- 宿主真实能力和产品承诺会再次漂移

### 方案 C：只更新矩阵与 debugger，不补默认宿主

优点：

- 最快

缺点：

- 产品语义没有真正前进
- 仍然停留在“解释现状”而不是“改善现状”

## 推荐方案

采用方案 A。

## 架构设计

### 1. 扩展 `/session` 宿主协议

扩展 `app/session/session-host-bridge.ts`，显式声明：

- `getClipboardText`
- `setClipboardText`
- `isExtensionInstalled`
- `getExtensionEnabledState`
- `setExtensionEnabled`

这样这些能力可以像 `translateText` / `getYouTubeTranscript` 一样，成为明确的宿主契约。

### 2. 提供 `/session` 默认宿主实现

在 `app/session/session-host-defaults.ts` 或相邻 helper 中补充默认能力：

- `clipboard`
  - 读：优先浏览器 Clipboard API
  - 写：优先浏览器 Clipboard API
  - 不支持时返回稳定错误
- `extension-state`
  - `isExtensionInstalled`
  - `getExtensionEnabledState`
  - 复用已有 plugin registry 读取逻辑
- `setExtensionEnabled`
  - 只有当默认宿主能稳定拿到写 callback 时才走默认路径
  - 否则保持条件支持

### 3. 页面层只做宿主合并，不做业务判断

`app/session/page.tsx` 继续遵守单路径：

- 合并默认宿主能力
- 合并 `window.__DREAMMINISTAGE_SESSION_HOST__` 注入覆盖
- 将结果传入 `CharacterChatPanel -> useScriptBridge`

不在页面里继续散落 clipboard / extension 的临时逻辑。

### 4. debugger 只消费真实状态

`hooks/useScriptBridge.ts` 和 host debug 观察链不用改结构，只要：

- 能观测到新默认宿主能力被命中
- 能区分默认路径和外部注入路径
- 写路径在没有宿主回调时继续显示 fail-fast

## 数据流

目标数据流：

`session-host-bridge contract`
-> `session-host-defaults`
-> `page.tsx host merge`
-> `CharacterChatPanel`
-> `useScriptBridge`
-> `slash-context-adapter`
-> slash handler / bridge api
-> `host debug state`
-> `ScriptDebugPanel`

这条链必须保持单路径，不允许 localStorage fallback、页面逻辑和 adapter 逻辑各写一份。

## 错误处理

本批次错误语义应该固定下来：

- `/clipboard-get`
  - 无浏览器支持或权限不可用时显式 fail-fast
- `/clipboard-set`
  - 无浏览器支持、权限拒绝或空文本时显式 fail-fast
- `/extension-state`
  - 目标扩展不存在时显式 fail-fast
- `/extension-enable|disable|toggle`
  - 无宿主写能力时显式 fail-fast

重点是“错误是产品契约的一部分”，不是临时补丁。

## 测试设计

### 1. 协议与默认宿主单测

验证：

- `session-host-bridge` 新字段被正确定义
- `session-host-defaults` 能提供默认 clipboard / extension-state 能力
- 不支持场景下返回稳定错误

### 2. 页面级集成测试

验证：

- `/clipboard-get` 与 `/clipboard-set` 走 `/session` 默认宿主
- 注入宿主存在时，注入实现优先于默认宿主
- `/extension-state` 默认可读
- `/extension-toggle` 在没有默认写宿主时继续 fail-fast

### 3. 调试链路测试

验证：

- recent API calls 中能看到 clipboard / extension-state 的 resolved path
- 默认路径显示为 `session-default`
- 注入覆盖显示为 `api-context`
- 无写宿主时显示 `fail-fast`

## 完成定义

本批次完成时，应满足：

- `/session` 对 `clipboard` 有真实默认宿主实现
- `/session` 对 `extension-state` / `extension-exists` 有真实默认读取路径
- extension 写路径没有被假装成默认支持
- debugger 与矩阵口径保持一致
- 定向测试与 `pnpm verify:stage` 通过
