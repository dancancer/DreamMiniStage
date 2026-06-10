---
status: accepted
date: 2026-05-29
---

# 世界书有状态激活归 StorySession，不写回静态定义

## 背景

立项 review 实读 `world-book-advanced.ts` 发现：运行时世界书匹配远不止 `selective`/`secondary_keys`，还包括 `constant`、`sticky`+`_stickyRemaining`、`cooldown`+`_cooldownRemaining`、`delay`+`_delayUntilTurn`、recursion+`maxRecursionDepth`、`insertion_order`、`selectiveLogic` AND/OR、`depth`。其中 **sticky / cooldown / delay 是跨轮次的运行时状态**（计数器逐轮递减）。若 WorldModule 只做"关键词→注入"的静态匹配，会静默丢掉这些语义，导致导入世界书行为与原卡漂移——正是本路线要避免的语义漂移。

## 决策

- WorldModule 不得退化为静态关键词匹配；`constant`/`selective`+`secondaryKeys`+`selectiveLogic`/`sticky`/`cooldown`/`delay`/recursion+`depth`/`insertion_order` 都是平价验收项。
- **sticky / cooldown / delay 计数器与递归命中状态写入 `StorySession` 的 world activation state，而不是写回 worldbook 静态定义。**

## 后果

- **直接约束架构评审候选 #3（统一 World 关键词匹配器）**：无状态的 keyword + secondary-key matching 可以收敛成一个共享匹配器；但 time-effects 的**有状态语义不能随匹配逻辑一起合并**——cascade 运行时用可变全局计数器、story runtime 用不可变逐条 map 线程化，二者是两套不同的适配器，强行统一会造出"伪装成模块的 dispatcher"。本 ADR 是该 invariant 的来源。
