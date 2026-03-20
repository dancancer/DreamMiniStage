# Phase 6 MVU Capability Matrix

## 目的

这份文档是 `MagVarUpdate` 在 DreamMiniStage 当前产品语义中的单一说明书。
它回答的不是“底层有没有模块”，而是：

- 当前默认走哪条 MVU 路径
- 哪些路径只是显式扩展
- 用户在 `/session` 里能看到什么
- 哪些状态已经有真实运行时闭环
- 哪些边界当前仍然故意不做隐式兼容

单一事实源代码位于：

- `lib/store/mvu-config-store.ts`
- `lib/mvu/debugger/strategy-matrix.ts`
- `lib/mvu/route-trace.ts`
- `lib/mvu/data/persistence.ts`
- `lib/mvu/protocol.ts`
- `lib/mvu/extra-model-runtime.ts`
- `function/dialogue/chat-shared.ts`
- `components/mvu/MvuDebuggerPanel.tsx`

---

## 判定标准

- `默认路径`
  - 当前产品默认就会使用
  - 用户不需要额外切换策略
  - 必须具备真实运行时闭环

- `显式扩展`
  - 当前不是默认行为
  - 必须由用户显式选择策略后才会生效
  - 未选择时不能静默抢占默认路径

- `可观测`
  - `/session` 的 `MVU Debugger` 能直接看到
  - 至少能解释：
    - 已选策略
    - 实际应用路径
    - 是否命中更新
    - 是否出现过协议块

- `协议卫生`
  - 内部协议文本允许存在于内部闭环
  - 但不能污染用户可见回复、正则输出、向量记忆等外部面

---

## 能力矩阵

| Capability | Status | Source of Truth | Product Surface | Verification |
|---|---|---|---|---|
| 变量初始化 (`InitVar` + greeting) | 默认路径 | `lib/mvu/variable-init.ts`, `lib/mvu/data/persistence.ts` | `/session` 可通过当前变量/快照查看结果 | 已验证 |
| 文本 delta 更新 (`text-delta`) | 默认路径 | `lib/mvu/data/persistence.ts`, `function/dialogue/chat-shared.ts` | `/session` 路径观测 + 变量快照 | 已验证 |
| Function calling 策略选择 | 显式扩展 | `lib/store/mvu-config-store.ts`, `lib/mvu/debugger/strategy-matrix.ts` | `/session` 策略矩阵 / 策略选择 | 已验证 |
| Function calling 最小运行时透传 | 显式扩展 | `hooks/character-dialogue/useDialoguePreferences.ts`, `hooks/useCharacterDialogue.ts`, `function/dialogue/chat.ts`, `lib/workflow/examples/DialogueWorkflow.ts`, `lib/nodeflow/LLMNode/LLMNode.ts` | 无独立按钮；由策略切换驱动 | 已验证 |
| Function calling 协议卫生 | 显式扩展 | `lib/mvu/protocol.ts`, `lib/nodeflow/LLMNode/LLMNodeTools.ts`, `lib/nodeflow/RegexNode/RegexNode.ts`, `function/dialogue/chat-shared.ts` | `/session` 可见回复与向量记忆都不应看到协议块 | 已验证 |
| Function calling 节点状态保留 | 显式扩展 | `function/dialogue/chat-shared.ts` | `/session` 路径观测 + 节点快照 | 已验证 |
| Extra model 策略选择 | 显式扩展 | `lib/store/mvu-config-store.ts`, `lib/mvu/debugger/strategy-matrix.ts` | `/session` 策略矩阵 / 策略选择 | 已验证 |
| Extra model 最小运行时接入 | 显式扩展 | `lib/mvu/extra-model-runtime.ts`, `lib/mvu/extra-model.ts` | 无独立按钮；由策略切换驱动 | 已验证 |
| Extra model 节点 trace（命中） | 显式扩展 | `lib/mvu/route-trace.ts`, `function/dialogue/chat-shared.ts` | `/session` 路径观测 | 已验证 |
| Extra model 节点 trace（未命中） | 显式扩展 | `function/dialogue/chat-shared.ts` | `/session` 路径观测 | 已验证 |
| 当前变量 / 指定消息快照查看 | 默认产品面 | `components/mvu/MvuDebuggerPanel.tsx`, `lib/mvu/data/persistence.ts` | `/session` 页脚 `MVU Debugger` | 已验证 |
| 状态栏预览 | 默认产品面 | `components/mvu/MvuStatusBarPreview.tsx`, `lib/mvu/debugger/status-bar.ts` | `/session` 页脚 `MVU Debugger` | 已验证 |
| 状态栏模板渲染 | 默认产品面 | `lib/mvu/debugger/template.ts`, `components/mvu/MvuDebuggerPanel.tsx` | `/session` 页脚 `MVU Debugger` | 已验证 |
| 节点路径观测 (`mvuTrace`) | 默认产品面 | `lib/models/parsed-response.ts`, `lib/mvu/route-trace.ts`, `lib/mvu/data/persistence.ts` | `/session` 页脚 `MVU Debugger` | 已验证 |

---

## 当前默认路径

当前默认行为只有一条：

1. 开场时初始化变量
2. 助手最终文本返回
3. 从 `fullResponse` 解析 MVU 更新
4. 把变量快照写到当前节点

也就是：

- 默认策略：`text-delta`
- 默认应用路径：`text-delta`

这条规则是当前 Phase 6 的核心约束，不能被 `function-calling` 或 `extra-model` 静默抢占。

---

## 显式扩展路径

### `function-calling`

- 当前状态：显式扩展
- 开启方式：在 `/session` 的 `MVU Debugger` 中把策略切到 `function-calling`
- 当前已具备：
  - 运行时透传
  - 协议块可转化为 `UpdateVariable`
  - 节点路径观测
  - 协议卫生（不污染可见输出 / 向量记忆）
- 当前边界：
  - 不是默认路径
  - 只在显式选择后生效

### `extra-model`

- 当前状态：显式扩展
- 开启方式：在 `/session` 的 `MVU Debugger` 中把策略切到 `extra-model`
- 当前已具备：
  - 最小运行时接入
  - 复用当前激活模型做二次变量解析
  - 更新结果直接写回当前节点
  - 节点路径观测
  - “命中”与“未命中”都能留下 trace
- 当前边界：
  - 不是默认路径
  - 当前仍以最小闭环为主，不代表已经做完作者级高级配置面

---

## 协议卫生矩阵

| Surface | `UpdateVariable` 协议块是否允许出现 | 当前状态 |
|---|---|---|
| `fullResponse` | 允许 | 保留给 MVU 内部闭环 |
| `screenContent` | 不允许 | 已清理 |
| 流式 token | 不允许 | 已清理 |
| 正则处理输入 | 不允许 | 已清理 |
| 向量记忆 assistant 内容 | 不允许 | 已清理 |

---

## 当前观测面

`/session` 的 `MVU Debugger` 当前能直接看到：

- 当前策略
- 策略矩阵
- 当前节点路径
- 选中节点路径
- 当前变量
- 指定消息快照
- 状态栏预览
- 状态栏模板渲染
- Schema
- Delta

这意味着当前 Phase 6 已不再停留在“作者只能猜测哪条路径生效”的阶段。

---

## 当前未做的事

以下边界当前仍故意不做隐式扩展：

| 场景 | 当前边界 |
|---|---|
| `function-calling` 静默抢占默认路径 | 不允许 |
| `extra-model` 静默抢占默认路径 | 不允许 |
| 未选择扩展策略时自动走二次模型解析 | 不允许 |
| 让协议块直接出现在用户可见回复中 | 不允许 |

---

## 当前结论

到当前阶段，Phase 6 已经完成了三件事：

1. 默认路径、扩展路径、协议卫生、节点观测都已收口成单一路径
2. `/session` 真实产品面已经能解释“这条消息到底怎么更新变量”
3. committed fixtures 已经覆盖状态栏、策略、extra-model 这三类关键语义

因此，后续若继续推进 Phase 6，不应再用“有没有模块/有没有 handler”来判断完成度，而应只围绕两类问题推进：

- 是否还缺更真实的 committed 样例
- 是否还缺作者真正需要的产品表达
