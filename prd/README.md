# DreamMiniStage — 产品需求文档 (PRD)

## 系统概述

DreamMiniStage 是一个交互式叙事平台，让用户能够与 AI 角色进行沉浸式对话体验。系统兼容 SillyTavern 生态，支持导入角色卡、预设、世界书、正则脚本和自定义脚本等资产。

用户可以导入或创建虚拟角色，配置不同的 AI 模型（OpenAI/Ollama/Gemini），通过丰富的对话系统与角色展开互动。平台提供世界观设定、变量追踪、对话分支、检查点存档等高级叙事能力，同时支持自定义脚本和插件扩展。

主要用户群体包括：互动叙事创作者、角色扮演爱好者、AI 对话体验探索者。平台以 PWA 形式提供，支持桌面端和移动端访问，支持中英双语界面。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) + React 19 |
| 语言 | TypeScript (strict) |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand 5 + React Context |
| AI 集成 | LangChain 0.3 (OpenAI / Ollama / Gemini) |
| 持久化 | IndexedDB (浏览器本地) |
| 测试 | Vitest 3 + Playwright |
| 部署 | PWA 静态导出 / Docker / Pake 桌面打包 |

## 模块概览

| 模块 | 包含页面/视图 | 核心功能 |
|------|--------------|---------|
| 首页（会话管理） | 会话列表 | 创建、编辑、删除、浏览对话会话 |
| 角色卡库 | 角色卡列表 | 导入、浏览、编辑、删除角色卡；从角色卡创建会话 |
| 人格管理 | 人格列表 | 创建、编辑、删除用户人格身份；设置默认人格 |
| 对话工作台 | 聊天界面 | 实时对话、流式响应、消息编辑、分支切换、开场白选择 |
| 世界书编辑器 | 世界书视图 | 创建、编辑、删除世界信息条目；关键词匹配配置 |
| 预设编辑器 | 预设视图 | 管理提示词预设模板；启用/禁用/排序提示词条目 |
| 正则脚本编辑器 | 正则视图 | 创建、编辑、删除正则替换规则；调试正则匹配 |
| 模型设置 | 右侧面板 | 多 API 配置管理；模型选择；高级参数调节 |
| 插件管理 | 插件面板 | 插件发现、启用、禁用、配置 |
| 对话树 | 弹窗 | 可视化对话分支结构；编辑节点内容 |
| 提示词查看器 | 弹窗 | 调试 LLM 提示词构成；搜索和检查发送内容 |
| 检查点系统 | 工具面板 | 对话存档点创建、恢复、删除 |
| 快捷回复 | 工具面板 | 预设回复模板管理和一键发送 |
| 设置中心 | 右侧面板 | 标签颜色、数据导入导出、高级设置 |

## 页面清单

| # | 页面名称 | 路由 | 模块 | 文档链接 |
|---|---------|------|------|---------|
| 1 | 首页（会话列表） | `/` | 首页 | [→](./pages/01-home-session-list.md) |
| 2 | 角色卡库 | `/character-cards` | 角色管理 | [→](./pages/02-character-cards.md) |
| 3 | 人格管理 | `/personas` | 人格系统 | [→](./pages/03-personas.md) |
| 4 | 对话工作台 - 聊天 | `/session?id={id}` | 对话 | [→](./pages/04-session-chat.md) |
| 5 | 对话工作台 - 世界书编辑器 | `/session` (worldbook 视图) | 对话 | [→](./pages/05-session-worldbook.md) |
| 6 | 对话工作台 - 预设编辑器 | `/session` (preset 视图) | 对话 | [→](./pages/06-session-preset.md) |
| 7 | 对话工作台 - 正则编辑器 | `/session` (regex 视图) | 对话 | [→](./pages/07-session-regex.md) |
| 8 | 右侧面板系统 | 全局 | 设置 | [→](./pages/08-right-panels.md) |

## 全局行为说明

### 权限模型

系统支持两种用户状态：
- **访客模式**：可使用全部本地功能，数据存储在浏览器 IndexedDB 中
- **登录用户**：通过邮箱+密码认证，支持云端数据同步（Google Drive 导入/导出）

角色卡、预设、世界书、正则脚本均区分**角色级**（绑定特定角色）和**全局级**（跨角色共享）两个作用域。

### 人格系统

用户可创建多个"人格"（Persona），代表不同的身份/角色。人格按以下优先级解析：
1. **聊天锁定**：当前对话绑定了特定人格
2. **角色连接**：角色卡关联了默认人格
3. **默认人格**：用户设定的全局默认
4. **无人格**：使用用户名作为身份

### 通用交互模式

- 所有删除操作需要二次确认
- 列表默认按创建时间倒序排列
- 表单提交时显示加载状态，防止重复提交
- 所有操作结果通过 Toast 通知反馈
- 支持中英双语切换（全局生效）
- 支持明暗主题切换
- 移动端自适应布局（侧边栏变为抽屉模式）

### MVU 变量系统

对话中支持通过斜杠命令（`/set`、`/insert`、`/delete`）管理角色状态变量。变量支持 schema 验证、JSON Patch 操作、快照回放。LLM 可通过 function call 更新变量，实现有状态的角色扮演。

### 斜杠命令系统

对话输入框支持 26+ 斜杠命令，涵盖：
- 消息控制（`/send`、`/sendAs`、`/impersonate`、`/narrate`）
- 生成控制（`/trigger`、`/swipe`、`/regenerate`）
- 检查点（`/checkpointCreate`、`/checkpointGo`）
- 数学运算（`/add`、`/sub`、`/mul` 等）
- 字符串操作（`/len`、`/split`、`/replace`）
- 数据银行（`/databank*` 系列）
- 变量管理（`/set`、`/get`）

详见 [斜杠命令参考](./appendix/slash-command-reference.md)。

### 插件系统

支持通过 manifest 描述文件注册插件，插件可以：
- 监听生命周期事件（onLoad、onEnable、onDisable、onMessage）
- 注册自定义工具（Tool）
- 访问消息读写权限
- 修改 UI 行为

### 脚本桥接层

兼容 SillyTavern 脚本生态，通过 iframe 沙箱执行用户脚本。脚本可通过 `window.TavernHelper` / `window.SillyTavern` API 访问宿主数据，支持 35+ 处理器模块。

## 附录

| 文档 | 内容 |
|------|------|
| [枚举字典](./appendix/enum-dictionary.md) | 所有状态码、类型映射、角色定义 |
| [页面关系图](./appendix/page-relationships.md) | 页面间导航和数据耦合关系 |
| [API 清单](./appendix/api-inventory.md) | LLM 调用和数据操作接口 |
| [斜杠命令参考](./appendix/slash-command-reference.md) | 全部斜杠命令说明 |
| [工具清单](./appendix/tools-inventory.md) | Agent 工具定义和用途 |
