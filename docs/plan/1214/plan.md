# SillyTavern 核心 + JS-Slash-Runner + MagVarUpdate 整合计划（1214）

## 背景与目标
- 目标：与 SillyTavern 核心行为及插件 JS-Slash-Runner、MagVarUpdate 达到功能对齐，允许脚本/插件无改动运行。
- 现状参考：`docs/analysis/sillytavern-integration-gap-2026-03.md`（最新对齐审计）；预设管线、Slash 内核、向量记忆、MVU 核心、沙箱框架已存在。

## 当前总体计划（优先级顺序）
1) 补齐脚本桥与 TavernHelper：实现函数/Slash 注册，打通消息、变量（多作用域）、preset/worldbook、Quick Reply、群聊/角色 API。
2) 移植 JS-Slash-Runner 命令：/event-emit 与 /audioenable|audioplay|audioimport|audioselect|audiomode，参数签名/枚举对齐，并暴露音频控制上下文。
3) 打通 MVU 函数调用：请求侧注入 `getMvuTool()`，响应侧解析 tool_calls → FunctionCallManager → 写回 mvu store；补 registerVariableSchema 与 per-scope 校验。
4) Slash 解析/运行时对齐：增加 typed args、alias、parser flags、scope 冒泡、调试/错误事件，兼容上游自动补全/断点流。
5) 说话人保真：postProcessMessages 纳入 groupNames，前缀写入/移除规则对齐 SillyTavern。
6) UI 决策与落地：内嵌 JS-Slash-Runner 面板或用现有组件重建最小控件（脚本列表、音频面板、宏/工具注册），保持 iframe 高度同步。

## 交付与验证
- 每阶段补充针对性的 Vitest 用例：桥接 API、Slash 新命令、函数调用路径、schema 注册、群聊前缀。
- 运行 `pnpm vitest run <target>` 针对新增/改动模块；必要时扩展基线对比用例。
