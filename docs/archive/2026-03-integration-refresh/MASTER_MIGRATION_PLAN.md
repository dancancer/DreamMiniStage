# DreamMiniStage 功能对齐总任务列表

> 基于 `sillytavern-gap-analysis.md` 和 `st-preset-migration-plan.md` 制定
> 预计总工期：6-8 周

---

## 📋 任务状态说明

- ⬜ 待开始
- 🔄 进行中
- ✅ 已完成
- ⏸️ 暂停/阻塞

---

# 第一阶段：核心基础设施（预计 2 周）

## 模块 A：SillyTavern Preset 兼容系统

### A1. 类型定义与数据结构
- ✅ A1.1 创建 `lib/core/st-preset-types.ts`
  - ✅ 定义 `STOpenAIPreset` 接口
  - ✅ 定义 `STPrompt` 接口（含 injection_position/depth/order）
  - ✅ 定义 `STPromptOrder` 和 `STPromptOrderEntry` 接口
  - ✅ 定义 `STContextPreset` 接口（story_string 模板）
  - ✅ 定义 `STSyspromptPreset` 接口
  - ✅ 定义 `STCombinedPreset` 运行时组合类型
  - ✅ 定义 `MacroEnv` 宏替换环境接口

### A2. 宏替换引擎
- ✅ A2.1 创建 `lib/core/st-macro-evaluator.ts`
  - ✅ 实现三阶段管线架构（preEnv → env → postEnv）
  - ✅ 实现基础宏：`{{user}}`, `{{char}}`, `{{description}}`, `{{personality}}`, `{{scenario}}`
  - ✅ 实现内容宏：`{{persona}}`, `{{mesExamples}}`, `{{wiBefore}}`, `{{wiAfter}}`
  - ✅ 实现工具宏：`{{trim}}`, `{{newline}}`, `{{noop}}`
  - ✅ 实现宏注册机制（支持自定义宏）
- ✅ A2.2 变量宏实现
  - ✅ `{{getvar::name}}` / `{{setvar::name::value}}`
  - ✅ `{{getglobalvar::name}}` / `{{setglobalvar::name::value}}`
  - ✅ `{{incvar::name}}` / `{{decvar::name}}`
- ✅ A2.3 时间宏实现
  - ✅ `{{time}}`, `{{date}}`, `{{weekday}}`
  - ✅ `{{isotime}}`, `{{isodate}}`
- ✅ A2.4 消息宏实现
  - ✅ `{{lastMessage}}`, `{{lastUserMessage}}`, `{{lastCharMessage}}`
  - ✅ `{{lastMessageId}}`
- ✅ A2.5 随机宏实现
  - ✅ `{{random::a::b::c}}`
  - ✅ `{{pick::a::b}}`
  - ✅ `{{roll X}}`

### A3. PromptManager 实现
- ✅ A3.1 创建 `lib/core/prompt/manager.ts`
  - ✅ 实现 preset 加载和解析
  - ✅ 实现 `getOrderedPrompts()` 按 prompt_order 排序
  - ✅ 实现 marker 占位符解析（chatHistory, worldInfoBefore 等）
  - ✅ 实现相对注入位置（injection_position=0）
  - ✅ 实现绝对注入位置（injection_position=1 + injection_depth）
  - ✅ 实现 injection_trigger 过滤（normal/continue/quiet）
  - ✅ 实现 `buildMessages()` 构建最终消息数组
- ✅ A3.2 Context Preset 支持
  - ✅ 实现 story_string Handlebars 模板渲染
  - ✅ 实现 example_separator 处理
  - ✅ 实现 chat_start 标记处理
- ✅ A3.3 Sysprompt Preset 支持
  - ✅ 实现 `getSyspromptContent()` 主系统提示词注入
  - ✅ 实现 `getSyspromptPostHistory()` 历史后注入
  - ✅ 实现 `buildMessagesWithSysprompt()` 统一构建方法

### A4. 默认 Preset 迁移
- ✅ A4.1 创建 preset 目录结构（现已移除内置文件，改为用户自备）
  - ⬜ `public/presets/openai/Default.json`
  - ⬜ `public/presets/context/Default.json`
  - ⬜ `public/presets/sysprompt/` 目录
- 🔄 A4.2 迁移内置提示词（已废弃内置 MirrorRealm/NovelKing，转为用户自备）
  - ⬜ 迁移其他内置模板
- ✅ A4.3 清理旧代码
  - ✅ 标记 `lib/prompts/preset-prompts.ts` 为废弃 (@deprecated)
  - ✅ 标记 `lib/core/preset-assembler.ts` 为废弃 (@deprecated)
  - ✅ 更新 `PresetNodeTools.ts` 调用点添加迁移说明

---

## 模块 B：事件系统

### B1. 事件发射器核心
- ✅ B1.1 创建 `lib/events/emitter.ts`
  - ✅ 实现 EventEmitter 基类
  - ✅ 支持 on/off/once/emit
  - ✅ 支持通配符监听
  - ✅ 支持异步事件处理
- ✅ B1.2 创建 `lib/events/types.ts`
  - ✅ 定义 `GENERATION_STARTED` 事件
  - ✅ 定义 `MESSAGE_RECEIVED` 事件
  - ✅ 定义 `MESSAGE_SENT` 事件
  - ✅ 定义 `MESSAGE_DELETED` 事件
  - ✅ 定义 `CHAT_CHANGED` 事件
  - ✅ 定义 `CHAT_COMPLETION_SETTINGS_READY` 事件
  - ✅ 定义 `worldinfo_entries_loaded` 事件

### B2. 事件集成
- ✅ B2.1 在对话流程中触发事件
  - ✅ 生成开始时触发 `GENERATION_STARTED`
  - ✅ 收到响应时触发 `MESSAGE_RECEIVED`
  - ✅ 发送消息时触发 `MESSAGE_SENT`
  - ✅ 删除消息时触发 `MESSAGE_DELETED`
- ✅ B2.2 在脚本沙箱中暴露事件 API
  - ✅ 允许脚本监听事件 (`lib/script-runner/global-event-bridge.ts`)
  - ✅ 允许脚本触发自定义事件 (前缀 `custom:`)

---

## 模块 C：World Info 高级功能

### C1. 次关键词逻辑
- ✅ C1.1 创建 `lib/core/world-book-advanced.ts`
  - ✅ 实现 AND 逻辑（所有次关键词必须匹配）
  - ✅ 实现 OR 逻辑（任一次关键词匹配）
  - ✅ 实现 NOT 逻辑（排除关键词）
  - ✅ 实现组合逻辑解析器

### C2. 深度注入
- ✅ C2.1 实现 `worldInfoDepth` 机制
  - ✅ 按聊天历史深度计算注入位置
  - ✅ 支持多条目不同深度
  - ✅ 与 PromptManager 集成

### C3. 时间效果
- ✅ C3.1 实现 Sticky 效果
  - ✅ 条目激活后保持 N 轮
- ✅ C3.2 实现 Cooldown 效果
  - ✅ 条目激活后冷却 N 轮
- ✅ C3.3 实现 Delay 效果
  - ✅ 条目匹配后延迟 N 轮激活

### C4. 其他高级功能
- ✅ C4.1 实现概率激活（Probability）
- ✅ C4.2 实现互斥组（Mutual Exclusion Groups）
- ✅ C4.3 实现多来源优先级（Chat > Persona > Character > Global）

---

# 第二阶段：插件功能整合（预计 2-3 周）

## 模块 D：Slash Command 扩展

### D1. 命令架构重构
- ✅ D1.1 命令注册机制优化
  - ✅ 命令按功能分组组织
  - ✅ 支持命令别名 (`getmes`, `editmes`, `delmes`, `mescount`)
  - ⬜ 创建 `commands/` 子目录按模块组织

### D2. chat_message 命令组
- ✅ D2.1 参考 `JS-Slash-Runner/src/function/chat_message.ts`
  - ✅ 实现 `/getmessage` - 获取消息内容
  - ✅ 实现 `/editmessage` - 修改消息内容
  - ✅ 实现 `/delmessage` - 删除消息
  - ✅ 实现 `/messagecount` - 获取消息数量

### D3. lorebook 命令组
- ✅ D3.1 参考 `JS-Slash-Runner/src/function/lorebook.ts`
  - ✅ 实现 `/getentry` - 获取条目
  - ✅ 实现 `/setentry` - 设置条目
  - ✅ 实现 `/searchentry` - 搜索条目
  - ✅ 实现 `/activatelore` - 手动激活条目

### D4. generate 命令组
- ✅ D4.1 参考 `JS-Slash-Runner/src/function/generate/`
  - ✅ 实现 `/gen` `/generate` - 自定义生成
  - ✅ 实现 `/genq` `/generatequiet` - 静默生成
  - ✅ 实现 `/inject` - 临时注入提示词

### D5. variables 命令组
- ✅ D5.1 参考 `JS-Slash-Runner/src/function/variables.ts`
  - ✅ 实现 `/listvar` - 列出变量
  - ✅ 实现 `/flushvar` - 清空变量
  - ✅ 实现 `/dumpvar` - 导出变量
  - ✅ 实现 `/incvar` `/decvar` - 数值增减

### D6. worldbook 命令组
- ✅ D6.1 参考 `JS-Slash-Runner/src/function/worldbook.ts`
  - ✅ 实现 `/worldbook` `/wb` - 世界书管理 (list/get/search/enable/disable/delete)
  - ✅ 实现 `/createentry` - 创建条目
  - ✅ 实现 `/deleteentry` `/delentry` - 删除条目
  - ✅ 实现 `/activateentry` - 手动激活条目
  - ✅ 实现 `/listentries` - 列出所有条目

### D7. 其他命令组
- ✅ D7.1 preset 命令
  - ✅ 实现 `/preset` - 预设切换/获取
  - ✅ 实现 `/listpresets` - 列出可用预设
- ✅ D7.2 tavern_regex 命令
  - ✅ 实现 `/regex` - 正则脚本管理 (list/get/enable/disable/run)
- ✅ D7.3 audio 命令
  - ✅ 实现 `/audio` - 音频播放控制 (play/stop/pause/resume/volume)
  - ✅ 实现 `/play` `/stop` - 快捷命令

---

## 模块 E：MVU 变量系统增强

### E1. 额外模型解析
- ✅ E1.1 参考 `MagVarUpdate/src/main.ts`
  - ✅ 创建 `lib/mvu/extra-model.ts`
  - ✅ 实现 `ExtraModelParser` 类
  - ✅ 支持自定义解析模型配置
  - ✅ 实现解析结果验证和重试机制

### E2. 函数调用模式
- ✅ E2.1 实现 Tool Calling 支持
  - ✅ 创建 `lib/mvu/function-call.ts`
  - ✅ 定义 `MVU_VARIABLE_UPDATE_FUNCTION` schema
  - ✅ 实现 `FunctionCallManager` 管理器
  - ✅ 解析和执行 function_call 响应

### E3. JSON Patch 支持
- ✅ E3.1 实现 RFC 6902 JSON Patch
  - ✅ 创建 `lib/mvu/json-patch.ts`
  - ✅ 支持 add/remove/replace/move/copy/test 操作
  - ✅ 实现 JSON Pointer 解析
  - ✅ 实现 patch 验证和批量应用

### E4. 变量快照与恢复
- ✅ E4.1 创建 `lib/mvu/snapshot.ts`
  - ✅ 实现 `SnapshotManager` 管理器
  - ✅ 实现楼层变量保存/恢复
  - ✅ 支持快照对比 (`diffData`, `formatDiff`)

### E5. Schema 完善
- ✅ E5.1 增强 Schema 验证
  - ✅ 实现 `inferType` 类型推断
  - ✅ 实现 `validateValue` 值验证
  - ✅ 实现 `toJsonSchema`/`fromJsonSchema` 转换
  - ✅ Schema 调和（reconciliation）

### E6. 其他增强
- ✅ E6.1 数学表达式支持
  - ✅ 创建 `lib/mvu/math-eval.ts` (轻量实现)
  - ✅ 支持基础运算和常用函数
  - ✅ 实现 `replaceExpressions` 模板替换
- ✅ E6.2 自动清理机制
  - ✅ 创建 `lib/mvu/auto-cleanup.ts`
  - ✅ 实现 `AutoCleanupManager` 管理器
  - ✅ 可配置保留策略和清理间隔

---

## 模块 F：Extension Prompts 系统

### F1. 扩展提示词框架
- ✅ F1.1 创建 `lib/core/extension-prompts.ts`
  - ✅ 定义扩展注入点 (MEMORY, FLOATING_PROMPT, VECTORS, CHARACTER_NOTE)
  - ✅ 实现 `ExtensionPromptManager` 扩展注册机制
  - ✅ 实现 `buildInjections` 和 `injectIntoMessages` 集成方法

### F2. Author's Note 实现
- ✅ F2.1 实现 `2_floating_prompt`
  - ✅ 实现 `AuthorsNoteManager` 管理器
  - ✅ 支持深度注入配置
  - ✅ 支持动态内容 (宏替换)
- ✅ F2.2 实现 Memory/Summary 扩展
  - ✅ 实现 `MemoryManager` 管理器
  - ✅ 支持内容截断和追加

---

# 第三阶段：高级功能（预计 2-3 周）

## 模块 G：Vector Storage（向量存储）

### G1. 向量化基础
- ✅ G1.1 创建 `lib/vectors/embeddings.ts`
  - ✅ 实现 `EmbeddingManager` 管理器
  - ✅ 支持 OpenAI API 和本地词袋模型
  - ✅ 实现缓存和批量处理
  - ✅ 实现文本向量化
  - ✅ 实现批量向量化

### G2. 向量搜索
- ✅ G2.1 创建 `lib/vectors/search.ts`
  - ✅ 实现相似度计算
  - ✅ 实现 Top-K 检索
  - ✅ 支持过滤条件

### G3. 存储后端
- ✅ G3.1 创建 `lib/vectors/storage.ts`
  - ✅ 实现 IndexedDB 存储
  - ✅ 实现向量索引
  - ✅ 支持增量更新

### G4. 记忆检索
- ✅ G4.1 实现 `3_vectors` 扩展
  - ✅ 消息向量化和索引
  - ✅ 相关记忆检索
  - ✅ 注入到 prompt

---

## 模块 H：Summarize 扩展

### H1. 摘要生成
- ✅ H1.1 创建 `lib/extensions/summarize.ts`
  - ✅ 实现 `SummarizeManager` 摘要管理器
  - ✅ 支持增量摘要和摘要压缩
  - ✅ 创建 `lib/extensions/index.ts` 统一导出

### H2. 摘要管理
- ✅ H2.1 实现 `1_memory` 扩展
  - ✅ 实现 `MemoryStorageManager` 存储管理器
  - ✅ 支持摘要存储、加载和自动生成

---

## 模块 I：Token 预算管理

### I1. Token 计数
- ✅ I1.1 创建 `lib/core/token-counter.ts`
  - ✅ 集成 tiktoken 或兼容库
  - ✅ 支持多模型 tokenizer
  - ✅ 实现缓存优化

### I2. 预算分配
- ✅ I2.1 扩展 PromptManager
  - ✅ 实现上下文长度控制
  - ✅ 实现消息裁剪策略
  - ✅ 实现优先级裁剪
- ✅ J1.1 创建 `lib/streaming/tool-call-parser.ts`
  - ✅ 实现 `ToolCallParser` 流式解析器
  - ✅ 实现 `ToolCallExecutor` 工具执行器
  - ✅ 支持并行工具调用

### J2. Reasoning 提取
- ✅ J2.1 创建 `lib/streaming/reasoning-extractor.ts`
  - ✅ 实现 `ReasoningExtractor` 提取器
  - ✅ 支持 `<thinking>` 等多种标签
  - ✅ 实现流式和静态提取

### J3. 中断处理
- ✅ J3.1 创建 `lib/streaming/abort-controller.ts`
  - ✅ 实现 `GenerationAbortController` 中断控制器
  - ✅ 实现 `GlobalAbortManager` 全局管理器
  - ✅ 支持超时和用户主动停止

---

## 模块 K：多后端支持

### K1. Claude 后端
- ✅ K1.1 创建 `lib/api/claude.ts`
  - ✅ 实现 Claude API 适配
  - ✅ 支持 Claude 特有参数
  - ✅ 处理 Claude 响应格式

### K2. 本地模型后端
- ✅ K2.1 创建 `lib/api/local.ts`
  - ✅ 支持 Ollama
  - ✅ 支持 LM Studio
  - ✅ 支持 text-generation-webui

### K3. 后端抽象层
- ✅ K3.1 创建 `lib/api/backends.ts`
  - ✅ 统一后端接口 (`ApiClient`)
  - ✅ 自动后端检测 (`detectBackendType`)
  - ✅ 实现 `ApiManager` 多客户端管理

---

# 第四阶段：测试与文档（贯穿全程）

## 模块 L：测试

### L1. 单元测试
- ✅ L1.1 宏替换测试 (34/34 通过)
  - ✅ 基础宏测试
  - ✅ 变量宏测试
  - ✅ 边界情况测试
  - ✅ 修复了 {{trim}} 实现以匹配 SillyTavern
- ✅ L1.2 PromptManager 测试 (20/20 通过)
  - ✅ 排序测试
  - ✅ 注入位置测试 (RELATIVE/ABSOLUTE)
  - ✅ marker 替换测试
  - ✅ Generation Type 触发器测试
- ✅ L1.3 World Info 测试 (15/15 通过)
  - ✅ 关键词匹配测试
  - ✅ 深度注入测试
  - ✅ 时间效果测试
  - ✅ 互斥组测试
- ✅ L1.4 MVU 测试 (23/23 通过)
  - ✅ 命令解析测试
  - ✅ pathFix 测试 (对照 MagVarUpdate)
  - ⬜ Schema 验证测试

### L2. 集成测试
- ✅ L2.1 完整对话流程测试 (14/14 通过)
- ✅ L2.2 Preset 加载测试 (17/17 通过) - 使用明月秋青v3.94.json
- ✅ L2.3 事件系统测试 (15/15 通过)
- ✅ L2.4 Slash Command 测试 (已有 23 个测试)

### L3. 回归测试
- ✅ L3.1 现有功能验证 (20/20 通过)
- ✅ L3.2 性能基准测试 (包含在 L2.1)
- ✅ L3.3 向后兼容性测试 - 修复了宏大小写不敏感和旧版占位符

---

## 模块 M：文档

### M0. 文档清理
- ✅ 移动过时文档到 `docs/old/`
  - DIALOGUE_STORE_MIGRATION.md
  - RADIX_UI_MIGRATION.md
  - RADIX_UI_MIGRATION_ANALYSIS.md
  - ZUSTAND_MIGRATION.md
  - VIEW_STATE_REFACTOR.md
  - ui-nav-refactor-plan.md
  - ui-nav-refactor-tasklist.md

### M1. 开发文档
- ✅ M1.1 更新 `GETTING_STARTED.md`
- ✅ M1.2 创建 `PRESET_FORMAT.md`
- ✅ M1.3 创建 `MACRO_REFERENCE.md`
- ✅ M1.4 创建 `EVENT_SYSTEM.md`

### M2. API 文档
- ✅ M2.1 创建 `API_PROMPT_MANAGER.md`
- ✅ M2.2 创建 `API_MACRO_EVALUATOR.md`
- ⬜ M2.3 Slash Command 文档

### M3. 迁移指南
- ✅ M3.1 创建 `MIGRATION_GUIDE.md` - 包含旧版本迁移和 SillyTavern 导入

---

# 📊 里程碑总览

| 里程碑 | 模块 | 预计完成 |
|--------|------|----------|
| **M1: Preset 系统** | A1-A4 | ✅ 已完成 |
| **M2: 事件系统** | B1-B2 | ✅ 已完成 |
| **M3: World Info 增强** | C1-C4 | ✅ 已完成 |
| **M4: Slash Command 扩展** | D1-D7 | ✅ 已完成 |
| **M5: MVU 增强** | E1-E6 | ✅ 已完成 |
| **M6: Extension Prompts** | F1-F2 | ✅ 已完成 |
| **M7: Vector Storage** | G1-G4 | ✅ 已完成 |
| **M8: 高级功能** | H-K | ✅ 已完成 |
| **M9: 测试与文档** | L-M | 贯穿全程 |

---

# 🔗 依赖关系

```
A1 (类型定义)
 ├─→ A2 (宏替换引擎)
 │    └─→ A3 (PromptManager)
 │         └─→ A4 (Preset 迁移)
 │
 └─→ B1 (事件发射器)
      └─→ B2 (事件集成)
           └─→ D (Slash Command)
                └─→ E (MVU 增强)

C (World Info) ←─ 独立，可并行

F (Extension Prompts) ←─ 依赖 A3

G (Vector Storage) ←─ 独立，可并行

H (Summarize) ←─ 依赖 G

I (Token 预算) ←─ 依赖 A3

J (流式增强) ←─ 独立，可并行

K (多后端) ←─ 独立，可并行
```

---

# 📝 备注

1. **优先级原则**：核心功能优先，高级功能按需实现
2. **测试驱动**：每个模块完成后立即编写测试
3. **向后兼容**：保留旧接口，标记废弃，逐步迁移
4. **文档同步**：代码变更同步更新文档

---

*最后更新：2024-12-11*
*第一阶段核心模块 A1-A4, B1-B2, C1-C4 已完成*
*第二阶段 D1-D7 Slash Command 扩展已全部完成*
*第二阶段 E1-E6 MVU 增强已全部完成*
*第三阶段 F-K 高级功能已全部完成*
