# Block 1 — 解析/执行内核重建

## 目标
- 提供可测试的解析/执行内核（递归下降 + AST + Generator 执行），支持闭包 `{: ... :}`、条件/循环、`/return`、`/break`/`/abort` 语义。
- 引入链式作用域模型（局部/块级/全局），支持变量查找冒泡与作用域生命周期。
- 保持与命令适配层解耦，内核不直接触碰 UI/网络/持久化；通过注入的 command registry 与副作用接口完成动作调用。

## 交付物
- 新的解析与 AST 类型定义（TypeScript），独立模块，文件控制在 400 行以内。
- 执行器（Generator/异步迭代），处理控制流、返回值、错误/中断信号，提供暂停/恢复钩子。
- 链式作用域实现（不可与 UI 单例耦合），支持 set/get/del、块级 push/pop。
- Command Descriptor 接口（名称/别名/参数 schema/handler 签名）作为执行器对外唯一依赖。
- Vitest 覆盖：解析用例（语法/错误）、作用域行为、执行流程（if/while/times/return/break/abort）、管道值传递。

## 关键设计点
- Token/AST：保持简单词法（命令前缀 `/` 与闭包/参数分隔），避免过度抽象；AST 节点定义精简（CommandNode、BlockNode、LiteralNode、IdentifierNode、ControlNode）。
- 执行模型：指令序列 -> 生成器；支持 yield 中间结果/状态；控制信号（return/break/abort）用枚举封装，避免深分支。
- 作用域：链表式作用域栈，`lookup` 逐级冒泡；块进入/退出时 push/pop；全局单独持有。
- 错误边界：解析错误需携带位置信息；执行错误区分用户脚本错误与命令 handler 异常，便于上层处理。
- 扩展接口：执行器仅依赖注入的 `resolveCommand(name)`、上下文对象（chat/session），避免硬编码。

## 不在本块完成的事项
- 具体命令 handler 的业务逻辑；仅提供接口。
- UI/持久化/网络调用。
- 完整的 SillyTavern 宏替换 `{{var::name}}`（可在后续块考虑）。

## 子任务（执行时再细拆）
1. 解析器设计
   - 定义 token/AST 类型；写基础解析用例。
   - 实现递归下降解析（命令、参数、块/闭包、控制流节点）。
   - 错误报告（行列/片段）。
2. 作用域实现
   - 定义 Scope 接口与链式结构；set/get/del/enter/exit。
   - 单测覆盖变量覆盖、遮蔽、删除、查找失败。
3. 执行器实现
   - 定义控制信号类型（return/break/abort）。
   - 实现指令迭代、块执行、控制流节点处理、管道值传递。
   - 与 command registry 接口对接（仅调用 handler，不含业务）。
4. 测试与验证
   - Vitest：解析/作用域/执行核心用例。
   - 回归现有命令路径（mock handler）确保执行器不破坏已实现命令。
5. 文档与总结
   - 在本目录更新完成情况与已知风险。
   - 若上下文占用 >50%，生成续作上下文文档并提醒新开会话。

## 风险与依赖
- License：确认 SillyTavern 源码许可证，必要时完全自行实现。
- 兼容性：现有 `lib/slash-command` 的调用方需要适配到新执行器，需规划迁移适配层。
- 复杂度：防止解析器/执行器文件膨胀；必要时拆分子模块。

## 验收标准
- 解析器/执行器/作用域模块可独立单测通过（`pnpm test` 子集）。
- 能运行现有命令（使用 mock handler）并保持行为一致。
- 代码符合简洁原则：函数短小，分支受控，无全局耦合。

## 当前进展
- 已实现内核解析器/执行器/作用域（见 `lib/slash-command/core/*`），通过基础用例。
- 旧命令注册表已适配内核执行器，保留兼容接口 `executeSlashCommands`，新增脚本接口 `executeSlashCommandScript`。
- 相关测试通过：`lib/slash-command/__tests__/kernel-core.test.ts`、`pipe-propagation.property.test.ts`、`error-handling.property.test.ts`。
- 脚本桥接层已切换为使用内核脚本执行入口（`hooks/script-bridge/slash-handlers.ts`），可解析闭包/控制流语法。
- 块级作用域策略：`{: :}` 执行时 push/pop 新作用域帧，`/let|/var` 默认写入当前帧；新增用例覆盖。
- P0 控制流命令 `/return` 已接入注册表并通过信号终止执行链。
- P1 消息命令初步接入：`/sendas`、`/sys`、`/impersonate`、`/continue`、`/swipe` 注册到兼容层，缺省回调时使用 onSend/onTrigger 回退。
- UI 接线：`useScriptBridge` 和 `CharacterChatPanel` 透传 P1 回调；对话 Store 支持 addRoleMessage 以持久化角色/系统/impersonate 消息。

下一步（Block2/P0/P1）：可开始补控制流/消息命令实现，或进行 UI/iframe E2E 验证（在 backlog 已记）。
