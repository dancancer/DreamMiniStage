# SillyTavern 功能整合改造方案（不含群聊）

> 目标：补齐 SillyTavern 核心 + JS-Slash-Runner + MagVarUpdate 功能，排除群聊，优先让脚本与插件在 DreamMiniStage 中可用。

## 范围与目标
- TavernHelper API 全量可用：脚本能读写消息、变量（多作用域）、预设、世界书，能发起/停止生成。
- Slash 执行上下文补全：音频/预设/世界书能力在命令和脚本中可用；支持脚本注册的自定义 slash。
- MVU 函数调用闭环：请求侧注入工具，响应侧驱动变量落盘，支持脚本注册 function tool。
- 脚本生态落地：三层脚本存储（全局/预设/角色）与按钮面板，让 JS-Slash-Runner 的脚本交互可用。
- 数据兼容补位：PNG 角色卡与聊天 JSONL 导入导出（简版），方便迁移。

## 现状差距摘要（不含群聊）
- TavernHelper 多数方法返回占位或抛错（generateRaw/stop* 为空；预设/世界书 get* 同步返回空）。
- Slash ExecutionContext 仅注入消息/变量，音频/世界书/预设能力缺失，JS-Slash-Runner 音频命令部分失效。
- MVU tool 仅将 tool_call 追加为文本，未写回 MVU store，也未消费脚本注册的 function tool。
- 脚本存储与按钮 UI 未实现，脚本无法配置/启用，也无法在聊天界面呈现按钮。
- 数据迁移链路（PNG 元数据、聊天 JSONL）未提供。

## 改造方案
### 1) TavernHelper 桥接完善
- 将 API 调用转接到真实存储/工作流：
  - 消息：对接 dialogueStore 读写；支持 count/fromEnd。
  - 变量：使用 scoped variable API，支持 global/character/chat/preset/message/script；暴露 getVariables/replaceVariables/getAllVariables。
  - 预设：改为异步返回，loadPreset 切换启用状态。
  - 世界书：返回名称列表，支持 add entries。
  - 生成：实现 generateRaw（绕过 preset），stopGenerationById/stopAllGeneration 通过 AbortController 路由到 LLM pipeline。
- 清理：统一事件订阅生命周期，脚本结束自动取消。

### 2) Slash 与执行上下文补全
- 在 `adaptContext` 注入音频/世界书/预设扩展回调，让 `/audio*`、worldbook/preset 命令可工作。
- 保留并暴露 `registerSlashCommand`、`registerFunctionTool`，注册表可追踪来源 iframe，卸载时清理。
- 补充 Quick Reply 与字符/上下文 API 的实现，移除 shim 中的空 stub。

### 3) MVU 函数调用闭环
- 请求侧：在 LLM 调用时按开关附加 `getMvuTool()`，tool_choice=auto。
- 响应侧：使用 `FunctionCallManager.processToolCalls` 解析 tool_calls，将更新写回 MVU store；失败时日志+回退文本。
- 脚本工具：将 iframe 注册的 function tool 注入工具列表，响应时通过 `invokeFunctionTool` 路由回 iframe。

### 4) 脚本存储与按钮系统
- 新增 `lib/script-runner/script-storage.ts`：三层脚本（global/preset/character），启用状态管理，合并 `getActiveScripts()`。
- 新增 `lib/script-runner/script-buttons.ts`：定义 ScriptButton，提供 get/replace/append/getButtonEvent。
- UI：`components/ScriptButtonPanel.tsx` 渲染可见按钮，点击发事件；在聊天面板挂载。
- 运行态：脚本执行前读取 active scripts 注入 iframe；清理时回收事件/注册。

### 5) 数据兼容（轻量版）
- 角色卡 PNG tEXt 读写：`lib/data/png-metadata.ts`，支持 chara 元数据导入/导出。
- 聊天 JSONL 导入导出：`lib/data/import-export/jsonl-chat.ts`，支持基础字段。

## 里程碑与优先级
1. TavernHelper 桥接 + Slash 扩展（最高优先）  
2. MVU 函数调用闭环  
3. 脚本存储 + 按钮 UI  
4. 数据兼容（PNG/JSONL）

## 风险与缓解
- API 异步化可能影响现有调用：提供向后兼容同步包装（返回 Promise 但允许调用方 await），并补充单测。
- 工具注册引入安全面：限制可注册工具的来源 iframe，超时自动拒绝。
- 脚本存储体积：使用分页/按需加载，默认懒加载按钮数据。

## 验收要点
- 在 iframe 脚本内能调用 TavernHelper 完整 API，实际读写消息/变量/预设/世界书并可触发生成。
- JS-Slash-Runner `/audio*`、`/event-emit` 等命令可用，音频命令调用实际播放接口。
- LLM 返回的 tool_calls 能更新 MVU 变量；脚本注册 function tool 可被调用并回传结果。
- 脚本列表/按钮在聊天界面出现，点击按钮能触发对应事件。
