# UI 导航与布局重构规划

## 背景与目标
- 统一入口：左侧导航承担所有功能入口，消除散落的按钮/侧栏/顶部入口。
- 稳定布局：中间工作区展示首页与主聊天；右侧滑出窗承载设置/管理类内容，保证主流程连续。
- 上下文敏感：剧情分支管理与具体对话关联，从聊天视图内触发。
- 一致交互：Radix/Shadcn 组件、Tailwind 主题令牌，语言/主题切换常驻工作区右上角。

## 信息架构
- 左侧导航分组（可折叠/Tooltip 辅助）：
  - 基础：`首页`（进行中对话列表 + 新建对话）、`聊天`（主对话入口）。
  - 创作/世界：`角色卡`、`世界书`。
  - 自动化/规则：`正则脚本`、`预设`（含回复长度）、`模型设置`、`插件管理`。
  - 外观/高级：`标签颜色编辑`、`高级设置`。
  - 数据：`数据管理`（导入/导出/Google Drive）。
- 右侧滑出窗（全局）：除首页/聊天之外的设置/管理入口均在此渲染。
- 聊天内专属：`剧情分支管理` 仅在聊天视图出现，以当前会话为上下文弹出。
- 顶栏常驻：语言切换、主题切换。

## 布局方案
- 新三栏骨架（LeftNav / WorkArea / RightPanel）：
  - `components/layout/MainShell.tsx`：容器，放置左侧导航、主内容、右侧抽屉层。
  - `components/layout/LeftNav.tsx`：数据驱动导航渲染，点击设置类入口触发抽屉。
  - `components/layout/TopBar.tsx`：标题区 + 语言/主题切换（保持右上角）。
  - `components/layout/RightPanel.tsx`：Radix Sheet/Drawer 包裹，按 `activePanel` 渲染内容。
- 上下文提供者：
  - `contexts/ui-layout.tsx`：`activePanel`, `isPanelOpen`, `openPanel(panelId)`, `closePanel()`.
  - 聊天局部（可复用同 Provider 增补分支状态，或在聊天内轻量 state）管理 `branchOpen`。
- 应用入口：在 `app/(main)/layout.tsx` 或现有 `MainLayout` 中切换到新骨架。
- 移动端优先：使用同一套组件，CSS/Tailwind 断点适配（导航折叠/覆盖式，抽屉全屏推入），不另写一套移动 UI。

## 抽屉面板与模块映射
- 使用映射表消除多重条件：`panelMap: Record<PanelId, Component>`.
- 计划面板组件（复用现有功能逻辑，视需要包裹/轻量重排）：
  - `CharactersPanel`（角色卡）
  - `WorldbookPanel`
  - `RegexPanel`
  - `PresetsPanel`（合并回复长度设置）
  - `ModelSettingsPanel`
  - `PluginsPanel`
  - `TagColorsPanel`
  - `AdvancedSettingsPanel`
  - `DataPanel`（导入/导出/Google Drive）
- 面板内保持独立滚动，宽度固定；必要时内部分 Tab/Accordion，但维持单层分支。

## 导航与路由策略
- 左侧导航点击：
  - `首页` / `聊天`：路由跳转（主区视图）。
  - 其他项：调用 `openPanel(panelId)`，右侧抽屉显示对应面板。
- URL 同步（可选）：支持 `?panel=xxx` 打开指定抽屉，便于刷新恢复；聊天内 `?branch=open` 还原分支面板。
- 聊天内分支管理：
  - 在聊天工具栏/右上按钮添加入口，读取当前会话 ID。
  - 打开局部 Sheet（可与 RightPanel 复用 UI primitive，但 state 独立于全局 `activePanel`）。

## 数据与性能
- 按需懒加载各面板数据；面板关闭后保留必要缓存，避免重复请求。
- 导航/抽屉状态使用单一来源，避免多处状态漂移。
- 控件组件（语言/主题切换）保持独立，避免耦合抽屉开关。

## 迁移与兼容
- 现有 `Sidebar`、`ModelSidebar`、顶部设置入口将被新 LeftNav + RightPanel 取代。
- 现有设置类组件嵌入对应面板，减少样式漂移（统一使用 `@/components/ui`）。
- 保留移动端适配：左侧导航可折叠/覆盖式，抽屉在移动端全屏推入。

## 测试计划
- 交互 Smoke：左导航开关、抽屉开启/关闭、首页/聊天路由切换、语言/主题切换常驻。
- 面板回归：角色卡/世界书/正则/预设/模型设置/插件/标签色/高级/数据管理均可从左导航进入抽屉。
- 聊天内：剧情分支按钮在聊天页出现，基于当前会话加载，关闭不影响全局抽屉。
- 状态持久：可选 URL query 打开抽屉/分支，刷新后恢复。
- 组件约束：文件 < 400 行，函数短小，分支由映射表消除。
