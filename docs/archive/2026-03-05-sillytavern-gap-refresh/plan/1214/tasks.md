# 1214 任务拆解（执行清单）

## 1) 脚本桥 / TavernHelper
- [ ] 实现 API_CALL 全量路由：messages、variables（含 chat/preset/message/script/extension）、preset、worldbook（lib/script-runner/executor.ts）。
- [ ] shim 去 stub：Quick Reply、角色、群聊、registerFunctionTool/registerSlashCommand、getApiUrl/getRequestHeaders（public/iframe-libs/slash-runner-shim.js）。
- [ ] 变量作用域扩展与存取：补充 per-scope handler（hooks/script-bridge/variable-handlers.ts + mvu store）。

## 2) 移植 JS-Slash-Runner 命令
- [ ] 将 /event-emit、/audioenable|audioplay|audioimport|audioselect|audiomode 注册到 COMMAND_REGISTRY，参数/枚举对齐源码（lib/slash-command/registry/index.ts）。
- [ ] ExecutionContext 暴露音频状态控制，增加必要的 store/handler（lib/slash-command/types.ts 及相关 handler）。
- [ ] 补充命令帮助/错误路径的测试。

## 3) MVU 函数调用链路
- [ ] 请求构建注入工具：基于开关向 LLM 请求附加 getMvuTool / tool_choice（调用点位于聊天请求组装逻辑）。
- [ ] 响应解析：接收 tool_calls → FunctionCallManager.processToolCalls → 写回 mvu store；处理失败/空结果分支。
- [ ] registerVariableSchema + per-scope reconcile 钩子，保持 schema 与 stat_data 同步（lib/mvu/data/store.ts 及关联模块）。

## 4) Slash 解析/运行时对齐
- [ ] parser 增加 typed args、alias、parser flags、scope 冒泡，保留递归块能力（lib/slash-command/core/parser.ts, scope.ts）。
- [ ] executor 发调试/错误事件，兼容上游自动补全/断点（lib/slash-command/executor.ts）。
- [ ] 更新现有命令的元数据声明，补充覆盖测试。

## 5) 说话人保真
- [ ] postProcessMessages 纳入 groupNames，前缀写入/移除对齐 SillyTavern prompt-converter（lib/core/prompt/post-processor.ts）。
- [ ] 补充群聊快照/幂等性测试。

## 6) UI/面板选择与落地
- [ ] 方案选型：直接嵌入 JS-Slash-Runner panel 或用现有组件重建最小 UI；记录决策。
- [ ] 若重建：实现脚本列表、音频控制、宏/工具注册入口；保持 iframe 高度同步（public/iframe-libs/script-runner.html 及 React 组件）。

## 验证与基线
- [ ] 为新行为补充 Vitest 用例（按模块归类），使用 `pnpm vitest run <file>`。
- [ ] 必要时扩充基线对比资产，确认与 SillyTavern 输出一致。
