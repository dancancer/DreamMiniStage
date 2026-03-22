# Conversation UI Optimization Design

## Goal

把 DreamMiniStage 当前偏“配置后台”的界面重心，收敛回“叙事会话体验”。本次优化不以换皮为目标，而以交互分层、主路径清晰、移动端可用性和无障碍为第一优先级。

目标结果：

- 用户首次进入后，能快速理解哪里读消息、哪里发消息、哪里改会话配置。
- 会话级控制、消息级操作、输入级动作各归其位，不再混层。
- 移动端、键盘操作、reduced-motion 场景下都具备稳定体验。
- 首页、角色卡、Personas、聊天页的交互语言和视觉语言形成统一系统。

## Context

当前问题不是单点视觉不精致，而是信息架构和交互语义发生了错位。

### 1. 聊天页存在结构性混层

`components/CharacterChatPanel.tsx` 当前把 API、模型、streaming、fast model、swipe 控件挂在“最后一条 assistant 消息头”上。与此同时，`components/character-chat/MessageItem.tsx` 的消息头本身还承担角色信息和消息级动作。

这会带来三个问题：

- 用户无法区分哪些动作影响“整场会话”，哪些动作只影响“这条消息”。
- 阅读回复时，消息头承担过多控制密度，破坏阅读节奏。
- 视觉上像调试界面，而不是产品界面。

### 2. 输入区承担了过多职责

`components/character-chat/ChatInput.tsx` 同时承载：建议输入、输入框、发送按钮、控制面板挂载位、横向工具 rail。

这使底部区域出现三个坏味道：

- 主任务和高级工具互相挤压。
- 移动端形成横向滚动 + 内部滚动 + 主消息滚动叠加。
- 发送态反馈不明确，且发送时直接禁用输入，不利于持续创作。

### 3. 阅读流被滚动逻辑打断

`components/character-chat/MessageList.tsx` 在每次消息变化时都调用 `scrollToBottom`。这意味着用户只要在读历史，就会被新消息强制拉回底部。

这是聊天产品里非常伤体验的问题，因为它直接破坏“阅读中的控制感”。

### 4. 壳层比内容更强势

`components/layout/LeftNav.tsx` 目前把大量高级能力作为一级导航直接暴露。首页、角色卡、Personas 各自也有不同的头部组织方式与空状态策略。结果是：产品主路径没有被突出，反而是配置入口最先抢占注意力。

### 5. 无障碍和一致性还未达标

当前还存在以下共性问题：

- 输入框缺少可见 label。
- 多个 icon button 点击区过小，提示只依赖 hover。
- 动画没有 reduced-motion 分支。
- SSR 初始语言 / 主题与客户端不一致，存在 hydration mismatch 风险。
- 页面普遍偏纯黑、层级偏平，阅读和状态层次不够稳。

## Design Principles

### 1. 会话级、消息级、输入级严格分层

每个层级只承担自己的职责：

- 会话级：模型、API、streaming、fast mode
- 消息级：截断、重新生成、局部 swipe 变体
- 输入级：建议、文本输入、发送、停止生成

不能再出现“全局控制借住在单条消息头里”的特殊情况。

### 2. 主路径优先，高级能力后置

默认界面必须优先服务主任务：阅读与创作。高级工具依然保留，但应通过 drawer、sheet、popover 等二级入口按需展开，而不是常驻压住主内容。

### 3. 优先修结构，再修皮肤

当前最大问题是结构，不是配色。应先修交互语义、布局和反馈，再做视觉统一。否则会出现“更精致但仍然难用”的结果。

### 4. 移动端不是桌面端缩小版

所有核心操作都要在小屏下自然成立：

- 点击区 >= 44px
- 避免依赖 hover
- 避免横向工具滚动成为主要操作方式
- 复杂面板在移动端统一退化为 bottom sheet

### 5. 可访问性不是补丁，而是设计约束

label、focus-visible、键盘顺序、颜色对比、reduced-motion、可缩放视口都应被视为设计输入，而不是开发完成后的附加修复。

## Non-Goals

本次方案不以以下事项为目标：

- 不重写业务状态管理。
- 不重新定义消息数据模型。
- 不在本轮引入新的动画库。
- 不做大规模品牌重塑或整站视觉翻新。
- 不改变世界书、预设、插件等高级模块的业务语义，只调整其暴露方式。

## Chosen Approach

采用“会话三层 + 高级工具二级抽屉”的重构方案。

### 新的聊天结构

```text
TopBar / LeftNav
  -> Session Toolbar
  -> Message Timeline
  -> Composer
  -> Advanced Tools Drawer
```

### 结构解释

- `Session Toolbar`：放置所有影响整场会话的控制项。
- `Message Timeline`：只展示消息流和消息级动作。
- `Composer`：只处理建议、输入、发送 / 停止。
- `Advanced Tools Drawer`：承载剧情推进、视角、场景、调试、导入导出等次级工具。

这是本方案的核心决策。它能够一次性消除当前最严重的混层问题，并为移动端和无障碍优化提供清晰边界。

## Rejected Alternatives

### 方案 A：只修样式，不改结构

优点是改动小，缺点是无法解决信息层级错位。全局控制仍然会挂在消息头里，用户心智仍然混乱，因此不采用。

### 方案 C：整站一次性重做视觉与结构

优点是最终视觉提升更大，缺点是风险高、回归面大、周期长，而且会把结构问题和视觉问题缠在一起，不利于分阶段验证，因此不作为当前方案。

## Information Architecture

### 一级导航

建议将一级导航收敛为四类：

- 首页
- 会话
- 角色
- 设置

### 二级入口

以下能力移入设置中心或上下文入口：

- 世界书
- 正则脚本
- 预设
- 标签颜色
- 数据管理
- 插件管理
- 模型设置

### 预期收益

- 降低首次进入时的认知负担
- 提高会话和创作路径的显著性
- 让高级能力仍可被访问，但不压制主内容

## Page-Level Design

### 首页

首页应从“会话容器空状态”升级为“主路径入口页”。

#### 新首页职责

- 展示品牌与产品价值的简要说明
- 提供清晰主 CTA：新建会话
- 提供两个次级 CTA：导入角色、创建 Persona
- 如有历史会话，则展示最近会话列表和继续入口

#### 空状态策略

空状态不能只告诉用户“暂无内容”，还要告诉用户“下一步应该做什么”。

### 角色卡页

角色卡页应区分两种语义：

- 管理角色
- 从角色创建会话

页面头部、空状态和 CTA 文案应根据当前模式调整，避免用户不清楚点击角色卡后会发生什么。

### Personas 页

Persona 创建流程应采用 progressive disclosure。

#### 默认展示

- 名称
- 描述
- 头像

#### 折叠到高级设置

- 注入位置
- 深度
- 消息角色

这样可以让 Persona 创建首先服务“建立身份”，而不是一上来暴露实现细节。

## Chat UI Design

### Session Toolbar

#### 放置内容

- API 选择器
- Model 选择器
- Streaming 开关
- Fast Model 开关
- 当前状态标签（例如当前模型、当前模式）

#### 设计要求

- 位于消息列表上方，固定在会话内容区域顶部
- 桌面端可以水平排列，移动端可折叠成两行或收为 sheet
- 状态变化需有明确反馈，例如 toast 或 inline status

### Message Timeline

#### 助手消息

助手消息保留：

- 角色头像
- 角色名
- 消息内容
- 消息级动作：jump / truncate、regenerate、必要时的 response swipe

#### 用户消息

用户消息需要更明确的 bubble / 背景 / 边界感，以提高扫读稳定性。当前右对齐纯文本的形式容器感过弱，长对话里不利于快速定位发言边界。

#### Swipe 策略

swipe 仍然保留，但从“会话配置带中的一部分”改为“当前回复的局部变体控制”。

反馈策略：

- 不再在消息列表下方长期显示“Swipe 目标已切换”
- 改为在 swipe 控件附近做局部反馈，或触发短 toast

### Composer

#### 组成

- 建议输入区
- 可见 label 的输入框
- helper text / 状态文本
- Send / Stop 按钮

#### 发送态策略

当前“禁用输入 + 发送按钮变纯 spinner”的处理过于粗糙。建议改成：

- 输入框可以保留草稿内容
- 按钮在生成中切换为 `Stop`
- 明确展示 `Generating...` 或中文等价文案

#### 建议输入

建议输入保留，但折叠 / 展开动画必须提供 reduced-motion 分支。

### Advanced Tools Drawer

承载以下能力：

- 剧情推进
- 视角切换
- 场景过渡
- 用户名设置
- JSONL 导入 / 导出
- 调试入口

#### 桌面端

可作为 anchored popover 或 side drawer 展示。

#### 移动端

统一为 bottom sheet，不允许向上绝对定位浮层直接叠在输入区上方。

## Interaction Rules

### Reading Flow

阅读消息时，消息区应该是稳定的。

自动滚动规则：

- 若用户当前接近底部，收到新消息时自动滚动到底部
- 若用户已经离开底部浏览历史，则不抢焦点
- 此时显示“跳到最新”按钮

### Sending Flow

标准路径：

- 读消息
- 输入或点建议
- 点击发送
- 进入生成中状态
- 可选择停止生成
- 生成完成后继续阅读或再生成

### Feedback Rules

以下操作都必须给出明确反馈：

- 发送中
- 停止生成
- 模型切换
- Streaming 开关切换
- Fast Model 切换
- Swipe 切换
- 导入 / 导出
- 错误与恢复路径

## Accessibility Requirements

### 输入与表单

- 输入框必须有可见 label；至少也要 `label + aria-describedby`
- 错误信息靠近字段，不只放 toast
- placeholder 不承担 label 职责

### 点击区与交互

- 所有 icon button 点击区 >= 44px
- 图标按钮必须有 `aria-label`
- 不能依赖 hover 才能理解其作用

### 焦点与键盘

- 所有关键操作可 Tab 到达
- focus-visible 清晰可见
- drawer / dialog 打开与关闭后焦点管理正确

### 动效

- 建议折叠、spinner、drawer 动画都要尊重 `prefers-reduced-motion`
- reduced-motion 下优先退化为淡入淡出或直接切换

### 视口与缩放

- 不应禁止用户缩放
- 不应使用 `maximum-scale=1`

## Responsive Strategy

### Desktop

- Session Toolbar 横向排列
- Message Timeline 控制最大阅读宽度
- 高级工具优先使用 popover / side drawer

### Mobile

- 顶部全局按钮不能只保留无文字图标
- Composer 只保留核心动作
- 高级工具统一进入 bottom sheet
- 避免出现横向工具 rail 成为主要交互方式

## Visual Direction

本轮视觉方向采用“沉浸但克制”的叙事界面，而不是继续强化调试面板感。

### 色彩

- 深色底，但避免大面积纯黑
- 以 semantic token 建立 canvas / panel / elevated 三层表面
- 强调色控制数量，避免多个高亮色抢层级

### 排版

- 标题可保留带叙事感的 display / serif
- 正文维持高可读 sans / serif 混合策略
- 统一页面标题、段落、辅助文本的字号与节奏

### 阴影与层级

当前全局视觉过平。建议恢复少量、语义化的 elevation，用于：

- 弹层
- drawer
- 重点 CTA
- 消息 bubble 层次区分

不是为了炫技，而是为了可读和可扫。

## Implementation Map

### 聊天相关

- `components/CharacterChatPanel.tsx`
  - 移除挂在消息头上的会话级控制
  - 接入新的 `SessionToolbar`
- `components/character-chat/MessageItem.tsx`
  - 精简消息头职责
  - 强化用户消息容器
- `components/character-chat/MessageList.tsx`
  - 重写自动滚底策略
  - 增加“跳到最新”逻辑
- `components/character-chat/ChatInput.tsx`
  - 补 label / helper text / stop 状态
  - 移除常驻横向工具 rail 依赖
- `components/character-chat/ControlPanel.tsx`
  - 重构为高级工具 drawer / sheet
- `components/character-chat/ApiSelector.tsx`
- `components/character-chat/MessageHeaderControls.tsx`
  - 提升点击区、focus、显性状态

### 壳层与页面

- `components/layout/LeftNav.tsx`
  - 简化一级导航
- `components/layout/TopBar.tsx`
  - 提升移动端全局控制可理解性
- `components/HomeContent.tsx`
  - 重做首页空状态与 CTA
- `app/character-cards/page.tsx`
  - 重构页面头部和模式语义
- `app/personas/page.tsx`
- `components/PersonaEditor.tsx`
  - 采用 progressive disclosure
- `app/layout.tsx`
- `app/i18n/LanguageProvider.tsx`
  - 统一 SSR / CSR 初始语言和主题策略

## Rollout Plan

### Phase 1: Chat Structure

- 新建 `SessionToolbar`
- 拆掉消息头中的会话级控制
- 精简消息头与消息动作
- 重构 composer 结构

### Phase 2: Accessibility + Responsive

- 统一按钮点击区、aria-label、focus-visible
- 加 `prefers-reduced-motion`
- 移动端 drawer / sheet 化
- 调整发送态、切换态反馈

### Phase 3: Shell + Entry Pages

- 简化导航
- 统一页面头部模板
- 优化首页、角色卡、Personas
- 修正语言 / 主题首屏不一致问题

### Phase 4: Visual Polish

- 收口 spacing、surface、typography、state tokens
- 统一空状态、toast、sheet、dialog 的视觉层级

## Risks

### 1. 聊天区组件耦合较高

聊天页目前存在多个组件间的插槽和状态传递，重排时容易引起 props 扩散。需要先稳定组件边界，再调整表现层。

### 2. 移动端 drawer 改造可能影响现有交互记忆

需要明确哪些能力必须保留原位置，哪些可以后置。否则会造成老用户短期不适应。

### 3. 视觉收口若先行，可能掩盖结构问题

因此必须按照“结构 -> 可访问性 -> 壳层 -> 视觉”的顺序推进。

## Success Criteria

### Product

- 首次进入聊天页的用户，能在 3 秒内理解主任务入口
- 高级配置不再压制阅读和输入
- 首页主路径清晰：新建会话、导入角色、创建 Persona

### UX

- 阅读历史时不会被强制滚到底部
- 发送、停止、模型切换、导入导出都有清晰反馈
- 移动端不依赖横向工具滚动完成主要操作

### Accessibility

- 输入有 label
- 图标按钮有 `aria-label`
- 关键点击区 >= 44px
- reduced-motion 生效
- 可缩放视口恢复
- 对比度达到 AA

### Consistency

- 首页、角色卡、Personas、聊天页使用统一的头部与空状态策略
- 语言 / 主题首屏不再发生明显抖动

## Validation Checklist

- [ ] 会话级控制不再出现在单条消息头中
- [ ] 用户消息与助手消息一眼可分
- [ ] 输入框具备 label / helper text / 明确状态
- [ ] 发送中可停止，且状态文案清晰
- [ ] 阅读历史时不会被强制拉回底部
- [ ] 移动端高级工具通过 sheet 进入
- [ ] 所有 icon button 满足 44px 点击区
- [ ] 页面支持 reduced-motion
- [ ] 页面允许用户缩放
- [ ] 首页具备有效主 CTA 和空状态引导
