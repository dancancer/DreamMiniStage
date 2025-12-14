# 兼容性债务与遗留代码审查报告

> **审查日期**: 2025-12-13
> **审查范围**: 全代码库
> **审查方法**: 三层穿梭法（现象层 → 本质层 → 哲学层）

---

## 执行摘要

本项目经历了从 SillyTavern 单体架构到模块化 DialogueWorkflow 架构的大型重构。在此过程中，为了保持向后兼容性，代码库中积累了大量的兼容性妥协和分支代码。

**核心发现**：
- **50+ 个兼容性妥协点**分布在 7 个主要模块中
- **15+ 个废弃但未删除的模块/函数**
- **多处违反"好品味"原则**的特殊情况处理
- **数据格式不统一**导致的运行时转换开销

---

## 目录

1. [架构级问题](#一架构级问题)
2. [lib/core 核心模块](#二libcore-核心模块)
3. [lib/data 数据层](#三libdata-数据层)
4. [lib/nodeflow 工作流节点](#四libnodeflow-工作流节点)
5. [lib/mvu 状态管理](#五libmvu-状态管理)
6. [lib/store 和 hooks](#六libstore-和-hooks)
7. [function 服务端逻辑](#七function-服务端逻辑)
8. [lib/models 模型层](#八libmodels-模型层)
9. [清理优先级建议](#九清理优先级建议)
10. [代码坏味道评分](#十代码坏味道评分)

---

## 一、架构级问题

### 1.1 两条平行的数据流

```
新流：messages[] (结构化) → LLM 请求
旧流：systemMessage/userMessage (字符串) → UI 展示
```

**问题**：修改必须在两个地方进行，增加维护负担。

**涉及文件**：
- `lib/nodeflow/WorldBookNode/WorldBookNode.ts`
- `lib/nodeflow/ContextNode/ContextNode.ts`

### 1.2 占位符文本作为兼容机制

旧版 preset 使用 `{{chatHistory}}`、`{{worldInfoBefore}}` 等文本占位符，新系统使用 `marker: true` 标记插入位置。

**现状**：必须在运行时检测和转换旧格式。

### 1.3 缺乏统一的数据版本管理

多个独立的兼容层：
- `compatibility.ts` - Preset 兼容
- `normalizeRegexScript()` - Regex 脚本兼容
- `session-migration.ts` - 会话迁移
- `local-storage.ts` - IndexedDB 迁移

每一层都是独立的、无法协调的。

---

## 二、lib/core 核心模块

### 2.1 废弃模块：prompt-assembler.ts

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `lib/core/prompt-assembler.ts` | 1-10 | 整个类标记为 `@deprecated`，应删除 | 🔴 高 |

```typescript
/**
 * @deprecated 此模块已废弃，请使用 lib/core/prompt/manager.ts 中的 STPromptManager
 */
```

### 2.2 Legacy 占位符支持

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/core/st-macro-evaluator.ts` | 38-39, 71-80 | 同时支持 `{{...}}` 和 `<...>` 两种格式 |

```typescript
// 短路检查中的兼容处理
if (!content.includes("{{") && !content.includes("<")) {
  return content;
}

// 专门的 legacy 替换函数
private replaceLegacyPlaceholders(content: string, env: MacroEnv): string {
  return content
    .replace(/<USER>/gi, env.user || "")
    .replace(/<BOT>/gi, env.char || "")
    // ... 6 个专用的大小写不敏感正则替换
}
```

### 2.3 Preset 兼容性检测与转换层

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/core/prompt/compatibility.ts` | 1-211 | 完整的兼容层系统（211 行） |

**主要函数**：
- `isLegacyPreset()` - 检测旧版 preset
- `checkPresetCompatibility()` - 详细兼容性分析
- `applyCompatibilityLayer()` - 自动转换旧格式

### 2.4 向后兼容导出

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/core/prompt/index.ts` | 1-32 | 统一入口重导出，旧 `st-prompt-manager.ts` 已移除 |

```typescript
// 重导出所有内容，保持向后兼容
export { STPromptManager, createPromptManager, ... } from "./prompt";
```

### 2.5 Fallback 链

| 文件 | 行号 | 代码 |
|------|------|------|
| `st-macro-evaluator.ts` | 71-79 | `env.scenario \|\| env.chatHistory \|\| ""` |
| `prompt/post-processor.ts` | 240-314 | `DEFAULT_PLACEHOLDER = "Let's get started."` |

---

## 三、lib/data 数据层

### 3.1 IndexedDB 迁移层

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `lib/data/local-storage.ts` | 44-60 | `ARRAY_STORES` vs `RECORD_STORES` 二分法 | 🔴 高 |
| `lib/data/local-storage.ts` | 443-488 | `migrateLegacyArrays()` 迁移函数 | 🔴 高 |
| `lib/data/local-storage.ts` | 409-441 | 灵活键选择器（6 种不同的键字段） | 🟡 中 |

```typescript
// 特殊处理：原本以单对象承载所有数据的仓库
if ((storeName === WORLD_BOOK_FILE ||
     storeName === REGEX_SCRIPTS_FILE ||
     storeName === PRESET_FILE) &&
    first && typeof first === "object") {
  // ...
}

// 特殊处理：旧数据缺少 order 字段
if (storeName === CHARACTERS_RECORD_FILE && record && record.order === undefined) {
  record.order = timestamp ? Date.parse(timestamp) : Date.now();
}
```

### 3.2 Session 迁移层

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `lib/data/roleplay/session-migration.ts` | 1-116 | characterId → sessionId 架构迁移 | 🔴 高 |

**问题**：
- 对话树 ID 直接作为 Session ID（概念混淆）
- 使用 localStorage 标志位跟踪迁移状态（脆弱）

### 3.3 Preset 双通道排序

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/data/roleplay/preset-operation.ts` | 160-189 | 同时保留 `prompt_order` 和 `group_id/position` |
| `lib/data/roleplay/preset-operation.ts` | 200-274 | 两套并行的排序算法 |

### 3.4 Regex 脚本多格式

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/data/roleplay/regex-script-operation.ts` | 138-180 | 接受数组或对象两种格式 |
| `lib/data/roleplay/regex-script-operation.ts` | 388-399 | 扫描旧命名格式 `global_regex_*` |

---

## 四、lib/nodeflow 工作流节点

### 4.1 双重数据修改

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `WorldBookNode/WorldBookNode.ts` | 63-100 | 同时修改 `messages[]` 和字符串字段 | 🔴 高 |
| `WorldBookNode/WorldBookNodeTools.ts` | 86-251 | 两个方法做类似工作 | 🟡 中 |

### 4.2 Preset 兼容处理

| 文件 | 行号 | 问题 |
|------|------|------|
| `PresetNode/PresetNodeTools.ts` | 251-255, 333-337 | 两处重复的旧版检测 |
| `PresetNode/PresetNodeTools.ts` | 226-344 | 四层回退机制 |
| `PresetNode/PresetNodeTools.ts` | 279-313 | 用户 Preset → STOpenAIPreset 转换 |

### 4.3 LLM 类型条件链

| 文件 | 行号 | 问题 |
|------|------|------|
| `LLMNode/LLMNodeTools.ts` | 165-171 | messages-only vs 旧格式二元架构 |
| `LLMNode/LLMNodeTools.ts` | 179-184 | 强制 user 消息保证 |
| `LLMNode/LLMNodeTools.ts` | 249-310 | 5+ 个 LLM 类型条件分支 |
| `LLMNode/LLMNodeTools.ts` | 268-299 | Token usage 三种格式兼容 |

```typescript
if (aiMessage.usage_metadata) {
  // 新格式
} else if (aiMessage.response_metadata?.tokenUsage) {
  // 兼容旧版本格式
} else if (aiMessage.response_metadata?.usage) {
  // 兼容另一种格式
}
```

### 4.4 历史数据多态

| 文件 | 行号 | 问题 |
|------|------|------|
| `HistoryPreNode/HistoryPreNode.ts` | 54-73 | 三种历史数据格式同时存在 |

---

## 五、lib/mvu 状态管理

### 5.1 ValueWithDescription 类型

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `lib/mvu/types.ts` | 17-18 | 元组类型 `[value, description]` | 🟡 中 |
| `lib/mvu/core/executor.ts` | 81-93, 128-143 | 特殊处理逻辑 | 🟡 中 |

### 5.2 Schema 继承机制

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/mvu/core/schema.ts` | 27-62 | `oldSchema` 参数用于兼容 |
| `lib/mvu/core/schema.ts` | 287-320 | `cleanupMeta()` 清理旧格式 |

### 5.3 命令别名

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/mvu/core/parser.ts` | 254-265 | `remove/unset → delete`, `assign → insert` |

---

## 六、lib/store 和 hooks

### 6.1 SillyTavern 命令兼容

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/store/dialogue-store.ts` | 79-82 | `addUserMessage()` 兼容 `/send` 命令 |
| `lib/store/dialogue-store.ts` | 84-96, 498-634 | `triggerGeneration()` 兼容 `/trigger` 命令 |

### 6.2 三层回退链

| 文件 | 行号 | 代码 |
|------|------|------|
| `hooks/useCharacterDialogue.ts` | 54 | `dialogueKey \|\| sessionId \|\| characterId` |
| `hooks/useDialogueTreeData.ts` | 125-126 | 同样的回退链 |

### 6.3 多源头融合

| 文件 | 行号 | 问题 |
|------|------|------|
| `hooks/useRegexScripts.ts` | 142-220 | 三个来源的正则脚本融合 |

**三个来源**：
1. 角色级独立脚本
2. 预设的 `extensions.regex_scripts` 数组
3. Prompt 内容中嵌入的 `RegexBinding.regexes`

### 6.4 Script Bridge 兼容层

| 文件 | 行号 | 问题 |
|------|------|------|
| `script-bridge/lorebook-handlers.ts` | 148-176 | API 名称双份映射 |
| `script-bridge/mvu-handlers.ts` | 24-56 | 变量获取多层回退 |
| `script-bridge/variable-handlers.ts` | 33-72 | 变量作用域不对称处理 |

---

## 七、function 服务端逻辑

### 7.1 多格式导入

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `function/regex/import.ts` | 51-63 | 支持 4 种 JSON 格式 | 🔴 高 |
| `function/character/import.ts` | 25-50 | regex_scripts 数组/对象双格式 | 🟡 中 |
| `function/worldbook/import.ts` | 78-127 | 新旧字段名兼容 | 🟡 中 |

```typescript
// 支持 4 种不同的 JSON 格式
if (Array.isArray(jsonData)) {
  scriptEntries = jsonData;
} else if (jsonData.scripts && Array.isArray(jsonData.scripts)) {
  scriptEntries = jsonData.scripts;
} else if (jsonData.regexScripts && Array.isArray(jsonData.regexScripts)) {
  scriptEntries = jsonData.regexScripts;
} else if (typeof jsonData === "object" && !Array.isArray(jsonData) && jsonData.findRegex) {
  scriptEntries = [jsonData];
}
```

### 7.2 WorldBook 字段名兼容

```typescript
// 第一轮：旧字段名
if (entryData.key !== undefined) { keys = entryData.key; }
if (entryData.keysecondary !== undefined) { secondary_keys = entryData.keysecondary; }
if (entryData.disable !== undefined) { enabled = !entryData.disable; }

// 第二轮：新字段名（覆盖）
if (entryData.keys !== undefined) { keys = entryData.keys; }
if (entryData.secondary_keys !== undefined) { secondary_keys = entryData.secondary_keys; }
if (entryData.enabled !== undefined) { enabled = entryData.enabled; }
```

---

## 八、lib/models 模型层

### 8.1 废弃枚举

| 文件 | 行号 | 问题 |
|------|------|------|
| `lib/models/regex-script-model.ts` | 134-141 | `@deprecated RegexScriptOwnerType` |

### 8.2 规范化函数

| 文件 | 行号 | 问题 | 优先级 |
|------|------|------|--------|
| `lib/models/regex-script-model.ts` | 206-282 | `normalizeRegexScript()` 频繁调用 | 🔴 高 |

**处理内容**：
- `placement`: 单数字 → 数组
- `substituteRegex`: 数字 0/1 → 枚举
- 所有可选字段填充默认值

### 8.3 可选字段积累

| 模型 | 可选字段数 | Union Types |
|------|-----------|-------------|
| `RegexScript` | 11 | 1 (`replaceString?: string \| null`) |
| `WorldBookEntry` | 18 | 1 (`position: string \| number`) |
| `PresetPrompt` | 9 | 1 (`group_id?: string \| number`) |
| `Preset` | 5 | 0 |

### 8.4 TavernHelperScript 三种格式

```typescript
export type TavernHelperScript =
  | { type: "script"; value: TavernHelperScriptValue }  // 新格式
  | { name: string; content: string; enabled?: boolean }  // 旧格式
  | TavernHelperScriptValue;  // 直接值格式
```

---

## 九、清理优先级建议

### 🔴 第一优先级（立即处理）

| 任务 | 文件 | 预期收益 |
|------|------|---------|
| 删除废弃的 `prompt-assembler.ts` | `lib/core/prompt-assembler.ts` | 减少 80 行死代码 |
| 删除 legacy 占位符支持 | `st-macro-evaluator.ts` | 简化宏处理逻辑 |
| 统一 dialogueKey 处理 | 3+ 文件 | 消除三层回退 |
| 整合 4 种脚本导入格式 | `function/regex/import.ts` | 减少重复代码 |
| 修复 UI 层脚本规范化 | `MessageBubble.tsx` | 正确的分层 |

### 🟡 第二优先级（本月完成）

| 任务 | 文件 | 预期收益 |
|------|------|---------|
| 消除两条数据流 | WorldBookNode, ContextNode | 减少维护负担 |
| 统一 Token Usage 适配器 | `LLMNodeTools.ts` | 提高扩展性 |
| 分离 SillyTavern 兼容层 | `dialogue-store.ts` | 代码解耦 |
| 统一 preset 排序算法 | `preset-operation.ts` | 删除双通道 |

### 🟢 第三优先级（下季度）

| 任务 | 文件 | 预期收益 |
|------|------|---------|
| 建立数据版本管理系统 | 全局 | 迁移可控 |
| 消除 ValueWithDescription | `lib/mvu` | 简化执行器 |
| 设置 compatibility.ts 过期时间 | `lib/core/prompt/compatibility.ts` | 技术债务可见 |

---

## 十、代码坏味道评分

| 坏味道 | 严重程度 | 主要位置 |
|--------|---------|---------|
| **僵化 (Rigidity)** | ⭐⭐⭐⭐⭐ | `local-storage.ts` - 新增旧格式需改多处 |
| **冗余 (Redundancy)** | ⭐⭐⭐⭐ | 脚本规范化逻辑重复 20+ 处 |
| **脆弱性 (Fragility)** | ⭐⭐⭐⭐ | `session-migration.ts` - localStorage 标志位 |
| **晦涩性 (Obscurity)** | ⭐⭐⭐⭐ | 多处 5 层缩进的条件判断 |
| **循环依赖** | ⭐⭐⭐ | 旧代码和新代码互相引用 |
| **数据泥团** | ⭐⭐⭐ | WorldBookEntry 18 个可选字段 |
| **不必要的复杂性** | ⭐⭐⭐⭐ | 运行时检测而非导入时转换 |

---

## 附录：完整兼容性代码清单

### A. 废弃但未删除的代码

| 文件 | 标记 | 替代方案 |
|------|------|---------|
| `lib/core/prompt-assembler.ts` | `@deprecated` | `STPromptManager` |
| `lib/models/regex-script-model.ts:134` | `@deprecated` | `ScriptSource` |
| `app/character/page.tsx` | 整个路由废弃 | `/session` 路由 |

### B. 兼容性适配层

| 文件 | 职责 |
|------|------|
| `lib/core/prompt/compatibility.ts` | Preset 兼容检测与转换 |
| `lib/core/prompt/index.ts` | 模块迁移转接（统一导出入口） |
| `lib/data/roleplay/session-migration.ts` | 会话数据迁移 |
| `lib/data/local-storage.ts:443-488` | IndexedDB 数据迁移 |
| `script-bridge/lorebook-handlers.ts` | API 名称映射 |

### C. 运行时规范化函数

| 函数 | 文件 | 调用频率 |
|------|------|---------|
| `normalizeRegexScript()` | `regex-script-model.ts` | 极高（每次加载） |
| `isLegacyPreset()` | `compatibility.ts` | 高（每次使用 preset） |
| `applyCompatibilityLayer()` | `compatibility.ts` | 中（旧 preset 加载时） |
| `normalizeScriptInput()` | `regex/import.ts` | 低（仅导入时） |

---

## 结语

> **"好代码就是不需要例外的代码。"** — Linus Torvalds

当前代码库的核心问题不是"有兼容性代码"，而是"兼容性代码没有被集中在系统边界管理"。

**建议的改进方向**：

1. **建立统一的数据版本管理系统** - 替代当前散乱的兼容层
2. **在导入时完成一次性转换** - 而非运行时持续检测
3. **将兼容代码收束到明确的适配层** - 核心逻辑保持零妥协
4. **设立清理时间表** - 给废弃代码设置过期日期

这样做的好处是：业务代码变得更简洁，性能改善，技术债务清晰可见且可管理。
