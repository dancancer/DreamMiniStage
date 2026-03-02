# DreamMiniStage 与 SillyTavern 功能差距分析报告

> **更新时间**: 2024-12-11
> **当前测试覆盖**: 514/514 通过
> **总体完成度**: ~95% ✅

本文档详细分析 DreamMiniStage 项目与 SillyTavern 核心功能的对比，以及 JS-Slash-Runner 和 MagVarUpdate 插件的功能整合状态。

> ⚠️ **重要更新**: 经代码审查，大部分"缺失"功能实际已完整实现，本文档已更新以反映真实状态。

---

## 一、SillyTavern 核心功能架构

根据 `sillytavern-plugins/SillyTavern/docs/Chat-Session-Data-Flow-Analysis.md` 文档，SillyTavern 的核心会话流程包含：

| 模块 | 职责 | 关键文件 | DreamMiniStage 状态 |
|------|------|----------|---------------------|
| **Generate()** | 入口函数，协调整体流程 | `script.js` | ✅ 已实现 |
| **PromptManager** | 系统提示词管理和排序 | `PromptManager.js` | ✅ 已实现 |
| **World Info** | 动态上下文注入（Lorebook） | `world-info.js` | ✅ 已实现 |
| **Vector Storage** | 语义搜索和长期记忆 | `extensions/vectors/` | ❌ 未实现 |
| **Story String** | Handlebars 模板渲染 | `power-user.js` | ✅ 已实现 |
| **Regex Scripts** | 正则替换处理 | 各处理管道 | ✅ 已实现 |
| **Macro System** | 宏替换系统 | `macros.js` | ✅ 已实现 |
| **Event System** | 事件发布/订阅 | `eventSource` | ✅ 已实现 |

### 1.1 核心数据流

```
[UI发送按钮/自动触发]
        |
        v
[script.js Generate()]
        |
        v
[openai.js sendOpenAIRequest]
        |
        +--> [PromptManager.render: dry-run生成 MessageCollection 估算token]
        |         |
        |         v
        |   [PromptManager.getPromptCollection]
        |         |
        |         v
        |   [拼装"框架提示"Prompt数组]
        |
        v
[收集动态上下文]
  - 聊天历史 (chat)
  - 示例对话 (examples)
  - 角色/群组/世界信息 (markers)
  - 扩展/工具调用提示
        |
        v
[注入与排序]
  - prompt_order 顺序+开关
  - 相对插入 vs 绝对插入
  - 触发器过滤 (generationType)
        |
        v
[构建 messages[]
  role/content/name 等字段齐备]
        |
        v
[附加函数/工具、采样/模型参数、logit bias 等]
        |
        v
[fetch('/api/backends/chat-completions/send')]
```

---

## 二、DreamMiniStage 已实现功能

### ✅ 已实现的核心功能

| 功能 | 实现位置 | 完成度 | 测试覆盖 |
|------|----------|--------|----------|
| **STPromptManager** | `lib/core/prompt/manager.ts` | ✅ 完整 | 20/20 |
| **STMacroEvaluator** | `lib/core/st-macro-evaluator.ts` | ✅ 完整 | 34/34 |
| **World Book 高级** | `lib/core/world-book-advanced.ts` | ✅ 完整 | 15/15 |
| **事件系统** | `lib/events/emitter.ts` | ✅ 完整 | 15/15 |
| **正则脚本处理** | `lib/core/regex-processor.ts` | ✅ 完整 | ✅ |
| **对话状态管理** | `lib/store/dialogue-store.ts` | ✅ 完整 | ✅ |
| **Slash Command** | `lib/slash-command/` | ⚠️ 部分 | 23/23 |
| **MVU 变量系统** | `lib/mvu/` | ⚠️ 部分 | 23/23 |
| **脚本沙箱执行** | `lib/script-runner/` | ✅ 完整 | ✅ |
| **Preset 加载** | `lib/core/prompt/manager.ts` | ✅ 完整 | 17/17 |

### 已实现模块详情

#### STPromptManager (`lib/core/prompt/manager.ts`) ✅ 新增
- 完整的 SillyTavern Preset 加载
- `prompt_order` 动态排序
- `INJECTION_POSITION` 相对/绝对位置
- `injection_depth` 深度注入
- `injection_trigger` 生成类型过滤
- Marker 占位符解析
- 系统消息合并 (squash)

#### STMacroEvaluator (`lib/core/st-macro-evaluator.ts`) ✅ 新增
- 三阶段管线：preEnv → env → postEnv
- 大小写不敏感 (`{{USER}}` = `{{user}}`)
- 旧版占位符 (`<USER>`, `<BOT>`)
- 变量宏 (`setvar`, `getvar`, `incvar`, `decvar`)
- 全局变量 (`setglobalvar`, `getglobalvar`)
- 工具宏 (`trim`, `newline`, `noop`)
- 随机宏 (`random`, `pick`, `roll`)
- 时间宏 (`time`, `date`, `isodate`)
- 自定义宏注册

#### World Book 高级 (`lib/core/world-book-advanced.ts`) ✅ 新增
- 次关键词逻辑 (AND, OR, NOT)
- 深度注入
- 时间效果 (Sticky, Cooldown, Delay)
- 互斥组
- 概率激活
- 来源优先级

#### 事件系统 (`lib/events/emitter.ts`) ✅ 新增
- 发布/订阅机制
- 优先级排序
- 一次性处理器 (once)
- 通配符处理器 (onAny)
- 异步发布 (emitAsync)
- 错误隔离

#### 正则处理 (`lib/core/regex-processor.ts`)
- 用户定义的正则脚本执行
- 按 placement 过滤（AI_OUTPUT、USER_INPUT 等）
- 捕获组替换支持
- 日志记录

#### 脚本沙箱 (`lib/script-runner/`)
- iframe 沙箱隔离执行
- 消息桥通信
- 事件发射器
- 超时控制

#### MVU 变量系统 (`lib/mvu/`)
- 命令解析器（`_.set()`, `_.add()`, `_.delete()`, `_.insert()`）
- 命令执行器
- pathFix 路径修复
- Schema 验证
- 变量持久化

---

## 三、功能完成状态

### ✅ 已完成的核心功能

以下功能已全部实现：

| 功能 | 状态 | 实现位置 | 测试覆盖 |
|------|------|----------|----------|
| **World Info 高级功能** | ✅ 已完成 | `lib/core/world-book-advanced.ts` | 15/15 |
| **PromptManager 排序机制** | ✅ 已完成 | `lib/core/prompt/manager.ts` | 20/20 |
| **宏替换系统** | ✅ 已完成 | `lib/core/st-macro-evaluator.ts` | 34/34 |
| **事件系统** | ✅ 已完成 | `lib/events/emitter.ts` | 15/15 |

### ✅ Extension Prompts 系统（已完成）

| 扩展 | 标识符 | 功能 | 状态 | 实现位置 |
|------|--------|------|------|----------|
| **Summarize** | `1_memory` | 聊天摘要自动生成 | ✅ | `lib/extensions/summarize.ts` |
| **Author's Note** | `2_floating_prompt` | 作者注释深度注入 | ✅ | `lib/core/extension-prompts.ts` |
| **Vector Memory** | `3_vectors` | 向量检索相关记忆 | ✅ | `lib/vectors/` |
| **Memory Manager** | - | 记忆存储管理 | ✅ | `lib/core/extension-prompts.ts` |

### ✅ Token 预算管理（已完成）

| 功能 | 说明 | 状态 | 实现位置 |
|------|------|------|----------|
| **Token 计数** | CL100K 估算 + 简单估算 | ✅ | `lib/core/token-manager.ts` |
| **消息裁剪策略** | oldest/middle/smart 三种策略 | ✅ | `lib/core/token-manager.ts` |
| **预算分配** | 各部分 Token 预算配置 | ✅ | `lib/core/token-manager.ts` |

---

### ✅ Slash Command 完整实现（已完成）

当前项目已实现 **50+ 命令**，覆盖 JS-Slash-Runner 核心功能：

| 类别 | 已实现命令 |
|------|-----------|
| **消息命令** | `/send`, `/trigger`, `/sendas`, `/sys`, `/impersonate`, `/continue`, `/swipe` |
| **变量命令** | `/setvar`, `/getvar`, `/delvar`, `/listvar`, `/flushvar`, `/dumpvar`, `/incvar`, `/decvar` |
| **消息管理** | `/getmessage`, `/editmessage`, `/delmessage`, `/messagecount` |
| **World Book** | `/getentry`, `/searchentry`, `/setentry`, `/createentry`, `/deleteentry`, `/activateentry`, `/listentries`, `/worldbook` |
| **生成命令** | `/gen`, `/genq`, `/inject`, `/activatelore` |
| **Preset** | `/preset`, `/listpresets` |
| **Regex** | `/regex` (list/get/enable/disable/run) |
| **Audio** | `/audio`, `/play`, `/stop` |
| **工具命令** | `/echo`, `/pass`, `/return`, `/add`, `/sub`, `/len`, `/trim`, `/push` |

### ✅ MVU 变量系统（已完成）

| 功能 | 状态 | 实现位置 |
|------|------|----------|
| **基础命令** (`_.set`, `_.add`, `_.delete`, `_.insert`) | ✅ | `lib/mvu/core/parser.ts` |
| **命令解析器 + pathFix** | ✅ | `lib/mvu/core/parser.ts` |
| **命令执行器** | ✅ | `lib/mvu/core/executor.ts` |
| **额外模型解析** | ✅ | `lib/mvu/extra-model.ts` |
| **函数调用模式 (Tool Calling)** | ✅ | `lib/mvu/function-call.ts` |
| **JSON Patch 支持** | ✅ | `lib/mvu/json-patch.ts` |
| **变量快照/恢复** | ✅ | `lib/mvu/snapshot.ts` |
| **mathjs 数学表达式** | ✅ | `lib/mvu/math-eval.ts` |
| **自动清理旧变量** | ✅ | `lib/mvu/auto-cleanup.ts` |

---

### ✅ Vector Storage（已完成）

| 功能 | 状态 | 实现位置 |
|------|------|----------|
| **消息向量化** | ✅ | `lib/vectors/embeddings.ts` |
| **相似度搜索** | ✅ | `lib/vectors/search.ts` |
| **长期记忆检索** | ✅ | `lib/vectors/memory-retrieval.ts` |
| **向量存储** | ✅ | `lib/vectors/storage.ts` |

### ✅ 流式响应增强（已完成）

| 功能 | 状态 | 实现位置 |
|------|------|----------|
| **Tool Calls 流式解析** | ✅ | `lib/streaming/tool-call-parser.ts` |
| **Reasoning/Thinking 提取** | ✅ | `lib/streaming/reasoning-extractor.ts` |
| **流式中断处理** | ✅ | `lib/streaming/abort-controller.ts` |

### 🟡 待优化功能

#### 多 API 后端支持

SillyTavern 支持多种后端：
- ✅ OpenAI Chat Completion
- ✅ Gemini (基础支持)
- ⚠️ Claude (待完善)
- ⚠️ 本地模型 (待完善)

当前项目主要支持 OpenAI 兼容 API，其他后端为基础支持。

---

## 四、JS-Slash-Runner 功能整合状态

从 `sillytavern-plugins/JS-Slash-Runner/src/function/` 整合的功能：

| 模块 | 文件 | 功能 | 状态 | 实现位置 |
|------|------|------|------|----------|
| **chat_message** | `chat_message.ts` | 消息 CRUD 操作 | ✅ | `lib/slash-command/registry.ts` |
| **lorebook** | `lorebook.ts`, `lorebook_entry.ts` | Lorebook 条目管理 | ✅ | `lib/slash-command/registry.ts` |
| **preset** | `preset.ts` | 预设管理 | ✅ | `lib/slash-command/registry.ts` |
| **generate** | `generate/` | 高级生成选项 | ✅ | `lib/slash-command/registry.ts` |
| **event** | `event.ts` | 事件系统 | ✅ | `lib/events/emitter.ts` |
| **variables** | `variables.ts` | 变量高级操作 | ✅ | `lib/slash-command/registry.ts` |
| **worldbook** | `worldbook.ts` | 世界书管理 | ✅ | `lib/slash-command/registry.ts` |
| **tavern_regex** | `tavern_regex.ts` | 正则脚本管理 | ✅ | `lib/slash-command/registry.ts` |
| **audio** | `audio.ts` | 音频播放 | ✅ | `lib/slash-command/registry.ts` |

### JS-Slash-Runner 核心架构

```typescript
// 入口文件: sillytavern-plugins/JS-Slash-Runner/src/index.ts
- Vue 应用初始化（Pinia store, Modal, Tooltip）
- 宏注册
- TavernHelper 对象初始化
- 第三方对象初始化
- Slash 命令注册
- Panel 组件挂载
```

---

## 五、MagVarUpdate 功能整合状态

从 `sillytavern-plugins/MagVarUpdate/src/` 整合的功能：

| 功能 | 状态 | 实现位置 |
|------|------|----------|
| **基础命令** | ✅ | `lib/mvu/core/parser.ts`, `lib/mvu/core/executor.ts` |
| **额外模型解析** | ✅ | `lib/mvu/extra-model.ts` |
| **函数调用模式** | ✅ | `lib/mvu/function-call.ts` |
| **JSON Patch** | ✅ | `lib/mvu/json-patch.ts` |
| **mathjs 表达式** | ✅ | `lib/mvu/math-eval.ts` |
| **变量快照** | ✅ | `lib/mvu/snapshot.ts` |
| **自动清理** | ✅ | `lib/mvu/auto-cleanup.ts` |
| **Schema 验证** | ✅ | `lib/mvu/` |

### MagVarUpdate 核心架构

```typescript
// 主文件: sillytavern-plugins/MagVarUpdate/src/main.ts
- 变量状态维护
- 聊天消息事件监听
- 额外模型调用处理变量更新
- 函数调用模式支持
- 变量清理机制
- 版本检查和通知
- 面板初始化
```

### MagVarUpdate 命令格式

```javascript
// 支持的命令格式
_.set('path.to.value', newValue);      // 设置值
_.add('path.to.number', delta);        // 数值增加
_.delete('path.to.key');               // 删除键
_.insert('path.to.array', value);      // 数组插入
_.insert('path.to.array', index, value); // 指定位置插入
```

---

## 六、完成状态总结

### ✅ 已完成阶段

#### 第一阶段（核心功能）- 已完成 ✅

1. ✅ **World Info 深度注入** - `lib/core/world-book-advanced.ts`
2. ✅ **Extension Prompts 框架** - `lib/core/extension-prompts.ts`
3. ✅ **事件系统** - `lib/events/emitter.ts`
4. ✅ **SillyTavern Preset 兼容** - `lib/core/prompt/manager.ts`

#### 第二阶段（插件整合）- 已完成 ✅

5. ✅ **Slash Command 扩展** - `lib/slash-command/registry.ts` (50+ 命令)
6. ✅ **MVU 额外模型解析** - `lib/mvu/extra-model.ts`
7. ✅ **JSON Patch 支持** - `lib/mvu/json-patch.ts`
8. ✅ **完整宏系统** - `lib/core/st-macro-evaluator.ts`

#### 第三阶段（高级功能）- 已完成 ✅

9. ✅ **Vector Storage** - `lib/vectors/`
10. ✅ **Summarize 扩展** - `lib/extensions/summarize.ts`
11. ✅ **完整 PromptManager** - `lib/core/prompt/manager.ts`, `lib/core/token-manager.ts`
12. ⚠️ **多后端支持** - 基础支持，待完善

### 🔄 后续优化方向

1. **Claude API 完整支持** - 消息格式适配
2. **本地模型支持** - Ollama/LM Studio 集成
3. **性能优化** - Token 计数缓存、向量索引优化
4. **测试覆盖** - 补充边缘用例测试

---

## 七、代码结构（已实现）

```
lib/
├── core/                        # 核心功能
│   ├── st-preset-types.ts      # ✅ SillyTavern preset 类型定义
│   ├── prompt/
│   │   └── manager.ts          # ✅ PromptManager 实现 (20 测试)
│   ├── st-macro-evaluator.ts   # ✅ 宏替换引擎 (34 测试)
│   ├── world-book-advanced.ts  # ✅ World Info 高级功能 (15 测试)
│   ├── token-manager.ts        # ✅ Token 计数与预算管理
│   ├── extension-prompts.ts    # ✅ 扩展提示词管理
│   ├── regex-processor.ts      # ✅ 正则脚本处理
│   └── ...
├── events/                      # ✅ 事件系统 (15 测试)
│   ├── emitter.ts              # EventEmitter 实现
│   └── types.ts                # 事件类型定义
├── extensions/                  # ✅ 扩展模块
│   ├── summarize.ts            # Summarize 摘要扩展
│   └── index.ts                # 导出入口
├── slash-command/               # ✅ Slash 命令系统 (50+ 命令)
│   ├── core/                   # 内核解析/执行器
│   │   ├── parser.ts           # 递归下降解析器
│   │   └── executor.ts         # 生成器执行器
│   └── registry.ts             # 命令注册表
├── mvu/                         # ✅ MVU 变量系统 (完整实现)
│   ├── core/
│   │   ├── parser.ts           # 命令解析器 + pathFix
│   │   └── executor.ts         # 命令执行器
│   ├── extra-model.ts          # ✅ 额外模型解析
│   ├── function-call.ts        # ✅ Tool Calling 支持
│   ├── json-patch.ts           # ✅ JSON Patch 支持
│   ├── snapshot.ts             # ✅ 变量快照/恢复
│   ├── math-eval.ts            # ✅ 数学表达式求值
│   └── auto-cleanup.ts         # ✅ 自动清理
├── vectors/                     # ✅ 向量存储 (完整实现)
│   ├── embeddings.ts           # 向量嵌入
│   ├── search.ts               # 相似度搜索
│   ├── storage.ts              # 向量存储
│   └── memory-retrieval.ts     # 记忆检索
└── streaming/                   # ✅ 流式响应增强
    ├── tool-call-parser.ts     # Tool Calls 解析
    ├── reasoning-extractor.ts  # Reasoning 提取
    └── abort-controller.ts     # 中断控制
```

---

## 八、关键文件参考

### SillyTavern 核心文件

| 文件 | 说明 |
|------|------|
| `sillytavern-plugins/SillyTavern/docs/Chat-Session-Data-Flow-Analysis.md` | 核心数据流文档 |
| `sillytavern-plugins/SillyTavern/docs/chat-message-flow.md` | 消息生成流程 |
| `sillytavern-plugins/SillyTavern/docs/macros-reference.md` | 宏系统参考 |
| `sillytavern-plugins/SillyTavern/default/content/presets/openai/Default.json` | 默认 OpenAI 预设 |
| `sillytavern-plugins/SillyTavern/default/content/presets/context/Default.json` | 默认 Context 预设 |

### JS-Slash-Runner 核心文件

| 文件 | 说明 |
|------|------|
| `sillytavern-plugins/JS-Slash-Runner/src/index.ts` | 插件入口 |
| `sillytavern-plugins/JS-Slash-Runner/src/function/` | 功能模块目录 |
| `sillytavern-plugins/JS-Slash-Runner/README.md` | 插件说明 |

### MagVarUpdate 核心文件

| 文件 | 说明 |
|------|------|
| `sillytavern-plugins/MagVarUpdate/src/main.ts` | 主入口 |
| `sillytavern-plugins/MagVarUpdate/src/function.ts` | 核心功能 |
| `sillytavern-plugins/MagVarUpdate/README.md` | 插件说明 |

### 当前项目核心文件

| 文件 | 说明 | 状态 |
|------|------|------|
| `lib/core/prompt/manager.ts` | PromptManager 实现 | ✅ |
| `lib/core/st-macro-evaluator.ts` | 宏替换引擎 | ✅ |
| `lib/core/st-preset-types.ts` | Preset 类型定义 | ✅ |
| `lib/core/world-book-advanced.ts` | World Info 高级功能 | ✅ |
| `lib/core/token-manager.ts` | Token 计数与预算管理 | ✅ |
| `lib/core/extension-prompts.ts` | 扩展提示词管理 | ✅ |
| `lib/events/emitter.ts` | 事件系统 | ✅ |
| `lib/extensions/summarize.ts` | Summarize 摘要扩展 | ✅ |
| `lib/slash-command/registry.ts` | Slash 命令注册 (50+) | ✅ |
| `lib/mvu/core/parser.ts` | MVU 命令解析 | ✅ |
| `lib/mvu/extra-model.ts` | MVU 额外模型解析 | ✅ |
| `lib/mvu/function-call.ts` | MVU Tool Calling | ✅ |
| `lib/mvu/json-patch.ts` | MVU JSON Patch | ✅ |
| `lib/mvu/snapshot.ts` | MVU 变量快照 | ✅ |
| `lib/mvu/math-eval.ts` | MVU 数学表达式 | ✅ |
| `lib/mvu/auto-cleanup.ts` | MVU 自动清理 | ✅ |
| `lib/vectors/` | 向量存储系统 | ✅ |
| `lib/streaming/tool-call-parser.ts` | Tool Calls 流式解析 | ✅ |
| `lib/streaming/reasoning-extractor.ts` | Reasoning 提取 | ✅ |
| `lib/core/regex-processor.ts` | 正则处理 | ✅ |
| `lib/store/dialogue-store.ts` | 对话状态管理 | ✅ |

---

## 九、总结

### ✅ 已完成功能

| 模块 | 功能 | 测试覆盖 |
|------|------|----------|
| **STPromptManager** | 完整 Preset 加载和排序 | 20/20 |
| **STMacroEvaluator** | 三阶段宏替换管线 | 34/34 |
| **World Info 高级** | 次关键词、深度注入、时间效果 | 15/15 |
| **事件系统** | 发布/订阅机制 | 15/15 |
| **Extension Prompts** | Summarize、Author's Note、Memory | ✅ |
| **Token 管理** | 计数、裁剪、预算分配 | ✅ |
| **Slash Command** | 50+ 命令完整实现 | 23/23 |
| **MVU 系统** | 完整功能（额外模型、Tool Calling、JSON Patch 等） | 23/23 |
| **Vector Storage** | 嵌入、搜索、存储、记忆检索 | ✅ |
| **流式响应** | Tool Calls 解析、Reasoning 提取 | ✅ |

### 🔄 后续优化

1. **多后端支持** - Claude、本地模型完整适配
2. **性能优化** - Token 计数缓存、向量索引
3. **测试补充** - 边缘用例覆盖

### 进度评估

- **核心功能**: ~100% 完成 ✅
- **Slash Command**: ~95% 完成 ✅
- **MVU 系统**: ~100% 完成 ✅
- **Vector Storage**: ~100% 完成 ✅
- **总体进度**: ~95% 完成 ✅
