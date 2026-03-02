---
name: codex-toolkit
description: |
  使用 Codex 工具进行复杂计划制定、代码审查、复杂逻辑实现和 bug 排查。
  擅长：(1) 制定多步骤实现计划 (2) 深度代码审查 (3) 架构设计决策 (4) 实现复杂算法和业务逻辑 (5) 根据错误信息诊断和修复 bug。
  当需要规划复杂任务、审查代码质量、进行架构分析、实现复杂逻辑、排查错误、调试问题时使用。
allowed-tools: Bash
---

# Codex 工具集

## 核心能力

Codex 是高级代码分析和实现工具，专注于四个核心场景：

1. **制定复杂计划** (`codex exec`)
   分解复杂任务为可执行步骤，提供架构建议和实现路径

2. **深度代码审查** (`codex review`)
   分析代码质量、安全性、可维护性，识别架构缺陷

3. **实现复杂逻辑** (`codex exec`)
   编写复杂算法、业务逻辑、数据处理流程等高难度代码

4. **排查和修复 Bug** (`codex exec`)
   根据错误堆栈、日志信息诊断问题根因，提供修复方案

---

## 使用模式

### 模式 1：通过管道传递任务（推荐）

```bash
echo 'YOUR_TASK_DESCRIPTION' | codex exec
```

**适用场景**：
- 复杂功能实现规划
- 多文件重构设计
- 架构决策咨询
- 复杂算法和业务逻辑实现
- 错误诊断和 bug 修复

**示例**：
```bash
# 规划复杂任务
echo '设计一个支持多主题的用户认证系统' | codex exec

# 重构建议
echo '重构 components/ChatBubble 以提高性能和可维护性' | codex exec

# 架构分析
echo '评估当前状态管理方案，建议优化路径' | codex exec

# 实现复杂逻辑
echo '实现一个支持优先级队列的任务调度器，包含：
- 任务优先级管理（高/中/低）
- 并发控制（最多 3 个并发任务）
- 任务超时重试机制
- 状态持久化到 localStorage' | codex exec

# 排查 bug
echo '根据以下错误信息诊断问题：
TypeError: Cannot read property "map" of undefined
  at ChatList.tsx:45
  at useEffect hook

上下文：用户登录后加载聊天列表时报错' | codex exec
```

---

### 模式 2：代码审查

```bash
codex review [OPTIONS]
```

**关键选项**：
- `--uncommitted`：审查未提交的修改
- `--base <BRANCH>`：审查与指定分支的差异
- `--commit <SHA>`：审查特定提交

**示例**：
```bash
# 审查当前所有修改
codex review --uncommitted

# 审查与 main 分支的差异
codex review --base main

# 审查最近一次提交
codex review --commit HEAD
```

---

## 工作流程

### 场景 A：规划复杂实现

```
1. 明确任务目标
   ↓
2. 构造任务描述（包含需求、约束、期望）
   ↓
3. 通过管道传递给 codex exec
   ↓
4. 分析返回的实现步骤和架构建议
   ↓
5. 如需更深入思考，添加更多上下文重新提交
```

### 场景 B：深度代码审查

```
1. 确定审查范围（文件/分支/提交）
   ↓
2. 运行 codex review [target]
   ↓
3. 分析工具识别的问题
   ↓
4. 针对关键问题制定修复计划
```

### 场景 C：实现复杂逻辑

```
1. 明确算法/逻辑需求和边界条件
   ↓
2. 描述输入输出、约束条件、性能要求
   ↓
3. 通过管道传递给 codex exec
   ↓
4. 获得完整实现代码和解释
   ↓
5. 审查代码，测试边界情况
```

### 场景 D：排查和修复 Bug

```
1. 收集错误信息（堆栈、日志、复现步骤）
   ↓
2. 构造包含完整上下文的问题描述
   ↓
3. 通过管道传递给 codex exec
   ↓
4. 分析 codex 给出的根因诊断
   ↓
5. 应用修复方案并验证
```

---

## 辅助思考模式

当遇到以下情况时，使用 codex 进行辅助思考：

1. **架构决策点**
   ```bash
   echo '对比 Redux vs Zustand vs Context API，选择最适合当前项目的状态管理方案' | codex exec
   ```

2. **性能瓶颈分析**
   ```bash
   echo '分析 ChatBubble 组件的渲染性能问题，建议优化方案' | codex exec
   ```

3. **重构路径规划**
   ```bash
   echo '将单体 400+ 行组件拆分为多个职责单一的子组件，给出拆分方案' | codex exec
   ```

4. **代码质量改进**
   ```bash
   codex review --uncommitted
   # 针对发现的问题，进一步询问：
   echo '优化 codex review 发现的循环依赖问题' | codex exec
   ```

5. **复杂算法实现**
   ```bash
   echo '实现一个 LRU 缓存，要求：
   - O(1) 时间复杂度的 get 和 put 操作
   - 使用 TypeScript 实现
   - 支持泛型
   - 包含完整的边界条件处理' | codex exec
   ```

6. **Bug 诊断和修复**
   ```bash
   echo 'Bug 描述：
   错误：Uncaught TypeError: Cannot read properties of null (reading "addEventListener")
   位置：app/components/AudioPlayer.tsx:127
   复现步骤：切换语言后点击播放按钮

   相关代码：
   ```typescript
   useEffect(() => {
     audioRef.current.addEventListener("ended", handleEnded);
   }, [language]);
   ```

   请诊断问题并给出修复方案' | codex exec
   ```

---

## 最佳实践

### ✅ 好的任务描述

```bash
# 清晰、具体、包含约束
echo '实现用户头像上传功能：
- 支持拖拽和点击上传
- 限制 2MB，仅允许 jpg/png
- 自动裁剪为 200x200
- 集成到现有的 Profile 组件
- 使用项目已有的 fal.ai API' | codex exec
```

### ❌ 差的任务描述

```bash
# 模糊、缺乏上下文
echo '加个上传功能' | codex exec
```

---

### ✅ 好的复杂逻辑实现请求

```bash
# 包含需求、约束、性能指标
echo '实现二叉搜索树的平衡操作（AVL 旋转）：
- 输入：不平衡的 BST 节点
- 输出：平衡后的子树根节点
- 约束：空间复杂度 O(1)，时间复杂度 O(1)
- 语言：TypeScript，使用类实现
- 包含单元测试用例' | codex exec
```

### ❌ 差的复杂逻辑实现请求

```bash
# 缺少关键信息
echo '写个 AVL 树' | codex exec
```

---

### ✅ 好的 Bug 排查请求

```bash
# 完整的错误上下文和复现步骤
echo 'Bug 报告：
【错误信息】
ReferenceError: regeneratorRuntime is not defined
  at async fetchUserData (lib/api.ts:23)

【复现步骤】
1. 用户点击"加载更多"按钮
2. 发起异步请求
3. 立即报错

【环境】
- Next.js 15, React 19
- 使用 async/await 语法
- 生产构建时出现，开发环境正常

【相关代码】
```typescript
export async function fetchUserData(page: number) {
  const res = await fetch(`/api/users?page=${page}`);
  return res.json();
}
```

请诊断根因并提供修复方案' | codex exec
```

### ❌ 差的 Bug 排查请求

```bash
# 信息不足，无法诊断
echo '代码报错了，帮我看看' | codex exec
```

---

### ✅ 高效的审查流程

```bash
# 1. 先快速审查全局
codex review --uncommitted

# 2. 针对关键问题深入分析
echo '分析 UserContext 中的状态更新导致的性能问题' | codex exec

# 3. 验证修复方案
codex review --uncommitted
```

### ❌ 低效的审查流程

```bash
# 直接审查，缺少后续分析和验证
codex review --uncommitted
# 然后就没有然后了...
```

---

## 高级技巧

### 1. 递增式规划

```bash
# 第一轮：获取高层方案
echo '设计实时通知系统' | codex exec

# 第二轮：深入特定模块
echo '设计实时通知系统的 WebSocket 连接管理和重连机制' | codex exec

# 第三轮：聚焦实现细节
echo '实现 WebSocket 重连的指数退避策略' | codex exec
```

### 2. 组合使用

```bash
# 先审查现有代码
codex review --base main

# 根据审查结果制定重构计划
echo '根据以下问题制定重构计划：[粘贴 codex review 的输出]' | codex exec
```

### 3. 上下文注入

```bash
# 将相关代码片段包含在任务描述中
echo 'Current implementation:
```typescript
// [粘贴当前代码]
```

Task: 优化此组件的渲染性能，减少不必要的重渲染' | codex exec
```

### 4. 分层调试法

```bash
# 第一层：快速定位问题区域
echo '分析以下错误属于哪个层次的问题（网络/状态/渲染/逻辑）：
[错误堆栈]' | codex exec

# 第二层：深入具体模块
echo '在 [模块名] 中定位 [错误类型] 的具体原因' | codex exec

# 第三层：生成修复代码
echo '针对 [根因]，生成修复代码，要求：
- 不破坏现有 API
- 包含单元测试
- 添加防御性编程' | codex exec
```

---

## 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `codex: command not found` | 未安装或未在 PATH 中 | 检查 codex 安装：`which codex` |
| 输出过于简略 | 任务描述不够具体 | 添加更多上下文、约束和期望 |
| 审查无结果 | 没有可审查的变更 | 确认有 staged 或 uncommitted 的修改 |
| 建议不适用 | codex 缺少项目上下文 | 在任务描述中包含项目特定信息 |
| 生成的代码无法运行 | 需求描述不完整 | 明确输入输出类型、边界条件、依赖 |
| Bug 诊断不准确 | 错误信息不完整 | 提供完整堆栈、复现步骤、环境信息 |
| 实现不符合项目风格 | 未指定代码规范 | 在描述中说明项目使用的技术栈和风格 |

---

## 注意事项

1. **任务描述是关键**
   codex 的输出质量直接取决于你的输入质量。清晰、具体、包含约束的描述会得到更好的结果。

2. **迭代式使用**
   不要期望一次调用解决所有问题。从高层开始，逐步深入细节。

3. **结合其他工具**
   codex 擅长规划、审查、实现和调试，但测试和集成仍需你完成。

4. **审查输出的正确性**
   codex 的建议需要你的判断。不是所有建议都适合你的项目。

5. **复杂逻辑实现的验证**
   生成的代码必须经过：
   - 边界条件测试（空输入、极值、非法输入）
   - 性能验证（时间/空间复杂度是否符合要求）
   - 代码审查（是否符合项目规范和最佳实践）

6. **Bug 排查的完整性**
   提供错误信息时，必须包括：
   - 完整的错误堆栈（不要截断）
   - 复现步骤（越详细越好）
   - 环境信息（框架版本、浏览器、Node 版本等）
   - 相关代码（出错位置及其上下文）

---

## 哲学思考

Codex 的价值不在于替你写代码，而在于：

- **帮你思考得更深** - 将复杂任务分解为可管理的步骤
- **帮你看得更远** - 识别架构问题在它们变成灾难之前
- **帮你学得更快** - 通过分析好代码和坏代码，提升你的品味
- **帮你编码更优雅** - 生成符合最佳实践的复杂算法实现
- **帮你调试更高效** - 从症状快速定位到根因，而不是盲目试错

记住 Linus 的教诲：
> "好代码就是不需要例外的代码"

Codex 能帮你发现那些"例外"，并给出消除它们的路径。

### 关于复杂逻辑实现

复杂度的本质不是代码行数，而是**特殊情况的数量**。
一个处理 10 种边界情况的 200 行函数，远不如消除边界情况的 20 行函数优雅。

使用 codex 实现复杂逻辑时，不要问：
❌ "怎么实现这个功能？"

而要问：
✅ "怎么设计数据结构让这个功能变简单？"

### 关于 Bug 排查

Bug 不是代码的错误，而是**理解的缺失**。
- 每个 Bug 背后都有一个被忽略的假设
- 每个错误信息都在告诉你系统的真实状态
- 每次调试都是重新理解系统的机会

使用 codex 排查 bug 时，不要问：
❌ "为什么这行代码报错？"

而要问：
✅ "这个错误揭示了系统哪个部分的理解偏差？"

---

**最终目标**：

通过 codex，你不仅解决了问题，
更理解了问题为什么存在，
最终学会了如何设计不产生问题的系统。

从 "How to fix"（怎么修）
到 "Why it breaks"（为什么坏）
到 "How to design it right"（怎么设计对）
