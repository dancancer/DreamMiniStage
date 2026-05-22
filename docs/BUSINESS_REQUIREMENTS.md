# DreamMiniStage Business Requirements

> 更新时间：2026-05-22
> 范围：当前仓库已实现或明确暴露的业务能力。

## 1. 产品目标

DreamMiniStage 面向沉浸式叙事创作者与体验者，核心目标是让用户在本地管理角色、身份、会话、世界设定和提示词，并与外部 LLM 共同延续一个可保存、可分支、可调试的叙事舞台。

产品不是通用后台，也不是只发消息的聊天框。它的关键价值在于把叙事上下文控制权交还给用户：角色卡、Persona、世界书、预设、正则、变量、插件脚本和会话工具必须能被看见、编辑、导入导出和复现。

## 2. 用户角色

| 用户 | 目标 | 关键需求 |
|------|------|----------|
| 叙事体验者 | 与角色持续对话 | 快速进入会话、稳定续写、开场白切换、消息再生、会话保存 |
| 角色/世界设定作者 | 管理角色和上下文资产 | 导入角色卡、维护世界书、预设、正则脚本、Persona |
| 高级调试者 | 调试 prompt 与脚本行为 | Prompt Viewer、JSONL、Script Debug、slash command、test runner |
| 本地数据持有者 | 控制数据边界 | 浏览器本地持久化、备份导入导出、Google Drive 可选同步 |

## 3. 当前核心能力

### 3.1 会话舞台

- 首页展示所有会话，按更新时间排序。
- 用户可以创建、打开、重命名、删除会话。
- 每个会话绑定一个角色卡，同一角色可创建多个会话。
- 删除会话会删除对应 dialogue tree，不删除角色卡。

### 3.2 角色卡库

- 支持 PNG 角色卡导入。
- 支持角色列表/轮播视图，移动端强制列表式浏览。
- 支持角色置顶、编辑、删除。
- 创建会话模式下，点击角色后创建 session 并进入 `/session`。

### 3.3 Persona

- 支持创建、编辑、删除 Persona。
- Persona 包含名称、头像、描述、描述注入位置、深度、注入角色。
- 支持设置默认 Persona、激活 Persona、导出全部 Persona 数据。
- 运行时支持角色连接和会话级锁定，由 Persona store 处理。

### 3.4 对话与生成

- 支持普通消息发送、slash command 执行、触发生成、继续生成、再生、swipe。
- 支持多开场白切换；一旦用户开始对话，开场白选择锁定。
- 支持消息隐藏/恢复、force save、reasoning 读写。
- 支持流式与非流式响应，由模型 advanced settings 和请求参数共同决定。
- 支持 Prompt Viewer 查看当前 prompt 组装结果。

### 3.5 上下文资产

- 世界书支持角色级、会话级、全局级编辑。
- 预设作为全局工作区维护，包含 prompt 条目、启用状态、排序、采样、context、sysprompt。
- 正则脚本作为全局规则工作区维护，可按角色上下文进入。
- Instruct 模式支持多个本地模型模板。

### 3.6 右侧工具面板

- `settingsHub` 集中进入模型、插件、标签、数据、向量检索开关。
- `sessionTools` 收纳低频会话工具：叙事模式、分支树、用户名、Script Debug、JSONL、Prompt Viewer、Quick Reply、群聊成员、Checkpoint。
- 模型设置支持多配置与 active config。
- 数据管理支持本地 JSON 导入导出和 Google Drive 同步。

### 3.7 Slash / Script / Plugin

- Slash command 是会话输入和脚本桥共享的本地控制语言。
- 角色卡脚本通过 iframe/script bridge 调用宿主能力。
- 插件面板读取 `window.pluginRegistry` 和 `window.pluginDiscovery`。
- Function tool bridge 支持 iframe 注册/调用工具并回传结果。

## 4. 非目标与限制

- 当前不是多用户云端 SaaS；身份入口已收敛为本地 guest 模式。
- 当前没有传统 REST 后端作为业务数据源；主要数据源是 IndexedDB。
- `/test-script-runner` 是内部验证页面，不是面向普通用户的产品功能。
- 外部 LLM 服务、Google Drive、Jina Reader 和插件宿主属于可选外部边界，失败时应显式暴露。

## 5. 业务规则

- 不允许在生成中重复发送普通消息。
- 不支持的 legacy 输入应 fail-fast，不应静默兼容。
- 会话页没有 `sessionId` 时只给出返回首页和创建会话入口，不猜测用户意图。
- 模型配置中的敏感 key 只保存在用户本地浏览器；`NEXT_PUBLIC_*` 配置会暴露给客户端，不应放真正私密凭据。
- 角色/预设/世界书/正则导入必须尽量收敛到当前数据模型，避免保留多套运行时路径。

## 6. 验收口径

- 所有真实业务路由必须在 PRD 中有页面级说明。
- 每个页面文档必须写清入口、核心字段、主操作、失败态、数据依赖。
- 架构文档必须区分“当前已实现能力”和“历史计划/测试 scaffold”。
- 文档改动完成后执行 `pnpm verify:stage`，阶段门禁未过不得进入 review。
