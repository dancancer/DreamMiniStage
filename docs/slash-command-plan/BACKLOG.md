# Slash Command Backlog

- E2E 验证：通过 UI/iframe 调用 `triggerSlash`，确认闭包/控制流脚本能正确触发 onSend/onTrigger 与变量持久化。
- 作用域策略决策：是否在 `{: :}` 块内 push/pop 新作用域帧，及 `set` 行为（局部 vs 冒泡更新）；落地后需补充测试。
- P2 余项：乘除/模/比较/随机、字符串/数组拓展（pop/slice/join/format 等）的语义与测试。
