# 斜杠命令参考

## 概述

DreamMiniStage 支持在对话输入框中使用斜杠命令（`/command`）直接执行操作。命令支持管道（`|`）链接、引号参数、控制流（return/break/abort）和 MVU 变量读写。

---

## 消息命令

| 命令 | 语法 | 说明 |
|------|------|------|
| `/send` | `/send {message}` | 发送用户消息 |
| `/sendAs` | `/sendAs {name} {message}` | 以指定角色名发送消息 |
| `/impersonate` | `/impersonate {message}` | 以用户人格身份发送消息 |
| `/narrate` | `/narrate {message}` | 发送旁白/叙述消息 |
| `/continue` | `/continue` | 让 AI 继续上一条回复 |

## 生成控制

| 命令 | 语法 | 说明 |
|------|------|------|
| `/trigger` | `/trigger` | 触发 AI 生成回复 |
| `/swipe` | `/swipe` | 为最后一条 AI 回复生成替代版本 |
| `/regenerate` | `/regenerate` | 重新生成最后一条 AI 回复 |

## 检查点

| 命令 | 语法 | 说明 |
|------|------|------|
| `/checkpointCreate` | `/checkpointCreate {name}` | 在当前位置创建存档点 |
| `/checkpointGo` | `/checkpointGo {name}` | 恢复到指定存档点 |
| `/checkpointList` | `/checkpointList` | 列出所有存档点 |
| `/checkpointParent` | `/checkpointParent` | 跳转到父检查点 |
| `/checkpointExit` | `/checkpointExit` | 退出检查点模式 |

## 控制流

| 命令 | 语法 | 说明 |
|------|------|------|
| `/echo` | `/echo {text}` | 输出文本（不发送给 AI） |
| `/help` | `/help` | 显示命令帮助 |
| `/pass` | `/pass` | 空操作（管道占位） |
| `/return` | `/return {value}` | 返回值并终止命令链 |

## 角色命令

| 命令 | 语法 | 说明 |
|------|------|------|
| `/character` | `/character {name}` | 加载指定角色 |
| `/characterFind` | `/characterFind {keyword}` | 搜索角色 |
| `/ask` | `/ask {field}` | 查询角色元数据字段 |
| `/random` | `/random` | 加载随机角色 |
| `/dupe` | `/dupe` | 复制当前角色 |
| `/renameCharacter` | `/renameCharacter {name}` | 重命名当前角色 |

## 数学运算

| 命令 | 语法 | 说明 |
|------|------|------|
| `/add` | `/add {a} {b}` | 加法 a + b |
| `/sub` | `/sub {a} {b}` | 减法 a - b |
| `/mul` | `/mul {a} {b}` | 乘法 a * b |
| `/div` | `/div {a} {b}` | 除法 a / b |
| `/mod` | `/mod {a} {b}` | 取余 a % b |
| `/pow` | `/pow {a} {b}` | 幂运算 a ^ b |
| `/max` | `/max {a} {b} ...` | 取最大值 |
| `/min` | `/min {a} {b} ...` | 取最小值 |
| `/rand` | `/rand {min} {max}` | 随机数 |
| `/sin` | `/sin {x}` | 正弦 |
| `/cos` | `/cos {x}` | 余弦 |
| `/log` | `/log {x}` | 对数 |
| `/abs` | `/abs {x}` | 绝对值 |
| `/sqrt` | `/sqrt {x}` | 平方根 |
| `/round` | `/round {x}` | 四舍五入 |

## 字符串操作

| 命令 | 语法 | 说明 |
|------|------|------|
| `/len` | `/len {text}` | 字符串长度 |
| `/split` | `/split {delimiter} {text}` | 分割字符串 |
| `/join` | `/join {delimiter} {array}` | 合并数组 |
| `/replace` (或 `/re`) | `/replace {pattern} {replacement} {text}` | 正则替换 |

## 数据银行 (Data Bank)

| 命令 | 语法 | 说明 |
|------|------|------|
| `/databank` | `/databank` | 列出所有数据银行条目 |
| `/databankGet` | `/databankGet {key}` | 获取条目值 |
| `/databankAdd` | `/databankAdd {key} {value}` | 添加条目 |
| `/databankUpdate` | `/databankUpdate {key} {value}` | 更新条目 |
| `/databankDelete` | `/databankDelete {key}` | 删除条目 |
| `/databankSearch` | `/databankSearch {query}` | 搜索条目 |
| `/databankIngest` | `/databankIngest {data}` | 批量导入 |
| `/databankPurge` | `/databankPurge` | 清空所有条目 |

## 变量管理

| 命令 | 语法 | 说明 |
|------|------|------|
| `/set` | `/set {key}={value}` | 设置变量 |
| `/get` | `/get {key}` | 获取变量值 |

## 其他命令

| 类别 | 命令 | 说明 |
|------|------|------|
| API | `/api {method} {url}` | 发起 HTTP 请求 |
| 事件 | `/event {type} {data}` | 发出自定义事件 |
| 消息 | 消息操作系列 | 消息增删改操作 |
| JS 执行 | `/js {code}` | 在沙箱中执行 JavaScript |
| 系统提示 | 系统提示系列 | 管理系统提示内容 |
| 世界书 | `/lore` 系列 | 世界书条目操作 |
| 生成 | 生成控制系列 | 生成参数调整 |
| UI | UI 操作系列 | 弹窗、动画、字幕 |
| 工具 | 工具系列 | 工具调用相关 |

## 管道语法

命令支持通过 `|` 管道符链接，前一个命令的输出作为后一个命令的输入：

```
/get hp | /sub 10 | /set hp=
```

上例：获取 hp 变量值 → 减去 10 → 写回 hp 变量。

## 宏变量

命令参数中支持使用宏变量：

| 宏 | 替换为 |
|----|--------|
| `{{char}}` | 当前角色名 |
| `{{user}}` | 当前用户名/人格名 |
| `{{persona}}` | 人格描述 |
| `{{time}}` | 当前时间 |
| `{{date}}` | 当前日期 |
| `{{random}}` | 随机数 |
| `{{input}}` | 用户输入 |
| `{{lastMessage}}` | 最后一条消息 |
