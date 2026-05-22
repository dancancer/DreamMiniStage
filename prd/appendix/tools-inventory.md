# Tools Inventory

## 1. Agent Tool Registry

路径：`lib/tools/tool-registry.ts`

静态工具共 9 个：

| ToolType | 实现 | 说明 |
|----------|------|------|
| `SEARCH` | `SearchTool` | 搜索与信息收集 |
| `ASK_USER` | `AskUserTool` | 向用户询问 |
| `CHARACTER` | `CharacterTool` | 角色生成/更新 |
| `STATUS` | `StatusTool` | 世界状态条目 |
| `USER_SETTING` | `UserSettingTool` | 玩家设定条目 |
| `WORLD_VIEW` | `WorldViewTool` | 世界结构条目 |
| `SUPPLEMENT` | `SupplementTool` | 补充世界书条目 |
| `REFLECT` | `ReflectTool` | 反思并更新任务 |
| `COMPLETE` | `CompleteTool` | 完成会话 |

Registry 还支持动态工具：

- `registerDynamicTool`
- `unregisterDynamicTool`
- `getDynamicTool`
- `getDynamicTools`

## 2. Function Tool Bridge

路径：`hooks/script-bridge/function-tool-bridge.ts`

能力：

- iframe/script 注册 function tool。
- host 侧调用工具。
- iframe 通过 callbackId 回传结果。
- 超时未回调时 fail-fast。

相关 script API：

- `registerFunctionTool`
- `unregisterFunctionTool`
- `invokeFunctionTool`
- `handleFunctionToolResult`

## 3. Slash Tooling Commands

路径：`lib/slash-command/registry/handlers/tooling.ts`

命令：

- `/tools-list`
- `/tool-list`
- `/tools-invoke`
- `/tool-invoke`
- `/tools-register`
- `/tool-register`
- `/tools-unregister`
- `/tool-unregister`
- `/tag-add`
- `/tag-remove`
- `/tag-exists`
- `/tag-list`

## 4. Script Host Capability Matrix

路径：`hooks/script-bridge/host-capability-matrix.ts`

覆盖能力：

- generation
- clipboard
- audio
- gallery
- navigation
- checkpoint
- group member
- timed world info
- UI style
- popup
- panels
- background
- function tool registry

## 5. P4 Test Runner Coverage

`/test-script-runner` 当前覆盖：

- function tool 注册/调用闭环。
- slash control flow。
- MVU variable chain。
- audio command/event chain。
- function tool timeout fail-fast。
- unknown macro fail-fast。
- reload-page host missing fail-fast。
- audio callback missing fail-fast。
- command chain fail-fast consistency。
