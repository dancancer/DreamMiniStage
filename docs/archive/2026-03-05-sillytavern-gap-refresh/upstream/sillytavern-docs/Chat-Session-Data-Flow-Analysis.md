# SillyTavern 完整会话数据流转分析

本文档详细分析 SillyTavern 中一次完整会话的数据流转过程，从用户输入到最终形成发给 LLM 的提示词。

---

## 目录

1. [整体架构概览](#整体架构概览)
2. [核心数据流程图](#核心数据流程图)
3. [详细流程分析](#详细流程分析)
4. [数据源详解](#数据源详解)
5. [提示词构建机制](#提示词构建机制)
6. [完整示例](#完整示例)
7. [关键代码路径](#关键代码路径)

---

## 整体架构概览

SillyTavern 的会话系统涉及多个核心模块协同工作：

| 模块 | 文件位置 | 职责 |
|------|----------|------|
| **主脚本** | `public/script.js` | 入口函数 `Generate()`，协调整体流程 |
| **OpenAI 处理** | `public/scripts/openai.js` | Chat Completion API 的消息组装 |
| **Prompt Manager** | `public/scripts/PromptManager.js` | 系统提示词管理和排序 |
| **World Info** | `public/scripts/world-info.js` | 动态上下文注入（Lorebook） |
| **Vector Storage** | `public/scripts/extensions/vectors/` | 语义搜索和长期记忆 |
| **Power User** | `public/scripts/power-user.js` | Story String 渲染 |

---

## 核心数据流程图

### 总体流程（文本版）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [用户点击发送按钮] ──→ [获取输入框文本] ──→ [触发 Generate() 函数]           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           预处理阶段                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 处理斜杠命令 (processCommands)                                           │
│  2. 发送用户消息到聊天 (sendMessageAsUser)                                   │
│  3. 获取角色卡字段 (getCharacterCardFields)                                  │
│     - description, personality, scenario, mesExamples                       │
│  4. 触发 GENERATION_STARTED 事件                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         上下文收集阶段                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   聊天历史       │  │   World Info    │  │  扩展提示词      │              │
│  │   (coreChat)    │  │   (Lorebook)    │  │  (Extensions)   │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│           ▼                    ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    getWorldInfoPrompt()                              │    │
│  │  - 扫描聊天历史匹配关键词                                             │    │
│  │  - 激活相关 Lorebook 条目                                            │    │
│  │  - 返回 worldInfoBefore, worldInfoAfter, worldInfoDepth              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Vector Storage (可选)                             │    │
│  │  - rearrangeChat() 拦截器                                            │    │
│  │  - 向量相似度查询相关历史                                             │    │
│  │  - 注入相关记忆到 extension_prompts                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Story String 构建                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  renderStoryString({                                                         │
│      description,      // 角色描述                                           │
│      personality,      // 角色性格                                           │
│      persona,          // 用户人设                                           │
│      scenario,         // 场景设定                                           │
│      wiBefore,         // World Info (角色描述前)                            │
│      wiAfter,          // World Info (角色描述后)                            │
│      mesExamples,      // 示例对话                                           │
│      system,           // 系统提示词                                         │
│  })                                                                          │
│                                    │                                         │
│                                    ▼                                         │
│  使用 Handlebars 模板引擎渲染 Story String                                   │
│  应用 substituteParams() 替换宏变量 ({{char}}, {{user}} 等)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API 特定处理 (OpenAI vs Text Completion)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │
│  │      OpenAI (Chat API)      │    │   Text Completion APIs      │         │
│  ├─────────────────────────────┤    ├─────────────────────────────┤         │
│  │ prepareOpenAIMessages()     │    │ getCombinedPrompt()         │         │
│  │     │                       │    │     │                       │         │
│  │     ▼                       │    │     ▼                       │         │
│  │ PromptManager.render()      │    │ 拼接所有字符串:              │         │
│  │     │                       │    │ - storyString               │         │
│  │     ▼                       │    │ - mesExamples               │         │
│  │ populateChatCompletion()    │    │ - chatHistory               │         │
│  │     │                       │    │ - extensionPrompts          │         │
│  │     ▼                       │    │     │                       │         │
│  │ 构建 messages[] 数组        │    │     ▼                       │         │
│  │ [{role, content, name}]     │    │ 单一文本 prompt              │         │
│  └─────────────────────────────┘    └─────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           请求发送阶段                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 触发 GENERATE_AFTER_COMBINE_PROMPTS 事件                                 │
│  2. 附加采样参数 (temperature, top_p, max_tokens 等)                         │
│  3. 附加停止字符串 (stopping_strings)                                        │
│  4. 发送请求:                                                                │
│     - OpenAI: POST /api/backends/chat-completions/send                       │
│     - Kobold: POST /api/backends/kobold/generate                             │
│     - TextGen: POST /api/backends/text-completions/generate                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           响应处理阶段                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 流式/非流式接收响应                                                      │
│  2. cleanUpMessage() 清理响应文本                                            │
│  3. 处理工具调用 (Tool Calls) 如有                                           │
│  4. saveReply() 保存到聊天历史                                               │
│  5. 触发 MESSAGE_RECEIVED 事件                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 详细流程分析

### 阶段 1: 入口与初始化

当用户点击发送按钮时，触发 `Generate()` 函数：

```javascript
// public/script.js:3904
export async function Generate(type, options, dryRun = false) {
    // type: 'normal', 'continue', 'swipe', 'impersonate', 'quiet', 'regenerate'
    
    // 1. 触发生成开始事件
    await eventSource.emit(event_types.GENERATION_STARTED, type, options, dryRun);
    
    // 2. 处理斜杠命令
    const interruptedByCommand = await processCommands(textareaText);
    
    // 3. 发送用户消息
    await sendMessageAsUser(textareaText, messageBias);
    
    // 4. 获取角色卡字段
    const { description, personality, persona, scenario, mesExamples, ... } = getCharacterCardFields();
}
```

### 阶段 2: 聊天历史处理

```javascript
// 过滤系统消息，保留有效聊天内容
let coreChat = chat.filter(x => !x.is_system || (canUseTools && x.extra?.tool_invocations));

// 应用正则表达式处理
coreChat = await Promise.all(coreChat.map(async (chatItem, index) => {
    let regexedMessage = getRegexedString(message, regexType, options);
    regexedMessage = await appendFileContent(chatItem, regexedMessage);
    return { ...chatItem, mes: regexedMessage };
}));
```

### 阶段 3: World Info 扫描

```javascript
// 准备扫描数据
const chatForWI = coreChat.map(x => 
    world_info_include_names ? `${x.name}: ${x.mes}` : x.mes
).reverse();

// 获取 World Info 提示词
const { 
    worldInfoString,      // 完整的 WI 字符串
    worldInfoBefore,      // 角色描述前的 WI
    worldInfoAfter,       // 角色描述后的 WI
    worldInfoExamples,    // WI 示例对话
    worldInfoDepth,       // 按深度注入的 WI
} = await getWorldInfoPrompt(chatForWI, this_max_context, dryRun, globalScanData);
```

### 阶段 4: Story String 渲染

```javascript
const storyStringParams = {
    description: description,
    personality: personality,
    persona: persona,
    scenario: scenario,
    wiBefore: worldInfoBefore,
    wiAfter: worldInfoAfter,
    mesExamples: mesExamplesArray.join(''),
    // ...
};

// 使用 Handlebars 模板渲染
const storyString = renderStoryString(storyStringParams);
```

### 阶段 5: OpenAI 消息构建 (Chat Completion API)

```javascript
// public/scripts/openai.js
async function prepareOpenAIMessages(params, dryRun) {
    // 1. 初始化 PromptManager
    const promptManager = setupChatCompletionPromptManager(oai_settings);
    
    // 2. 获取 Prompt Collection
    const promptCollection = promptManager.getPromptCollection(generationType);
    
    // 3. 构建 ChatCompletion 对象
    const chatCompletion = new ChatCompletion();
    
    // 4. 填充系统提示词
    populateChatCompletion(promptCollection, chatCompletion, {
        main: mainPrompt,
        charDescription: description,
        charPersonality: personality,
        scenario: scenario,
        worldInfoBefore: worldInfoBefore,
        worldInfoAfter: worldInfoAfter,
        // ...
    });
    
    // 5. 填充聊天历史
    populateChatHistory(chatCompletion, messages, tokenBudget);
    
    // 6. 填充注入提示词 (扩展、深度注入等)
    populationInjectionPrompts(chatCompletion, injectionPrompts);
    
    // 7. 返回最终 messages 数组
    return chatCompletion.getMessages();
}
```

### 阶段 6: 请求发送

```javascript
// OpenAI 路径
const generate_data = {
    messages: messages,
    model: model,
    temperature: oai_settings.temp_openai,
    max_tokens: oai_settings.openai_max_tokens,
    stream: oai_settings.stream_openai,
    // ...
};

// 发送请求
const response = await fetch('/api/backends/chat-completions/send', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(generate_data),
});
```

---

## 数据源详解

### 1. 角色卡数据 (Character Card)

| 字段 | 说明 | 注入位置 |
|------|------|----------|
| `description` | 角色描述 | Story String 中的 `{{description}}` |
| `personality` | 角色性格 | Story String 中的 `{{personality}}` |
| `scenario` | 场景设定 | Story String 中的 `{{scenario}}` |
| `mes_example` | 示例对话 | Story String 中的 `{{mesExamples}}` |
| `system_prompt` | 系统提示词 | OpenAI 的 main prompt |
| `post_history_instructions` | 越狱提示词 | 聊天历史后注入 |
| `depth_prompt` | 深度提示词 | 按指定深度注入 |

### 2. World Info / Lorebook

```
来源优先级:
1. Chat Lore (绑定到特定聊天)
2. Persona Lore (绑定到用户人设)
3. Character Lore (绑定到角色)
4. Global Lore (全局激活)
```

**激活机制:**
- 关键词匹配 (主关键词 + 次关键词逻辑)
- Constant 条目 (始终激活)
- 时间效果 (Sticky/Cooldown/Delay)
- 概率激活
- 互斥组

### 3. 扩展提示词 (Extension Prompts)

| 扩展 | 标识符 | 说明 |
|------|--------|------|
| Summarize | `1_memory` | 聊天摘要 |
| Author's Note | `2_floating_prompt` | 作者注释 |
| Vector Memory | `3_vectors` | 向量检索的相关记忆 |
| Data Bank | `4_vectors_data_bank` | 数据库文件检索 |
| Persona | `persona_description` | 用户人设描述 |

### 4. 聊天历史

```javascript
// 消息格式
{
    name: "角色名",
    mes: "消息内容",
    is_user: true/false,
    is_system: true/false,
    extra: {
        reasoning: "思考过程",
        tool_invocations: [...],
        media: [...],
    }
}
```

---

## 提示词构建机制

### OpenAI Chat Completion 消息结构

```javascript
// 最终发送的 messages 数组结构
[
    { role: "system", content: "[Main System Prompt]" },
    { role: "system", content: "[World Info Before]" },
    { role: "system", content: "[Character Description]" },
    { role: "system", content: "[Character Personality]" },
    { role: "system", content: "[Scenario]" },
    { role: "system", content: "[World Info After]" },
    { role: "system", content: "[Example Dialogue Header]" },
    { role: "system", name: "example_user", content: "[Example User Message]" },
    { role: "system", name: "example_assistant", content: "[Example AI Message]" },
    // ... 更多示例
    { role: "system", content: "[Chat History Start]" },
    { role: "user", content: "[User Message 1]" },
    { role: "assistant", content: "[AI Response 1]" },
    // ... 聊天历史
    { role: "system", content: "[Extension Prompt - Depth N]" },  // 深度注入
    { role: "user", content: "[Latest User Message]" },
    { role: "system", content: "[Jailbreak/Post-History Instructions]" },
]
```

### PromptManager 排序机制

```javascript
// prompt_order 控制提示词顺序
prompt_order = [
    { identifier: "main", enabled: true },
    { identifier: "worldInfoBefore", enabled: true },
    { identifier: "charDescription", enabled: true },
    { identifier: "charPersonality", enabled: true },
    { identifier: "scenario", enabled: true },
    { identifier: "worldInfoAfter", enabled: true },
    { identifier: "dialogueExamples", enabled: true },
    { identifier: "chatHistory", enabled: true },
    { identifier: "jailbreak", enabled: true },
];

// injection_position 控制注入方式
INJECTION_POSITION = {
    RELATIVE: 0,  // 相对位置 (在系统提示区)
    ABSOLUTE: 1,  // 绝对位置 (在聊天历史中按 depth 插入)
};
```

---

## 完整示例

### 场景设定

- **用户名**: Alice
- **角色名**: Seraphina (奇幻治愈师)
- **World Info**: 包含魔法世界设定
- **Vector Storage**: 启用长期记忆

### 用户输入

```
Alice: 你还记得我之前提到的那只猫吗？
```

### 数据流转过程

#### Step 1: Generate() 入口

```javascript
Generate('normal', { automatic_trigger: false });
```

#### Step 2: 用户消息处理

```javascript
await sendMessageAsUser("你还记得我之前提到的那只猫吗？", "");
// 消息被添加到 chat 数组
```

#### Step 3: 获取角色卡字段

```javascript
{
    description: "Seraphina 是一位温柔的精灵治愈师，来自光明魔法学院...",
    personality: "善良、耐心、充满智慧",
    scenario: "你在魔法森林中遇到了 Seraphina",
    mesExamples: "<START>\n{{user}}: 你好\n{{char}}: 你好，旅行者！",
}
```

#### Step 4: World Info 扫描

```javascript
// 扫描文本
chatForWI = [
    "Alice: 你还记得我之前提到的那只猫吗？",
    "Seraphina: 当然，有什么我可以帮助你的吗？",
    // ... 更多历史
];

// 匹配结果
// - "Seraphina" 关键词匹配 → 激活角色背景条目 (constant: true)
// - "猫" 未匹配任何条目

worldInfoBefore = "Seraphina 是光明魔法学院的毕业生，擅长治愈和防护魔法。";
```

#### Step 5: Vector Storage 检索

```javascript
// 查询文本
queryText = "你还记得我之前提到的那只猫吗？";

// 向量相似度搜索结果
[
    { 
        score: 0.87, 
        text: "Alice: 我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。",
        index: 15 
    }
]

// 注入到 extension_prompts
setExtensionPrompt('3_vectors', 
    "Past events:\nAlice: 我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。",
    extension_prompt_types.IN_CHAT, 
    2  // depth
);
```

#### Step 6: Story String 渲染

```javascript
const storyString = renderStoryString({
    description: "Seraphina 是一位温柔的精灵治愈师...",
    personality: "善良、耐心、充满智慧",
    scenario: "你在魔法森林中遇到了 Seraphina",
    wiBefore: "Seraphina 是光明魔法学院的毕业生...",
    wiAfter: "",
    mesExamples: "[Example dialogue formatted]",
    char: "Seraphina",
    user: "Alice",
});
```

#### Step 7: 构建 OpenAI Messages

```javascript
messages = [
    {
        role: "system",
        content: "You are Seraphina, a gentle elven healer..."  // Main prompt
    },
    {
        role: "system", 
        content: "Seraphina 是光明魔法学院的毕业生，擅长治愈和防护魔法。"  // WI Before
    },
    {
        role: "system",
        content: "Seraphina 是一位温柔的精灵治愈师，来自光明魔法学院..."  // Description
    },
    {
        role: "system",
        content: "善良、耐心、充满智慧"  // Personality
    },
    {
        role: "system",
        content: "你在魔法森林中遇到了 Seraphina"  // Scenario
    },
    // ... 示例对话 ...
    {
        role: "user",
        content: "Alice: 你好，Seraphina！"
    },
    {
        role: "assistant", 
        content: "Seraphina: 你好，旅行者！很高兴见到你。"
    },
    // ... 更多聊天历史 ...
    {
        role: "system",
        content: "Past events:\nAlice: 我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。"
        // Vector Memory 注入 (depth: 2)
    },
    {
        role: "user",
        content: "Alice: 你还记得我之前提到的那只猫吗？"
    },
];
```

#### Step 8: 发送请求

```javascript
POST /api/backends/chat-completions/send
{
    messages: [...],
    model: "gpt-4",
    temperature: 0.7,
    max_tokens: 300,
    stream: true,
}
```

#### Step 9: AI 响应

```
Seraphina: *眼中闪过温暖的光芒* 当然记得！你养了一只叫小橘的猫，
今年3岁了，最爱吃金枪鱼罐头呢~ 小橘最近怎么样？它还是那么贪吃吗？
```

### 最终提示词结构图

```
┌─────────────────────────────────────────────────────────────────┐
│ [System] Main Prompt                                             │
│ "You are Seraphina, a gentle elven healer..."                   │
├─────────────────────────────────────────────────────────────────┤
│ [System] World Info Before                                       │
│ "Seraphina 是光明魔法学院的毕业生，擅长治愈和防护魔法。"          │
├─────────────────────────────────────────────────────────────────┤
│ [System] Character Description                                   │
│ "Seraphina 是一位温柔的精灵治愈师，来自光明魔法学院..."          │
├─────────────────────────────────────────────────────────────────┤
│ [System] Character Personality                                   │
│ "善良、耐心、充满智慧"                                           │
├─────────────────────────────────────────────────────────────────┤
│ [System] Scenario                                                │
│ "你在魔法森林中遇到了 Seraphina"                                 │
├─────────────────────────────────────────────────────────────────┤
│ [System] Example Dialogue                                        │
│ {{user}}: 你好                                                   │
│ {{char}}: 你好，旅行者！                                         │
├─────────────────────────────────────────────────────────────────┤
│ [Chat History]                                                   │
│ ├─ [User] Alice: 你好，Seraphina！                               │
│ ├─ [Assistant] Seraphina: 你好，旅行者！                         │
│ ├─ ... (更多历史消息)                                            │
│ │                                                                │
│ ├─ [System @ Depth 2] Vector Memory Injection ◄─────────────┐   │
│ │   "Past events:                                            │   │
│ │    Alice: 我有一只叫小橘的猫，它今年3岁了..."              │   │
│ │                                                            │   │
│ └─ [User] Alice: 你还记得我之前提到的那只猫吗？              │   │
├──────────────────────────────────────────────────────────────┼───┤
│ [Assistant] ← AI 从这里开始生成                               │   │
│                                                               │   │
│ "Seraphina: *眼中闪过温暖的光芒* 当然记得！你养了一只叫       │   │
│  小橘的猫，今年3岁了，最爱吃金枪鱼罐头呢~"                    │   │
│                                                               │   │
│  ↑ AI 能够回忆起早期对话，因为 Vector Storage 注入了相关记忆 ─┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键代码路径

### 主要函数调用链

```
用户点击发送
    │
    ▼
Generate() [script.js:3904]
    │
    ├── processCommands() - 处理斜杠命令
    ├── sendMessageAsUser() - 发送用户消息
    ├── getCharacterCardFields() - 获取角色卡字段
    │
    ├── getWorldInfoPrompt() [world-info.js:853]
    │       │
    │       └── checkWorldInfo() [world-info.js:4428]
    │               ├── getSortedEntries() - 获取所有来源条目
    │               ├── WorldInfoBuffer.matchKeys() - 关键词匹配
    │               └── 返回激活的条目
    │
    ├── renderStoryString() [power-user.js:2227]
    │       └── Handlebars.compile() + substituteParams()
    │
    ├── [OpenAI 路径]
    │   └── prepareOpenAIMessages() [openai.js]
    │           ├── setupChatCompletionPromptManager()
    │           ├── PromptManager.getPromptCollection()
    │           ├── populateChatCompletion()
    │           ├── populateChatHistory()
    │           └── populationInjectionPrompts()
    │
    ├── [Text Completion 路径]
    │   └── getCombinedPrompt()
    │           └── 拼接 storyString + mesExamples + chatHistory
    │
    └── sendOpenAIRequest() / sendTextGenRequest()
            │
            └── fetch('/api/backends/...')
```

### 核心文件参考

| 功能 | 文件 | 关键行号 |
|------|------|----------|
| Generate 入口 | `public/script.js` | 3904 |
| Story String 渲染 | `public/scripts/power-user.js` | 2227 |
| OpenAI 消息准备 | `public/scripts/openai.js` | prepareOpenAIMessages |
| World Info 检查 | `public/scripts/world-info.js` | 4428 |
| Prompt Manager | `public/scripts/PromptManager.js` | 全文件 |
| Vector Storage | `public/scripts/extensions/vectors/index.js` | rearrangeChat |

---

## 数据来源详解：角色卡与扩展提示词

### 一、角色卡数据 (Character Card) 的来源

角色卡数据有 **两种主要来源**：

#### 1. 手动创建/编辑 (UI 界面)

在 SillyTavern 的 **角色列表面板** 中：

- 点击 **"+"** 按钮 (`#rm_button_create`) 创建新角色
- 点击已有角色进入 **角色编辑面板** (`#rm_ch_create_block`)

**编辑界面字段对应：**

| UI 字段 | HTML ID | 角色卡字段 |
|---------|---------|-----------|
| 角色名称 | `#character_name_pole` | `name` |
| 角色描述 | `#description_textarea` | `description` |
| 性格摘要 | `#personality_textarea` | `personality` |
| 场景设定 | `#scenario_pole` | `scenario` |
| 示例对话 | `#mes_example_textarea` | `mes_example` |
| 系统提示词 | `#system_prompt_textarea` | `system_prompt` |
| 越狱提示词 | `#post_history_instructions_textarea` | `post_history_instructions` |
| 深度提示词 | 高级设置中 | `depth_prompt` |

#### 2. 文件导入 (Import)

在角色列表面板中，点击 **导入按钮** (`#character_import_button` - 文件导入图标 📥)：

**支持的文件格式：**
- **PNG** - 角色卡图片（数据嵌入在 PNG 的 tEXt chunk 中，标识符 `chara`）
- **JSON** - 纯 JSON 格式的角色数据
- **YAML/YML** - YAML 格式
- **CHARX** - 压缩的角色卡格式
- **BYAF** - 其他格式

```javascript
// 导入流程 (script.js:9711)
async function importCharacter(file, options) {
    // 支持格式: json, png, yaml, yml, charx, byaf
    const format = ext[1].toLowerCase();
    
    // 发送到后端处理
    const result = await fetch('/api/characters/import', {
        method: 'POST',
        body: formData,
    });
}
```

**PNG 角色卡解析** (`utils.js:1394`)：
```javascript
// 从 PNG 的 tEXt chunk 中提取 base64 编码的 JSON 数据
export function extractDataFromPng(data, identifier = 'chara') {
    // 查找 tEXt chunk，解码 base64 → JSON
}
```

### 二、扩展提示词 (Extension Prompts) 的来源

扩展提示词 **不是导入的**，而是由 **各个扩展模块在运行时动态生成** 并注入到 `extension_prompts` 对象中。

#### 数据结构

```javascript
// script.js:579
export let extension_prompts = {};

// 设置扩展提示词 (script.js:8378)
export function setExtensionPrompt(key, value, position, depth, scan, role, filter) {
    extension_prompts[key] = {
        value: String(value),
        position: Number(position),  // IN_PROMPT, IN_CHAT, BEFORE_PROMPT 等
        depth: Number(depth),        // 注入深度
        scan: !!scan,
        role: role,                  // SYSTEM, USER, ASSISTANT
        filter: filter,
    };
}
```

#### 各扩展的来源和配置位置

| 扩展 | 标识符 | UI 配置位置 | 数据来源 |
|------|--------|-------------|----------|
| **Author's Note** | `2_floating_prompt` | 聊天面板底部的 📝 按钮 | 用户手动输入，存储在 `chat_metadata` |
| **Summarize** | `1_memory` | 扩展面板 → Summarize | AI 自动生成的聊天摘要 |
| **Vector Memory** | `3_vectors` | 扩展面板 → Vector Storage | 向量检索的相关历史消息 |
| **Data Bank** | `4_vectors_data_bank` | 扩展面板 → Vector Storage | 向量检索的文件内容 |
| **Persona** | `persona_description` | 用户设置 → Persona | 用户人设描述 |
| **World Info Depth** | `CUSTOM_WI_DEPTH_*` | World Info 面板 | Lorebook 条目（按深度注入） |

#### 具体配置入口

**1. Author's Note (作者注释)**
- **位置**: 聊天界面底部的 **📝 图标按钮**
- **功能**: 手动输入提示词，在指定深度注入
- **存储**: `chat_metadata.note_prompt`

**2. Summarize (聊天摘要)**
- **位置**: 右侧扩展面板 → **Summarize** 选项卡
- **功能**: AI 自动总结聊天历史
- **配置**: 可设置摘要模板、触发条件、token 限制

**3. Vector Storage (向量存储)**
- **位置**: 右侧扩展面板 → **Vector Storage** 选项卡
- **功能**: 
  - 聊天记忆向量化检索
  - Data Bank 文件向量化检索
- **配置**: 嵌入源、检索数量、相似度阈值等

**4. Persona (用户人设)**
- **位置**: 顶部菜单栏 → **用户头像** → Persona 管理
- **功能**: 定义用户的角色设定

### 三、数据来源总结图

```
┌─────────────────────────────────────────────────────────────────┐
│                     角色卡数据来源                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐        ┌─────────────────┐                 │
│  │   手动创建/编辑   │        │    文件导入      │                 │
│  │                 │        │                 │                 │
│  │  角色列表 → +   │        │  角色列表 → 📥  │                 │
│  │  或点击角色编辑  │        │  导入按钮        │                 │
│  │                 │        │                 │                 │
│  │  填写各字段:     │        │  支持格式:       │                 │
│  │  - 名称         │        │  - PNG (嵌入数据) │                 │
│  │  - 描述         │        │  - JSON          │                 │
│  │  - 性格         │        │  - YAML          │                 │
│  │  - 场景         │        │  - CHARX         │                 │
│  │  - 示例对话     │        │                 │                 │
│  └─────────────────┘        └─────────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    扩展提示词来源                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Author's Note  │  │    Summarize    │  │ Vector Storage  │  │
│  │                 │  │                 │  │                 │  │
│  │  聊天面板 📝    │  │  扩展面板       │  │  扩展面板       │  │
│  │  手动输入       │  │  AI 自动生成    │  │  向量检索       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │    Persona      │  │   World Info    │                       │
│  │                 │  │                 │                       │
│  │  用户头像菜单   │  │  World Info面板 │                       │
│  │  人设管理       │  │  Lorebook条目   │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
│  注意: 扩展提示词是运行时动态生成，不是导入的文件                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 总结

SillyTavern 的会话数据流转是一个多层次、模块化的过程：

1. **入口层**: `Generate()` 函数协调整体流程
2. **数据收集层**: 从角色卡、World Info、扩展、聊天历史等多个来源收集数据
3. **处理层**: 应用正则、宏替换、模板渲染等处理
4. **构建层**: 根据 API 类型 (OpenAI/Text Completion) 构建最终提示词
5. **发送层**: 附加采样参数，发送到后端 API
6. **响应层**: 处理流式/非流式响应，保存到聊天历史

这种设计使得系统具有高度的可扩展性，允许通过扩展和事件系统在各个阶段注入自定义逻辑。
