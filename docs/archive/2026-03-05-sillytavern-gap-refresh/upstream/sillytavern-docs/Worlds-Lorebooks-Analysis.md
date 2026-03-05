# SillyTavern Worlds/Lorebooks 技术分析文档

## 目录

1. [概述](#概述)
2. [核心数据结构](#核心数据结构)
3. [Lorebook 来源类型](#lorebook-来源类型)
4. [工作流程](#工作流程)
5. [关键词匹配机制](#关键词匹配机制)
6. [高级特性](#高级特性)
7. [后端 API](#后端-api)
8. [实际使用示例](#实际使用示例)
9. [关键代码路径](#关键代码路径)
10. [全局激活设置](#全局激活设置)

---

## 概述

**Worlds/Lorebooks（世界信息/知识书）** 是 SillyTavern 的核心功能之一，用于**动态注入上下文信息到 AI 提示词中**。它允许用户定义关键词触发的条目，当聊天内容匹配这些关键词时，相关信息会自动添加到发送给 AI 的上下文中。

### 核心价值

- **动态上下文注入**：根据对话内容自动添加相关背景信息
- **世界观一致性**：确保 AI 回复符合预设的世界观设定
- **Token 效率**：只在需要时注入相关信息，避免浪费上下文空间
- **灵活配置**：支持多种触发条件、插入位置和激活逻辑

### 核心文件

| 文件路径 | 说明 |
|----------|------|
| `public/scripts/world-info.js` | 前端核心实现（约 6000 行） |
| `src/endpoints/worldinfo.js` | 后端 API 端点 |
| `public/script.js` | 主脚本，调用 World Info 生成提示词 |

---

## 核心数据结构

### World Info 文件结构

存储在 `src/endpoints/worldinfo.js` 中定义，文件格式为 JSON：

```json
{
  "entries": {
    "0": { /* entry object */ },
    "1": { /* entry object */ }
  }
}
```

文件存储位置：`<用户数据目录>/worlds/<文件名>.json`

### Entry（条目）结构

定义在 `public/scripts/world-info.js:3921-3964` 的 `newWorldInfoEntryDefinition`：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `uid` | number | - | 条目唯一标识符 |
| `key` | string[] | `[]` | **主关键词**，触发条目的关键词列表 |
| `keysecondary` | string[] | `[]` | **次关键词**，配合逻辑条件使用 |
| `content` | string | `""` | 注入到提示词的**实际内容** |
| `comment` | string | `""` | 条目备注/标题 |
| `constant` | boolean | `false` | 是否**始终激活**（无需关键词匹配） |
| `selective` | boolean | `true` | 是否使用选择性逻辑 |
| `selectiveLogic` | enum | `0` | 次关键词逻辑 |
| `position` | enum | `0` | 插入位置 |
| `order` | number | `100` | 排序优先级（越高越先处理） |
| `depth` | number | `4` | 插入深度（消息位置） |
| `disable` | boolean | `false` | 是否禁用 |
| `probability` | number | `100` | 激活概率（0-100%） |
| `useProbability` | boolean | `true` | 是否使用概率检查 |
| `sticky` | number | `null` | 粘性效果（激活后持续 N 条消息） |
| `cooldown` | number | `null` | 冷却时间（激活后 N 条消息内不再激活） |
| `delay` | number | `null` | 延迟激活（聊天 N 条消息后才能激活） |
| `group` | string | `""` | 互斥组（同组只激活一个） |
| `groupWeight` | number | `100` | 组内权重（用于随机选择） |
| `groupOverride` | boolean | `false` | 组内优先级覆盖 |
| `characterFilter` | object | - | 角色过滤器（限制特定角色使用） |
| `scanDepth` | number | `null` | 自定义扫描深度 |
| `caseSensitive` | boolean | `null` | 大小写敏感 |
| `matchWholeWords` | boolean | `null` | 全词匹配 |
| `excludeRecursion` | boolean | `false` | 排除递归扫描 |
| `preventRecursion` | boolean | `false` | 阻止触发递归 |
| `delayUntilRecursion` | number | `0` | 延迟到递归时激活 |
| `role` | enum | `0` | 消息角色（system/user/assistant） |
| `triggers` | string[] | `[]` | 生成类型触发器 |

### 次关键词逻辑（selectiveLogic）

```javascript
world_info_logic = {
    AND_ANY: 0,   // 主关键词 AND 任意次关键词
    NOT_ALL: 1,   // 主关键词 AND 非全部次关键词
    NOT_ANY: 2,   // 主关键词 AND 无任何次关键词
    AND_ALL: 3,   // 主关键词 AND 全部次关键词
}
```

### 插入位置（position）

```javascript
world_info_position = {
    before: 0,    // 角色描述之前
    after: 1,     // 角色描述之后
    ANTop: 2,     // Author's Note 之前
    ANBottom: 3,  // Author's Note 之后
    atDepth: 4,   // 指定深度位置
    EMTop: 5,     // 示例消息顶部
    EMBottom: 6,  // 示例消息底部
    outlet: 7,    // 自定义出口
}
```

---

## Lorebook 来源类型

系统支持 **4 种来源** 的 Lorebook，按优先级排序：

| 优先级 | 来源类型 | 获取函数 | 说明 |
|--------|----------|----------|------|
| 1 | Chat Lore | `getChatLore()` | 绑定到特定聊天的知识书 |
| 2 | Persona Lore | `getPersonaLore()` | 绑定到用户人设的知识书 |
| 3 | Character Lore | `getCharacterLore()` | 绑定到角色的知识书（主要+附加） |
| 4 | Global Lore | `getGlobalLore()` | 全局激活的知识书 |

### 条目合并策略

```javascript
world_info_insertion_strategy = {
    evenly: 0,           // 均匀混合排序
    character_first: 1,  // 角色优先
    global_first: 2,     // 全局优先
}
```

最终排序：`Chat Lore > Persona Lore > (Character/Global Lore 按策略排序)`

---

## 工作流程

### 整体流程图

```
用户发送消息
    ↓
Generate() 函数 (script.js)
    ↓
准备 chatForWI (聊天消息倒序)
    ↓
getWorldInfoPrompt() (world-info.js:853)
    ↓
checkWorldInfo() (world-info.js:4428)
    ├── getSortedEntries() - 获取所有来源的条目
    ├── WorldInfoBuffer.matchKeys() - 关键词匹配
    ├── 检查 constant/sticky/概率等条件
    └── 按位置分类输出
    ↓
返回 { worldInfoBefore, worldInfoAfter, worldInfoDepth, ... }
    ↓
renderStoryString() - 组合最终提示词
    ↓
发送给 AI 生成回复
```

### 详细扫描流程

`checkWorldInfo()` 函数（`world-info.js:4428-4953`）的核心逻辑：

```
1. 初始化
   ├── 创建 WorldInfoBuffer（聊天消息缓冲区）
   ├── 计算 Token 预算
   └── 获取所有排序后的条目 getSortedEntries()

2. 循环扫描（支持递归）
   ├── 遍历每个条目
   │   ├── 检查禁用状态
   │   ├── 检查生成类型触发器
   │   ├── 检查角色过滤器
   │   ├── 检查时间效果（sticky/cooldown/delay）
   │   ├── 检查装饰器（@@activate/@@dont_activate）
   │   ├── 检查 constant 标志
   │   ├── 匹配主关键词
   │   └── 匹配次关键词（按逻辑）
   ├── 处理互斥组（inclusion groups）
   ├── 执行概率检查
   ├── 检查 Token 预算
   └── 决定是否继续递归

3. 构建输出
   ├── 按位置分类条目
   ├── 设置时间效果
   └── 返回激活的条目内容
```

---

## 关键词匹配机制

### WorldInfoBuffer 类

`WorldInfoBuffer` 类（`world-info.js:199-475`）负责管理扫描缓冲区：

```javascript
class WorldInfoBuffer {
    #depthBuffer = [];      // 按深度存储的消息
    #recurseBuffer = [];    // 递归扫描添加的内容
    #injectBuffer = [];     // 注入的提示内容
    #globalScanData = null; // 全局扫描数据（角色描述等）
    
    get(entry, scanState)           // 获取扫描文本
    matchKeys(haystack, needle, entry)  // 关键词匹配
    addRecurse(message)             // 添加递归内容
    getScore(entry, scanState)      // 计算匹配分数
}
```

### 匹配方式

`matchKeys()` 方法支持三种匹配方式：

1. **普通文本匹配**
   - 大小写敏感/不敏感（由 `caseSensitive` 控制）
   - 包含匹配

2. **全词匹配**（`matchWholeWords: true`）
   - 使用正则表达式确保匹配完整单词
   - 避免部分匹配（如 "cat" 不匹配 "category"）

3. **正则表达式**
   - 格式：`/pattern/flags`
   - 示例：`/dragon?s?/i` 匹配 "dragon", "dragons"

```javascript
matchKeys(haystack, needle, entry) {
    // 正则表达式匹配
    const keyRegex = parseRegexFromString(needle);
    if (keyRegex) {
        return keyRegex.test(haystack);
    }
    
    // 全词匹配
    if (matchWholeWords) {
        const regex = new RegExp(`(?:^|\\W)(${escapeRegex(needle)})(?:$|\\W)`);
        return regex.test(haystack);
    }
    
    // 普通包含匹配
    return haystack.includes(needle);
}
```

---

## 高级特性

### 递归扫描

当 `world_info_recursive = true` 时：

1. 已激活条目的内容会加入扫描缓冲区
2. 可能触发更多条目（链式激活）
3. 受 `world_info_max_recursion_steps` 限制

相关字段：
- `excludeRecursion`: 排除此条目参与递归扫描
- `preventRecursion`: 此条目激活后不触发递归
- `delayUntilRecursion`: 延迟到第 N 次递归时才能激活

### 时间效果

由 `WorldInfoTimedEffects` 类管理（`world-info.js:480-795`）：

| 效果 | 字段 | 说明 |
|------|------|------|
| **Sticky** | `sticky` | 激活后持续 N 条消息保持激活 |
| **Cooldown** | `cooldown` | 激活后冷却 N 条消息不能再次激活 |
| **Delay** | `delay` | 聊天 N 条消息后才能激活 |

时间效果存储在 `chat_metadata.timedWorldInfo` 中。

### 互斥组（Inclusion Groups）

同一组内的条目只会激活一个：

1. **优先级覆盖**（`groupOverride: true`）：优先级最高的条目获胜
2. **权重随机**（`groupWeight`）：按权重随机选择
3. **分数竞争**（`useGroupScoring`）：关键词匹配分数最高的获胜

### Token 预算控制

```javascript
// 预算计算
let budget = Math.round(world_info_budget * maxContext / 100) || 1;

// 预算上限
if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
    budget = world_info_budget_cap;
}
```

- `world_info_budget`: 占最大上下文的百分比
- `world_info_budget_cap`: 绝对 Token 上限
- `ignoreBudget`: 条目可设置忽略预算限制

### 装饰器

条目内容可以使用装饰器：

- `@@activate`: 强制激活此条目
- `@@dont_activate`: 强制不激活此条目
- `@@@decorator`: 转义装饰器（保留在内容中）

---

## 后端 API

`src/endpoints/worldinfo.js` 提供以下端点：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/worldinfo/get` | POST | 获取世界信息文件 |
| `/api/worldinfo/edit` | POST | 保存/编辑世界信息 |
| `/api/worldinfo/delete` | POST | 删除世界信息文件 |
| `/api/worldinfo/import` | POST | 导入世界信息文件 |

### 文件读取示例

```javascript
export function readWorldInfoFile(directories, worldInfoName, allowDummy) {
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(directories.worlds, filename);
    
    if (!fs.existsSync(pathToWorldInfo)) {
        return allowDummy ? { entries: {} } : null;
    }
    
    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    return JSON.parse(worldInfoText);
}
```

---

## 实际使用示例

### 场景设定

用户正在与名为 **"Seraphina"** 的奇幻角色聊天，配置了以下 Lorebook：

#### Lorebook 文件：`Fantasy World.json`

```json
{
  "entries": {
    "0": {
      "uid": 0,
      "key": ["魔法", "magic", "法术"],
      "content": "在这个世界中，魔法由五种元素构成：火、水、风、土、光。只有经过魔法学院训练的人才能使用魔法。",
      "constant": false,
      "position": 0,
      "order": 100
    },
    "1": {
      "uid": 1,
      "key": ["龙", "dragon", "巨龙"],
      "content": "龙是这个世界最强大的生物，它们居住在北方的冰雪山脉。龙能活数千年，拥有古老的智慧。",
      "constant": false,
      "position": 0,
      "order": 90
    },
    "2": {
      "uid": 2,
      "key": ["Seraphina"],
      "content": "Seraphina 是光明魔法学院的毕业生，擅长治愈和防护魔法。她曾经见过一条银色的龙。",
      "constant": true,
      "position": 0,
      "order": 200
    }
  }
}
```

### 聊天历史

```
用户: 你好，Seraphina！
Seraphina: 你好，旅行者！很高兴见到你。
用户: 你能告诉我关于龙的事情吗？我听说北方有巨龙出没。
```

### 执行流程

#### Step 1: 准备扫描数据

```javascript
// script.js:4233-4244
const chatForWI = coreChat.map(x => 
    world_info_include_names ? `${x.name}: ${x.mes}` : x.mes
).reverse();

// chatForWI 内容:
// [
//   "用户: 你能告诉我关于龙的事情吗？我听说北方有巨龙出没。",
//   "Seraphina: 你好，旅行者！很高兴见到你。",
//   "用户: 你好，Seraphina！"
// ]
```

#### Step 2: 扫描条目

```
扫描深度: 2 (默认检查最近2条消息)
扫描文本: "用户: 你能告诉我关于龙的事情吗？我听说北方有巨龙出没。
          Seraphina: 你好，旅行者！很高兴见到你。"
```

**条目匹配结果：**

| UID | 关键词 | 匹配结果 | 原因 |
|-----|--------|----------|------|
| 0 | `魔法, magic, 法术` | ❌ 不激活 | 聊天中没有提到魔法 |
| 1 | `龙, dragon, 巨龙` | ✅ 激活 | 用户消息包含 "龙" 和 "巨龙" |
| 2 | `Seraphina` | ✅ 激活 | `constant: true`，始终激活 |

#### Step 3: 构建输出

激活的条目按 `order` 排序后组合：

```javascript
// order: 200 (Seraphina) > 90 (龙)
worldInfoBefore = `Seraphina 是光明魔法学院的毕业生，擅长治愈和防护魔法。她曾经见过一条银色的龙。
龙是这个世界最强大的生物，它们居住在北方的冰雪山脉。龙能活数千年，拥有古老的智慧。`;
```

#### Step 4: 注入到最终提示词

```javascript
// script.js:4312-4331
const storyStringParams = {
    description: description,
    personality: personality,
    wiBefore: worldInfoBefore,  // ← World Info 注入
    wiAfter: worldInfoAfter,
    // ...
};

const storyString = renderStoryString(storyStringParams);
```

### 最终提示词结构

```
┌─────────────────────────────────────────────────────────────┐
│ [System Prompt]                                              │
├─────────────────────────────────────────────────────────────┤
│ [World Info Before] ← 激活的 Lorebook 条目                   │
│ • Seraphina 是光明魔法学院的毕业生...                        │
│ • 龙是这个世界最强大的生物...                                │
├─────────────────────────────────────────────────────────────┤
│ [Character Description]                                      │
│ Seraphina 是一位温柔的精灵治愈师...                          │
├─────────────────────────────────────────────────────────────┤
│ [Character Personality]                                      │
│ 善良、耐心、充满智慧...                                      │
├─────────────────────────────────────────────────────────────┤
│ [World Info After]                                           │
├─────────────────────────────────────────────────────────────┤
│ [Chat History]                                               │
│ 用户: 你好，Seraphina！                                      │
│ Seraphina: 你好，旅行者！很高兴见到你。                      │
│ 用户: 你能告诉我关于龙的事情吗？我听说北方有巨龙出没。       │
├─────────────────────────────────────────────────────────────┤
│ [Seraphina:]  ← AI 从这里开始生成回复                        │
└─────────────────────────────────────────────────────────────┘
```

### AI 生成的回复

由于提示词中包含了龙的背景知识，AI 可以生成更加符合世界观的回复：

> **Seraphina:** *眼中闪过一丝回忆* 北方的冰雪山脉确实是龙族的领地。我曾经在那里见过一条银色的巨龙，它的鳞片在阳光下闪耀如星辰。龙是古老而智慧的生物，能活数千年。如果你想去那里，一定要小心——它们虽然智慧，但也非常危险。

---

## 关键代码路径

### 主要函数调用链

```
Generate() [script.js]
    │
    ├── getWorldInfoPrompt() [world-info.js:853]
    │       │
    │       └── checkWorldInfo() [world-info.js:4428]
    │               │
    │               ├── getSortedEntries() [world-info.js:4306]
    │               │       ├── getGlobalLore()
    │               │       ├── getCharacterLore()
    │               │       ├── getChatLore()
    │               │       └── getPersonaLore()
    │               │
    │               ├── WorldInfoBuffer.get()
    │               ├── WorldInfoBuffer.matchKeys()
    │               ├── filterByInclusionGroups()
    │               └── WorldInfoTimedEffects.setTimedEffects()
    │
    ├── renderStoryString() [script.js]
    │
    └── 发送到 AI API
```

### 核心类

| 类名 | 文件位置 | 职责 |
|------|----------|------|
| `WorldInfoBuffer` | world-info.js:199 | 管理扫描缓冲区和关键词匹配 |
| `WorldInfoTimedEffects` | world-info.js:480 | 管理时间效果（sticky/cooldown/delay） |
| `FilterHelper` | filters.js | 条目过滤和搜索 |

### 导出函数

```javascript
// 主要导出
export async function getWorldInfoPrompt(chat, maxContext, isDryRun, globalScanData)
export async function checkWorldInfo(chat, maxContext, isDryRun, globalScanData)
export async function getSortedEntries()
export async function loadWorldInfo(name)
export async function saveWorldInfo(name, data, immediately)
export function createWorldInfoEntry(_name, data)
export async function deleteWorldInfo(worldInfoName)
```

---

## 全局激活设置

Global World Info/Lorebook Activation Settings 是**全局激活设置**，控制 World Info 扫描和激活的行为。定义在 `public/scripts/world-info.js:69-82`。

### 设置项一览

| 设置 | 变量名 | 默认值 | 作用 |
|------|--------|--------|------|
| **Scan Depth** | `world_info_depth` | 2 | 扫描最近多少条聊天消息来匹配关键词 |
| **Context %** | `world_info_budget` | 25 | World Info 占最大上下文的百分比预算 |
| **Budget Cap** | `world_info_budget_cap` | 0 | Token 绝对上限（0 表示无上限） |
| **Min Activations** | `world_info_min_activations` | 0 | 最少激活条目数（会扩展扫描深度直到满足） |
| **Max Depth** | `world_info_min_activations_depth_max` | 0 | Min Activations 模式下的最大扫描深度 |
| **Max Recursion Steps** | `world_info_max_recursion_steps` | 0 | 递归扫描的最大步数 |
| **Include Names** | `world_info_include_names` | true | 扫描时是否包含角色名称 |
| **Recursive Scan** | `world_info_recursive` | false | 是否启用递归扫描 |
| **Case Sensitive** | `world_info_case_sensitive` | false | 关键词匹配是否大小写敏感 |
| **Match Whole Words** | `world_info_match_whole_words` | false | 是否只匹配完整单词 |
| **Use Group Scoring** | `world_info_use_group_scoring` | false | 互斥组是否使用分数竞争 |
| **Overflow Alert** | `world_info_overflow_alert` | false | 预算超出时是否显示警告 |
| **Insertion Strategy** | `world_info_character_strategy` | 1 | 角色/全局条目的插入顺序策略 |

### 详细说明

#### 1. Scan Depth（扫描深度）

扫描最近 N 条消息来匹配关键词。

- 值越大，扫描的历史消息越多
- 但也会消耗更多处理时间
- 例如：`depth=2` 只检查最近 2 条消息

#### 2. Context % / Budget Cap（Token 预算）

```javascript
let budget = Math.round(world_info_budget * maxContext / 100);
if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
    budget = world_info_budget_cap;
}
```

- **Context %**：World Info 最多占用上下文的百分比
- **Budget Cap**：绝对 Token 上限，防止占用过多
- 超出预算后，低优先级条目会被跳过

#### 3. Min Activations（最少激活数）

确保至少激活 N 个条目。

- 如果当前深度激活的条目不够，会自动扩展扫描深度
- 与 `Max Recursion Steps` 互斥（不能同时使用）

#### 4. Recursive Scan（递归扫描）

已激活条目的内容也会被扫描，可能触发更多条目。

- 例如：条目 A 的内容提到 "龙"，可能触发关于龙的条目 B
- `Max Recursion Steps` 限制递归次数，防止无限循环

#### 5. Include Names（包含名称）

```javascript
const chatForWI = coreChat.map(x => 
    world_info_include_names ? `${x.name}: ${x.mes}` : x.mes
).reverse();
```

- **开启**：扫描 `"用户: 你好"` 格式
- **关闭**：只扫描 `"你好"` 消息内容

#### 6. Case Sensitive / Match Whole Words

- **Case Sensitive**：`"Dragon"` 和 `"dragon"` 是否视为相同
- **Match Whole Words**：`"cat"` 是否匹配 `"category"`（关闭时会匹配）

#### 7. Insertion Strategy（插入策略）

```javascript
world_info_insertion_strategy = {
    evenly: 0,           // 均匀混合排序
    character_first: 1,  // 角色 Lorebook 优先
    global_first: 2,     // 全局 Lorebook 优先
}
```

决定角色绑定的 Lorebook 和全局 Lorebook 的优先顺序。

### 使用场景示例

#### 场景 1：简单对话

```
Scan Depth: 2
Context %: 25
Recursive: false
```

只检查最近 2 条消息，简单快速。

#### 场景 2：复杂世界观

```
Scan Depth: 10
Context %: 40
Recursive: true
Max Recursion Steps: 3
```

深度扫描，启用递归，适合复杂的世界观设定。

#### 场景 3：精确匹配

```
Case Sensitive: true
Match Whole Words: true
```

避免误触发，只匹配精确的关键词。

### 设置分类总结

这些设置控制 **"如何扫描聊天历史"** 和 **"如何选择激活哪些条目"**：

| 分类 | 相关设置 |
|------|----------|
| **扫描范围** | Scan Depth, Include Names |
| **匹配方式** | Case Sensitive, Match Whole Words |
| **预算控制** | Context %, Budget Cap |
| **激活逻辑** | Min Activations, Recursive Scan, Max Recursion Steps |
| **排序策略** | Insertion Strategy, Use Group Scoring |

---

## 总结

Worlds/Lorebooks 是一个**基于关键词触发的动态上下文注入系统**：

1. **用户预定义条目**：设置关键词和对应内容
2. **生成时扫描**：检查聊天历史是否匹配关键词
3. **动态注入**：匹配的条目内容按配置位置注入到最终提示词
4. **智能控制**：支持复杂的激活逻辑、时间效果和预算控制

这个系统使得 AI 能够在需要时获得相关的世界观信息，从而生成更加一致和丰富的回复。
