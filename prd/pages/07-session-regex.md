# 07. Session Regex

> 入口：`/session?id={sessionId}` 的 regex 视图，或右侧 `regex` 面板

## 1. 用户目标

用户维护正则脚本，用于处理用户输入、AI 输出、slash command、世界书内容或 reasoning 块。

## 2. 当前定位

正则脚本默认按全局规则维护；从会话进入时带当前角色上下文，但不把规则强制绑死到当前角色。右侧面板用 `__global_regex_workspace__` 作为无会话时的全局 owner。

## 3. 脚本字段

| 字段 | 说明 |
|------|------|
| `scriptKey` | 脚本索引键 |
| `scriptName` | 脚本名称 |
| `findRegex` | 匹配表达式 |
| `replaceString` | 替换模板 |
| `trimStrings` | 匹配结果裁剪 |
| `placement` | 作用位置数组 |
| `disabled` | 是否禁用 |
| `substituteRegex` | 宏替换模式 |
| `markdownOnly/promptOnly/runOnEdit` | 执行条件 |
| `minDepth/maxDepth` | 消息深度约束 |
| `source/sourceId` | global/character/preset 来源 |

## 4. Placement

| 值 | 业务含义 |
|----|----------|
| `USER_INPUT` | 用户输入 |
| `AI_OUTPUT` | AI 输出 |
| `SLASH_COMMAND` | Slash command |
| `WORLD_INFO` | 世界书内容 |
| `REASONING` | AI reasoning 块 |

## 5. 页面交互

- 查看全局/作用域脚本列表。
- 新增、编辑、删除脚本。
- 导入脚本。
- 切换启用状态。
- 管理 allow list。
- 管理 regex preset config。

## 6. 业务规则

- 正则脚本不是 UI 装饰，它影响 prompt、输出和脚本运行结果。
- 授权列表默认拒绝未显式允许的角色/预设脚本参与合并执行。
- `substituteRegex` 决定 findRegex 是否做宏替换以及是否转义。
- 不合法的正则表达式应在编辑/执行时显式报错。

## 7. 数据依赖

- `components/regex-editor/RegexScriptEditor.tsx`
- `components/panels/RegexPanel.tsx`
- `function/regex/*`
- `lib/models/regex-script-model.ts`
- `lib/data/roleplay/regex-script-operation.ts`
- `lib/core/regex-processor.ts`
