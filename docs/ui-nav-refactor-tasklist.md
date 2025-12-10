# UI 导航重构 Tasklist

- [x] 1. 建立 `contexts/ui-layout.tsx`：定义 `PanelId`、状态（`activePanel`, `isPanelOpen`）、`openPanel/closePanel`，支持可选 query 同步占位（暂留接口，后续实现）。
- [x] 2. 新建布局骨架组件 `components/layout/MainShell.tsx`、`LeftNav.tsx`、`TopBar.tsx`、`RightPanel.tsx`：三栏容器 + 顶栏常驻语言/主题切换 + 抽屉容器，使用 `UiLayoutProvider` 包裹；移动端优先用 Tailwind 断点适配。
- [x] 3. 在 `app/(main)/layout.tsx`（或现有 `MainLayout`）切换到新骨架，暂时挂载 `children` 占位，保证页面可渲染；移动端保持同一组件，覆盖式导航/抽屉。
- [x] 4. 实现左侧导航分组与交互：数据驱动列表，首页/聊天路由跳转，其他入口调用 `openPanel(panelId)`；保持移动端折叠/覆盖模式（CSS 适配，无单独移动版本）。
- [x] 5. 实现右侧抽屉容器：使用 Radix Sheet/Drawer，按 `panelMap` 渲染占位面板，支持关闭与 ESC；移动端抽屉全屏推入。
- [x] 6. 搭建抽屉面板占位组件（Characters/Worldbook/Regex/Presets/ModelSettings/Plugins/TagColors/Advanced/Data），复用现有逻辑组件为子内容（暂时挂载占位以保持可跑）。
- [x] 7. 在聊天视图添加剧情分支入口：按钮挂到聊天工具栏/右上，管理局部 `branchOpen` 状态（或复用 Provider 扩展），弹出 Sheet 与当前会话关联。
- [x] 8. 将现有功能接入面板：角色卡、世界书、正则、预设（合并回复长度）、模型设置、插件、标签颜色、高级设置、数据管理入口迁移到对应面板；移除旧 Sidebar/ModelSidebar/零散设置入口。
- [ ] 9. 可选：实现 URL query 同步（`?panel=...`、聊天页 `?branch=open`）以支持刷新恢复。
- [ ] 10. 样式与交互收尾：抽屉宽度/滚动、导航高亮、焦点可达性、移动端适配；确保语言/主题切换常驻工作区右上角。
- [ ] 11. 回归与测试：执行 lint/test，手动走查导航/抽屉/聊天分支开关；补充必要的 Vitest/RTL 交互测试覆盖。
