# SillyTavern 核心功能整合分析报告

> **生成时间**: 2025-12-13
> **分析深度**: ultrathink 模式
> **覆盖范围**: SillyTavern 核心 + JS-Slash-Runner + MagVarUpdate

本报告基于对 DreamMiniStage 项目与 SillyTavern 生态系统的深度代码分析，提供架构对比、功能差距和改进路线图。

---

## 目录

1. [架构对比](#一架构对比)
2. [功能完成度矩阵](#二功能完成度矩阵)
3. [关键差距分析](#三关键差距分析)
4. [整合优先级路线图](#四整合优先级路线图)
5. [技术实现建议](#五技术实现建议)

---

## 一、架构对比

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SillyTavern 架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Express   │   │   script.js │   │  Endpoints  │   │   Plugins   │     │
│  │   Server    │◄──│   (11K行)   │──►│  (43个API)  │◄──│   System    │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│         │                 │                 │                 │             │
│         ▼                 ▼                 ▼                 ▼             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Event System (eventSource)                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                 │                 │                 │             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │PromptManager│   │ World-Info  │   │   Macros    │   │   Slash     │     │
│  │  (89K行)    │   │  (243K行)   │   │  (21K行)    │   │  Commands   │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        DreamMiniStage 架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │  Next.js    │   │  Nodeflow   │   │   Zustand   │   │  IndexedDB  │     │
│  │  App Router │◄──│   Engine    │──►│   Stores    │◄──│  Storage    │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│         │                 │                 │                 │             │
│         ▼                 ▼                 ▼                 ▼             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Event Emitter (lib/events/)                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                 │                 │                 │             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │STPromptMgr  │   │ WorldBook   │   │ STMacroEval │   │   Slash     │     │
│  │  (新实现)   │   │  Advanced   │   │   (新实现)  │   │  Commands   │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈对比

| 维度 | SillyTavern | DreamMiniStage | 评估 |
|------|-------------|----------------|------|
| **前端框架** | Vanilla JS + jQuery | React 19 + Next.js 15 | ✅ 更现代 |
| **后端** | Node.js + Express | Next.js API Routes | ✅ 统一技术栈 |
| **状态管理** | localStorage + 分散存储 | Zustand 集中管理 | ✅ 更清晰 |
| **持久化** | 文件系统 (JSONL/JSON) | IndexedDB | ⚠️ 需要导入/导出兼容 |
| **类型系统** | JSDoc 注释 | TypeScript 严格模式 | ✅ 更安全 |
| **测试** | 有限测试 | Vitest + 514 测试 | ✅ 更完善 |
| **构建** | Webpack | Next.js + SWC | ✅ 更快速 |

### 1.3 数据流对比

**SillyTavern 数据流**:
```
用户输入 → Generate() → PromptManager.render() → World Info 激活
    → Story String 构建 → 宏替换 → API 调用 → 流式响应 → 消息保存
```

**DreamMiniStage 数据流** (Nodeflow):
```
用户输入 → WorkflowEngine
    → ContextNode (提取上下文)
    → HistoryPreNode (历史预处理)
    → WorldBookNode (世界书激活)
    → PresetNode (预设应用)
    → LLMNode (API 调用)
    → RegexNode (后处理)
    → 消息保存
```

**架构优势**: DreamMiniStage 的 DAG 工作流引擎更清晰、更可扩展。

---

## 二、功能完成度矩阵

### 2.1 核心功能

| 功能领域 | SillyTavern | DreamMiniStage | 完成度 |
|----------|-------------|----------------|--------|
| **提示词管理** | PromptManager.js (89K行) | STPromptManager | ✅ 100% |
| **宏替换系统** | macros.js (21K行) | STMacroEvaluator | ✅ 100% |
| **World Info** | world-info.js (243K行) | world-book-advanced.ts | ✅ 100% |
| **事件系统** | eventSource | EventEmitter | ✅ 100% |
| **正则脚本** | regex extension | regex-processor.ts | ✅ 100% |
| **Slash 命令** | slash-commands (222K行) | slash-command/registry | ✅ 95% |
| **Token 管理** | tokenizers.js | token-manager.ts | ✅ 100% |
| **Preset 系统** | OpenAI presets | st-preset-types.ts | ✅ 100% |

### 2.2 扩展功能

| 功能领域 | SillyTavern | DreamMiniStage | 完成度 |
|----------|-------------|----------------|--------|
| **向量存储** | vectors extension | lib/vectors/ | ✅ 100% |
| **摘要系统** | memory extension | lib/extensions/summarize.ts | ✅ 100% |
| **流式响应** | sse-stream.js | lib/streaming/ | ✅ 100% |
| **脚本沙箱** | - | lib/script-runner/ | ✅ 100% |

### 2.3 插件功能

| 功能领域 | 原始插件 | DreamMiniStage | 完成度 |
|----------|----------|----------------|--------|
| **MVU 命令解析** | MagVarUpdate | lib/mvu/core/parser.ts | ✅ 100% |
| **MVU 额外模型** | MagVarUpdate | lib/mvu/extra-model.ts | ✅ 100% |
| **MVU 函数调用** | MagVarUpdate | lib/mvu/function-call.ts | ✅ 100% |
| **MVU JSON Patch** | MagVarUpdate | lib/mvu/json-patch.ts | ✅ 100% |
| **MVU 快照恢复** | MagVarUpdate | lib/mvu/snapshot.ts | ✅ 100% |
| **TavernHelper API** | JS-Slash-Runner | 部分整合 | ⚠️ 70% |
| **脚本按钮系统** | JS-Slash-Runner | - | ❌ 待实现 |
| **三层脚本存储** | JS-Slash-Runner | - | ❌ 待实现 |

---

## 三、关键差距分析

### 3.1 JS-Slash-Runner 差距 (高优先级)

**已实现**:
- 基础事件系统 (`lib/events/emitter.ts`)
- 消息 CRUD 命令
- 变量管理命令
- 脚本沙箱执行

**未实现/待完善**:

#### 3.1.1 TavernHelper 全局对象 (150+ API)

JS-Slash-Runner 暴露了一个强大的 `TavernHelper` 对象给脚本使用：

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║                   需要实现的 TavernHelper API                    ║
// ╚════════════════════════════════════════════════════════════════╝

// ── 生成相关 ──────────────────────────────────────────────────────
generate(config)          // 预设驱动生成
generateRaw(config)       // 原始 API 调用
stopGenerationById(id)    // 停止特定生成
stopAllGeneration()       // 停止所有生成

// ── 事件相关 ──────────────────────────────────────────────────────
eventOn(type, listener)        // 监听事件
eventEmit(type, ...data)       // 发送事件
eventOnce(type, listener)      // 一次性监听
eventMakeFirst(type, listener) // 优先执行
eventMakeLast(type, listener)  // 最后执行
eventClearAll()                // 清空当前脚本监听

// ── 变量相关 ──────────────────────────────────────────────────────
getVariables(options)              // 获取变量 (支持多层级)
replaceVariables(vars, options)    // 替换变量
getAllVariables()                  // 获取合并后的所有变量
registerVariableSchema(schema)     // 注册变量结构

// ── 脚本交互 ──────────────────────────────────────────────────────
getScriptButtons()            // 获取脚本按钮
replaceScriptButtons(buttons) // 替换按钮列表
getButtonEvent(buttonName)    // 获取按钮点击事件类型
getScriptInfo()               // 获取脚本信息
replaceScriptInfo(info)       // 替换脚本信息

// ── 预设与世界书 ──────────────────────────────────────────────────
getPreset(name?)                  // 获取预设
loadPreset(name)                  // 加载预设
getWorldbookNames()               // 获取世界书列表
createWorldbookEntries(entries)   // 创建条目
getLorebookEntries()              // 获取知识库条目

// ── 角色与聊天 ──────────────────────────────────────────────────
getCharData(name?)            // 获取角色数据
getChatHistoryDetail(name?)   // 获取聊天历史
triggerSlash(command)         // 执行斜杠命令
substitudeMacros(text)        // 替换宏
```

**实现建议**: 创建 `lib/script-runner/tavern-helper.ts`

#### 3.1.2 三层脚本存储

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║                      三层脚本存储架构                            ║
// ╚════════════════════════════════════════════════════════════════╝

interface ScriptStorage {
  // ── 全局脚本 ─────────────────────────────────────
  global: ScriptTree[];     // 所有对话通用

  // ── 预设脚本 ─────────────────────────────────────
  presets: {
    [presetName: string]: ScriptTree[];
  };

  // ── 角色卡脚本 ───────────────────────────────────
  characters: {
    [characterName: string]: ScriptTree[];
  };
}

interface Script {
  type: 'script';
  id: string;           // UUID
  name: string;
  content: string;      // JavaScript 源码
  enabled: boolean;
  button: {
    enabled: boolean;
    buttons: ScriptButton[];
  };
  data: Record<string, any>;  // 脚本自定义存储
}
```

**实现建议**: 扩展 `lib/data/roleplay/` 添加 `script-operation.ts`

#### 3.1.3 脚本按钮系统

脚本可以动态创建 UI 按钮并绑定事件：

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║                      脚本按钮交互系统                            ║
// ╚════════════════════════════════════════════════════════════════╝

// 脚本内部使用
const buttons = getScriptButtons();
replaceScriptButtons([
  { name: '开始游戏', visible: true },
  { name: '查看统计', visible: true },
]);

// 监听按钮点击
const btnEvent = getButtonEvent('开始游戏');
eventOn(btnEvent, () => {
  // 处理点击
});
```

**实现建议**: 创建 `components/ScriptButtonPanel.tsx`

### 3.2 SillyTavern 核心差距 (中优先级)

#### 3.2.1 群聊系统

SillyTavern 支持多角色群聊：

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║                        群聊系统数据结构                          ║
// ╚════════════════════════════════════════════════════════════════╝

interface Group {
  id: string;
  name: string;
  members: string[];              // 角色名列表
  allow_self_responses: boolean;
  activation_strategy: 0 | 1 | 2; // none/hotswap/queue
  generation_mode: 0 | 1;         // auto/manual
  disabled_members: string[];
  chat_metadata: Record<string, any>;
}
```

**实现建议**:
- 扩展 `lib/store/dialogue-store.ts` 支持群组对话
- 创建 `components/GroupChatPanel.tsx`

#### 3.2.2 Persona 系统

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║                       Persona 用户人格                          ║
// ╚════════════════════════════════════════════════════════════════╝

interface Persona {
  user_name: string;
  avatar: string;
  persona: string;      // 用户人格描述
  scenario: string;     // 当前场景
}
```

**实现建议**: 创建 `lib/data/roleplay/persona-operation.ts`

#### 3.2.3 多后端完整支持

| 后端 | 当前状态 | 需要的工作 |
|------|----------|-----------|
| OpenAI | ✅ 完整 | - |
| Gemini | ⚠️ 基础 | 完善消息格式转换 |
| Claude | ⚠️ 基础 | 完善 system 消息处理 |
| Ollama | ⚠️ 基础 | 添加模型列表 API |
| TextGen | ❌ 无 | 完整实现 |

**实现建议**: 扩展 `lib/api/backends.ts`

### 3.3 数据兼容性差距 (低优先级)

#### 3.3.1 角色卡 PNG 元数据

SillyTavern 将角色数据嵌入 PNG 图片的 tEXt 块：

```
PNG 文件
├── IHDR chunk
├── tEXt chunk: "chara" = base64(JSON)  ← 角色数据在这里
├── IDAT chunks (图像数据)
└── IEND chunk
```

**实现建议**: 创建 `lib/data/png-metadata.ts` 用于导入/导出

#### 3.3.2 聊天文件 JSONL 格式

```jsonl
{"user_name":"User","character_name":"Char","create_date":"2024-01-01"}
{"mes":"Hello!","is_user":true,"name":"User","send_date":"2024-01-01T10:00:00"}
{"mes":"Hi there!","is_user":false,"name":"Char","send_date":"2024-01-01T10:00:05"}
```

**实现建议**: 创建 `lib/data/import-export/` 目录

---

## 四、整合优先级路线图

### Phase 1: TavernHelper API (高优先级)

**目标**: 使现有 JS-Slash-Runner 脚本可以直接运行

**任务清单**:
```
□ 创建 lib/script-runner/tavern-helper.ts
  ├─ □ 实现 generate/generateRaw API
  ├─ □ 实现事件 API (eventOn/eventEmit/等)
  ├─ □ 实现变量 API (getVariables/replaceVariables/等)
  ├─ □ 实现预设 API (getPreset/loadPreset/等)
  └─ □ 实现世界书 API (getWorldbookNames/等)

□ 创建 lib/script-runner/script-storage.ts
  ├─ □ 实现三层脚本存储
  ├─ □ 实现脚本启用状态管理
  └─ □ 实现脚本数据持久化

□ 创建 components/ScriptButtonPanel.tsx
  ├─ □ 实现按钮动态渲染
  ├─ □ 实现按钮事件绑定
  └─ □ 实现按钮可见性控制
```

**预计工作量**: ~2000 行代码

### Phase 2: 群聊与 Persona (中优先级)

**目标**: 支持多角色对话和用户人格

**任务清单**:
```
□ 扩展 lib/store/dialogue-store.ts
  ├─ □ 添加群组对话支持
  ├─ □ 实现角色轮换策略
  └─ □ 实现成员管理

□ 创建 lib/data/roleplay/group-operation.ts
□ 创建 lib/data/roleplay/persona-operation.ts

□ 创建 components/GroupChatPanel.tsx
  ├─ □ 群组创建/编辑 UI
  ├─ □ 成员选择器
  └─ □ 轮换策略配置
```

**预计工作量**: ~1500 行代码

### Phase 3: 多后端完善 (中优先级)

**目标**: 完整支持主流 LLM 后端

**任务清单**:
```
□ 扩展 lib/api/backends.ts
  ├─ □ Claude API 完整支持
  │   ├─ □ system 消息处理
  │   ├─ □ 消息格式转换
  │   └─ □ 流式响应处理
  ├─ □ Gemini API 完善
  │   ├─ □ 多模态支持
  │   └─ □ 安全设置
  └─ □ TextGen API 实现
      ├─ □ 模型列表获取
      └─ □ 生成参数映射

□ 创建 lib/core/prompt/converters/
  ├─ □ claude.ts (已有基础)
  ├─ □ gemini.ts (已有基础)
  └─ □ textgen.ts (新增)
```

**预计工作量**: ~1000 行代码

### Phase 4: 数据兼容 (低优先级)

**目标**: 支持 SillyTavern 数据导入/导出

**任务清单**:
```
□ 创建 lib/data/import-export/
  ├─ □ png-metadata.ts (角色卡 PNG)
  ├─ □ jsonl-chat.ts (聊天文件)
  ├─ □ preset-converter.ts (预设格式)
  └─ □ worldbook-converter.ts (世界书格式)

□ 创建 components/ImportExportPanel.tsx
  ├─ □ 批量导入
  ├─ □ 批量导出
  └─ □ 格式选择
```

**预计工作量**: ~800 行代码

---

## 五、技术实现建议

### 5.1 TavernHelper 实现模式

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║              lib/script-runner/tavern-helper.ts                 ║
// ╚════════════════════════════════════════════════════════════════╝

import { eventEmitter } from '@/lib/events';
import { dialogueStore } from '@/lib/store/dialogue-store';

/**
 * TavernHelper 全局对象
 * 暴露给脚本沙箱使用的 API 集合
 */
export const createTavernHelper = (scriptContext: ScriptContext) => ({

  // ── 生成 API ─────────────────────────────────────────────────
  generate: async (config: GenerateConfig) => {
    // 委托给 LLMNode 或直接调用 API
  },

  generateRaw: async (config: GenerateRawConfig) => {
    // 绕过预设，直接构建 messages
  },

  // ── 事件 API ─────────────────────────────────────────────────
  eventOn: (type: string, listener: Function) => {
    const unsubscribe = eventEmitter.on(type, listener);
    scriptContext.cleanupFns.push(unsubscribe);
    return { stop: unsubscribe };
  },

  eventEmit: (type: string, ...data: any[]) => {
    eventEmitter.emit(type, ...data);
  },

  // ── 变量 API ─────────────────────────────────────────────────
  getVariables: (options?: VariableOptions) => {
    return getMvuVariables(options);
  },

  replaceVariables: (vars: Record<string, any>, options?: VariableOptions) => {
    return setMvuVariables(vars, options);
  },

  // ── 消息 API ─────────────────────────────────────────────────
  getChatMessages: (options?: { count?: number; fromEnd?: boolean }) => {
    const state = dialogueStore.getState();
    return state.getMessages(options);
  },

  createChatMessages: async (messages: ChatMessage[]) => {
    const state = dialogueStore.getState();
    for (const msg of messages) {
      await state.addMessage(msg);
    }
  },
});
```

### 5.2 脚本按钮系统

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║           components/ScriptButtonPanel.tsx                      ║
// ╚════════════════════════════════════════════════════════════════╝

interface ScriptButtonPanelProps {
  scriptId: string;
}

export function ScriptButtonPanel({ scriptId }: ScriptButtonPanelProps) {
  const buttons = useScriptButtons(scriptId);

  return (
    <div className="flex gap-2 flex-wrap">
      {buttons
        .filter(btn => btn.visible)
        .map(btn => (
          <Button
            key={btn.name}
            onClick={() => {
              eventEmitter.emit(`script_button_${scriptId}_${btn.name}`);
            }}
          >
            {btn.name}
          </Button>
        ))}
    </div>
  );
}
```

### 5.3 三层脚本存储

```typescript
// ╔════════════════════════════════════════════════════════════════╗
// ║         lib/script-runner/script-storage.ts                     ║
// ╚════════════════════════════════════════════════════════════════╝

interface ScriptStore {
  // ── 全局脚本 ─────────────────────────────────────
  global: Script[];

  // ── 预设脚本 (按预设名索引) ─────────────────────
  presets: Record<string, Script[]>;

  // ── 角色卡脚本 (按角色名索引) ───────────────────
  characters: Record<string, Script[]>;

  // ── 启用状态 ─────────────────────────────────────
  enabled: {
    global: Set<string>;        // 启用的全局脚本 ID
    presets: Set<string>;       // 启用脚本的预设名
    characters: Set<string>;    // 启用脚本的角色名
  };
}

/**
 * 获取当前对话应该执行的脚本列表
 * 合并顺序: 全局 → 当前预设 → 当前角色卡
 */
export function getActiveScripts(
  store: ScriptStore,
  currentPreset: string,
  currentCharacter: string
): Script[] {
  const scripts: Script[] = [];

  // 1. 全局脚本
  for (const script of store.global) {
    if (store.enabled.global.has(script.id)) {
      scripts.push(script);
    }
  }

  // 2. 当前预设的脚本
  if (store.enabled.presets.has(currentPreset)) {
    scripts.push(...(store.presets[currentPreset] || []));
  }

  // 3. 当前角色卡的脚本
  if (store.enabled.characters.has(currentCharacter)) {
    scripts.push(...(store.characters[currentCharacter] || []));
  }

  return scripts.filter(s => s.enabled);
}
```

---

## 六、总结

### 当前完成度

| 领域 | 完成度 | 说明 |
|------|--------|------|
| **核心功能** | 95% | 提示词、宏、世界书、事件、正则均已完成 |
| **MVU 系统** | 100% | 命令解析、额外模型、函数调用、快照均已完成 |
| **向量存储** | 100% | 嵌入、搜索、存储、检索均已完成 |
| **Slash 命令** | 95% | 50+ 命令，核心功能齐全 |
| **TavernHelper** | 70% | 基础 API 已有，需完善脚本交互 |
| **群聊/Persona** | 0% | 待实现 |
| **多后端** | 60% | OpenAI 完整，其他待完善 |

### 优先级建议

1. **最高**: TavernHelper API 完善 (使现有脚本可运行)
2. **高**: 脚本按钮系统 (用户交互核心)
3. **中**: 群聊系统 (扩展对话场景)
4. **中**: 多后端完善 (扩展用户群)
5. **低**: 数据导入导出 (兼容性)

### 架构优势

DreamMiniStage 相比 SillyTavern 有以下架构优势：

1. **Nodeflow DAG 引擎**: 更清晰的工作流，易于扩展和调试
2. **TypeScript 严格模式**: 类型安全，减少运行时错误
3. **Zustand 集中状态**: 状态管理清晰，调试友好
4. **React 19 + Next.js 15**: 现代化前端技术栈
5. **514 个测试用例**: 高测试覆盖率，重构更安全

这些优势为未来的功能扩展和维护打下了坚实基础。
