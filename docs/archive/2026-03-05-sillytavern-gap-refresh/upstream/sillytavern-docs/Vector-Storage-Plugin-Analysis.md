# Vector Storage 插件分析文档

## 概述

**Vector Storage** 是 SillyTavern 的一个内置扩展插件，用于实现**语义搜索和长期记忆功能**。它通过将文本转换为向量嵌入（embeddings），存储在本地向量数据库中，从而在对话时检索语义相关的历史内容。

---

## 核心功能

### 1. 聊天记忆 (Chat Memory)
- 将聊天消息向量化并存储
- 在生成回复时，从历史消息中检索与当前对话最相关的内容
- 将相关历史消息注入到 prompt 中，帮助 AI 记住过去的对话

### 2. 文件处理 (File Attachments)
- 对聊天中附加的大文件进行向量化
- 支持 **Data Bank** 附件的向量检索
- 根据查询自动提取文件中最相关的片段

### 3. World Info 激活
- 对 World Info 条目进行向量化
- 基于语义相似度自动激活相关的 World Info 条目

---

## 架构设计

### 前端 (`public/scripts/extensions/vectors/index.js`)

**主要职责：**
- UI 设置管理
- 聊天同步逻辑 (`synchronizeChat`)
- 生成拦截器 (`rearrangeChat`) - 在生成前重新组织聊天内容
- 文件处理和 Data Bank 注入
- World Info 向量激活

**核心流程：**
```
消息事件 → synchronizeChat() → 计算消息hash → 
检查是否已向量化 → 调用后端API插入/删除向量
```

### 后端 (`src/endpoints/vectors.js`)

**主要职责：**
- 使用 **vectra** 库管理本地向量索引
- 调用各种 embedding 源生成向量
- 提供 REST API 端点

**API 端点：**

| 端点 | 功能 |
|------|------|
| `/api/vector/insert` | 插入向量项 |
| `/api/vector/query` | 查询单个集合 |
| `/api/vector/query-multi` | 查询多个集合 |
| `/api/vector/list` | 列出已保存的 hash |
| `/api/vector/delete` | 删除向量项 |
| `/api/vector/purge` | 清除指定集合 |
| `/api/vector/purge-all` | 清除所有向量 |

---

## 支持的 Embedding 源

在 `src/vectors/` 目录下实现：

| 源 | 文件 |
|----|------|
| **Transformers** (本地) | `embedding.js` |
| **OpenAI** | `openai-vectors.js` |
| **Cohere** | `cohere-vectors.js` |
| **Google** | `google-vectors.js` |
| **Ollama** | `ollama-vectors.js` |
| **LlamaCpp** | `llamacpp-vectors.js` |
| **vLLM** | `vllm-vectors.js` |
| **NomicAI** | `nomicai-vectors.js` |
| **Extras** | `extras-vectors.js` |
| **WebLLM** (浏览器端) | `webllm.js` |

---

## 工作流程

### 消息向量化流程
```
1. 监听消息事件 (发送/接收/编辑/删除)
2. 调用 synchronizeChat()
3. 计算每条消息的 hash
4. 对比已存储的 hash，找出新增/删除的消息
5. 可选：对消息进行摘要 (summarize)
6. 分块处理 (chunk) 并调用 embedding API
7. 存入 vectra 本地索引
```

### 生成时检索流程
```
1. rearrangeChat() 作为生成拦截器被调用
2. 获取最近几条消息作为查询文本
3. 向量查询相关历史消息
4. 将相关消息从原聊天中移除
5. 格式化后注入到 extension prompt
6. 同时处理 Data Bank 文件和 World Info
```

---

## 关键配置参数

| 参数 | 说明 |
|------|------|
| `protect` | 保护最近 N 条消息不被移除 |
| `insert` | 插入的相关消息数量 |
| `query` | 用于查询的最近消息数 |
| `depth` | prompt 中的插入深度 |
| `score_threshold` | 相似度阈值 (0-1) |
| `chunk_size` | 文件分块大小 |
| `overlap_percent` | 分块重叠百分比 |

---

## 实际场景示例：角色扮演对话中的长期记忆

假设你正在与一个名为 **"艾莉丝"** 的 AI 角色进行长期对话。

### 场景设定

你们已经聊了 **200 条消息**，在第 15 条消息时，你曾提到：

> **用户 (消息 #15)**: "我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。"

现在对话进行到第 200 条，你突然问：

> **用户 (消息 #200)**: "对了，你还记得我养的宠物吗？"

---

### 阶段一：消息向量化 (后台持续进行)

当你发送消息 #15 时：

```
1. 触发 MESSAGE_SENT 事件
   ↓
2. onChatEvent() → synchronizeChat()
   ↓
3. 计算消息 hash
   hash = getStringHash("我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。")
   → 例如: 1847293856
   ↓
4. 检查 hash 是否已存在于向量库
   getSavedHashes(chatId) → [已有的hash列表]
   ↓
5. 发现是新消息，调用 embedding API
   POST /api/vector/insert
   {
     collectionId: "chat_abc123",
     items: [{
       hash: 1847293856,
       text: "我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。",
       index: 15
     }],
     source: "transformers"  // 或 openai, ollama 等
   }
   ↓
6. 后端调用 embedding 模型生成向量
   text → [0.023, -0.156, 0.892, ...] (768维或更高)
   ↓
7. 存入 vectra 本地索引
   路径: vectors/transformers/chat_abc123/
```

### 阶段二：生成时检索 (你发送消息 #200 时)

```
1. 你发送: "对了，你还记得我养的宠物吗？"
   ↓
2. 生成拦截器 rearrangeChat() 被调用
   ↓
3. 获取查询文本 (最近 N 条消息)
   settings.query = 2 (默认)
   queryText = "对了，你还记得我养的宠物吗？" + 最近一条AI回复
   ↓
4. 向量相似度查询
   POST /api/vector/query
   {
     collectionId: "chat_abc123",
     searchText: "对了，你还记得我养的宠物吗？",
     topK: 3,  // settings.insert
     threshold: 0.25
   }
   ↓
5. 后端执行向量搜索
   - 将查询文本转为向量
   - 在 vectra 索引中搜索最相似的向量
   - 返回结果:
     [
       { hash: 1847293856, score: 0.87, text: "我有一只叫小橘的猫..." },
       { hash: 2938475610, score: 0.45, text: "我家附近有个宠物店..." },
       ...
     ]
   ↓
6. 格式化并注入 prompt
   template = "Past events:\n{{text}}"
   
   注入内容:
   "Past events:
   用户: 我有一只叫小橘的猫，它今年3岁了，最喜欢吃金枪鱼罐头。"
   ↓
7. 最终发送给 AI 的 prompt 结构:
   
   [System Prompt]
   [Character Description]
   [Past events: 用户: 我有一只叫小橘的猫...]  ← 向量检索注入
   [最近5条对话]  ← settings.protect 保护的消息
   [用户: 对了，你还记得我养的宠物吗？]
```

### 阶段三：AI 回复

因为相关历史被注入，AI 能够回答：

> **艾莉丝**: "当然记得！你养了一只叫小橘的猫，今年3岁了，最爱吃金枪鱼罐头呢~ 小橘最近怎么样？"

---

### 关键代码对应

| 步骤 | 代码位置 |
|------|----------|
| 消息事件监听 | `eventSource.on(event_types.MESSAGE_SENT, onChatEvent)` |
| 同步逻辑 | `synchronizeChat()` 函数 |
| 生成拦截 | `window['vectors_rearrangeChat'] = rearrangeChat` |
| 查询相关消息 | `queryCollection(chatId, queryText, settings.insert)` |
| 注入 prompt | `setExtensionPrompt(EXTENSION_PROMPT_TAG, insertedText, ...)` |

---

### 配置参数影响

| 参数 | 示例值 | 影响 |
|------|--------|------|
| `protect = 5` | 最近5条消息始终保留，不会被移除 |
| `insert = 3` | 最多注入3条相关历史消息 |
| `query = 2` | 用最近2条消息作为查询依据 |
| `score_threshold = 0.25` | 相似度低于0.25的结果被过滤 |
| `depth = 2` | 注入位置在倒数第2条消息之前 |

---

## 总结

Vector Storage 插件通过**语义向量检索**实现了：

1. **长期记忆** - 让 AI 能"记住"早期对话内容
2. **智能文件检索** - 从大文件中提取相关片段
3. **动态 World Info** - 基于语义自动激活设定

它使用 **vectra** 作为本地向量数据库，支持多种 embedding 源，并通过生成拦截器在每次对话时自动注入相关上下文。

这就是 Vector Storage 如何让 AI "记住" 200 条消息之前的内容，而不需要将所有历史都塞进 context window。

---

## 文件结构

```
public/scripts/extensions/vectors/
├── index.js          # 前端主逻辑
├── manifest.json     # 插件清单
├── settings.html     # 设置界面
├── style.css         # 样式
└── webllm.js         # WebLLM 浏览器端向量

src/endpoints/vectors.js    # 后端 API 路由

src/vectors/
├── embedding.js            # Transformers 本地嵌入
├── openai-vectors.js       # OpenAI API
├── cohere-vectors.js       # Cohere API
├── google-vectors.js       # Google API
├── ollama-vectors.js       # Ollama 本地
├── llamacpp-vectors.js     # LlamaCpp
├── vllm-vectors.js         # vLLM
├── nomicai-vectors.js      # NomicAI
└── extras-vectors.js       # Extras API
```
