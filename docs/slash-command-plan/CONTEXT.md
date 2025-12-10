# Slash Command Migration — Progress Context (Stage Summary)

## 当前完成
- 内核：递归下降解析器 + Generator 执行器 + 链式作用域，支持 `{: :}`、`/if` `/while` `/times`、控制信号 `/return` `/break` `/abort`。
- 兼容层：旧接口 `executeSlashCommands` 映射控制信号；新增 `executeSlashCommandScript` 直用内核解析。
- P0 变量：`/let|/var` 写入当前作用域帧，块执行 push/pop 作用域。
- P0 控制流：`/return` 接入注册表，信号中断执行链。
- P1 消息：`/sendas`、`/sys`、`/impersonate`、`/continue`、`/swipe` 注册并有合理回退。
- P2 初始算子：新增 `/add` `/sub` `/len` `/trim` `/push`；`/add|/sub` 默认使用 pipe 作为首操作数，`/push` 将值压入上下文变量数组并返回 JSON 字符串。
- UI/渲染：MessageItem 支持 system/narrator/custom 角色样式，CharacterChatPanel 暴露 swipe 状态提示，防止回调缺省时静默丢弃。
- 脚本桥/Hook：`useScriptBridge` 与 `slash-handlers` 透传新回调；`CharacterChatPanel` 回退逻辑（无专用回调时用前缀或触发生成）。
- 对话 Store：支持 addRoleMessage（任意角色写入），addUserMessage/triggerGeneration 已用于 slash 行为。
- 测试：核心 + 属性 + P1 消息 + P2 算子 + Slash Handler 集成通过。
  - `pnpm vitest run lib/slash-command/__tests__ hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`

## 最新任务小结（UI/E2E 接线）
- Slash 回调 UI：系统/旁白/自定义角色消息按角色样式渲染；缺省 swipe 回调时显示最近目标提示。
- 集成验证：新增 slash-handlers 集成用例覆盖 `/sys` `/sendas` `/impersonate` `/swipe` 回调透传，防回归。
- 仍需：将 swipe 与真实多候选回复管线对接，并添加角色样式快照测试。

## 待办 / Backlog
- E2E：从 UI/iframe 触发闭包/控制流脚本，验证 onSend/onTrigger/onSendAs/onSendSystem/onImpersonate/onContinue/onSwipe 实际效果。
- UI/渲染：按 role 区分 system/narrator/assistant 等样式和行为；实现 swipe 选择/恢复而非占位。
- P2 余项：乘除/模/随机/比较、字符串/数组拓展（pop/slice/join/format 等）以及返回值契约，补单测。

## 下一步建议
1) UI 管线接线：onSendSystem/onSendAs/onImpersonate/onSwipe 的实际渲染和状态更新，补集成/快照测试。
2) 扩展 P2 剩余算子（乘除/模、数组 pop/join 等）并明确返回值/错误语义，同时补充属性测试。
