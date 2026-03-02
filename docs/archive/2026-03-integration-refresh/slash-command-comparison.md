# SillyTavern Slash Command 兼容性对比文档

> **更新时间**: 2024-12-11
> **测试覆盖**: 23/23 通过
> **实现位置**: `lib/slash-command/`

本文档详细列举 SillyTavern 原版支持的所有 Slash 命令，以及当前项目的实现状态。

---

## 📊 总览

| 类别 | SillyTavern 命令数 | 当前项目已实现 | 覆盖率 |
|------|-------------------|---------------|--------|
| 核心/控制信号 | ~15 | 7 | ~47% |
| 变量命令 | ~25 | 5 | ~20% |
| 控制流命令 | ~10 | 5 | ~50% |
| 消息命令 | ~20 | 7 | ~35% |
| 算子（数学/字符串/数组） | ~25 | 5 | ~20% |
| 角色/群组命令 | ~30 | 0 | 0% |
| World Info 命令 | ~15 | 0 | 0% |
| 扩展/其他 | ~25+ | 0 | 0% |
| **总计** | **~165+** | **~29** | **~18%** |

---

## ✅ 当前项目已实现的命令

| 命令 | 功能 | 实现位置 |
|------|------|----------|
| `/send` | 发送消息到聊天 | `lib/slash-command/registry.ts` |
| `/trigger` | 触发 AI 生成回复 | `lib/slash-command/registry.ts` |
| `/sendas` | 指定角色发送 | `lib/slash-command/registry.ts` |
| `/sys` | 发送系统/旁白消息 | `lib/slash-command/registry.ts` |
| `/impersonate` | AI 扮演用户回复 | `lib/slash-command/registry.ts` |
| `/continue` `/cont` | 继续生成（回退到 trigger） | `lib/slash-command/registry.ts` |
| `/swipe` | 透传 swipe 回调 | `lib/slash-command/registry.ts` |
| `/setvar` | 设置变量 | `lib/slash-command/registry.ts` |
| `/getvar` | 获取变量值 | `lib/slash-command/registry.ts` |
| `/delvar` | 删除变量 | `lib/slash-command/registry.ts` |
| `/let` `/var` | 作用域变量写入 | `lib/slash-command/core/executor.ts` |
| `/if` `/while` `/times` | 控制流块执行 | `lib/slash-command/core/parser.ts` / `core/executor.ts` |
| `/echo` | 回显文本（调试用） | `lib/slash-command/registry.ts` |
| `/pass` | 透传 pipe 值 | `lib/slash-command/registry.ts` |
| `/return` | 终止执行链并返回值 | `lib/slash-command/core/executor.ts` |
| `/add` `/sub` | 数值求和/相减 | `lib/slash-command/registry.ts` |
| `/len` `/trim` | 字符串长度/裁剪 | `lib/slash-command/registry.ts` |
| `/push` | 数组 append | `lib/slash-command/registry.ts` |

---

## 📋 SillyTavern 完整命令列表

### 1. 核心/系统命令 (Core)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/help` | `/?` | 显示帮助信息 | ❌ 未实现 |
| `/abort` | - | 中止脚本执行 | ⚠️ 部分（内核控制信号） |
| `/break` | - | 跳出循环或闭包 | ⚠️ 部分（循环内生效） |
| `/breakpoint` | - | 设置调试断点 | ❌ 未实现 |
| `/echo` | - | 回显文本到控制台 | ✅ 已实现 |
| `/pass` | - | 透传 pipe 值 | ✅ 已实现 |
| `/return` | - | 从闭包返回值 | ✅ 已实现（终止执行链） |
| `/run` | `/:` | 执行闭包或 Quick Reply | ❌ 未实现 |
| `/import` | - | 导入外部脚本 | ❌ 未实现 |
| `/parser-flag` | - | 设置解析器标志 | ❌ 未实现 |
| `/comment` | `//`, `/#` | 注释（不执行） | ❌ 未实现 |

### 2. 变量命令 (Variables)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/setvar` | `/setchatvar` | 设置本地变量 | ⚠️ 部分（缺 index/as/global） |
| `/getvar` | `/getchatvar` | 获取本地变量 | ⚠️ 部分（缺 index/数字转换） |
| `/addvar` | `/addchatvar` | 变量值相加 | ❌ 未实现 |
| `/incvar` | `/incchatvar` | 变量值 +1 | ❌ 未实现 |
| `/decvar` | `/decchatvar` | 变量值 -1 | ❌ 未实现 |
| `/flushvar` | `/flushchatvar` | 删除本地变量 | ⚠️ 部分 (`/delvar`) |
| `/setglobalvar` | - | 设置全局变量 | ❌ 未实现 |
| `/getglobalvar` | - | 获取全局变量 | ❌ 未实现 |
| `/addglobalvar` | - | 全局变量值相加 | ❌ 未实现 |
| `/incglobalvar` | - | 全局变量值 +1 | ❌ 未实现 |
| `/decglobalvar` | - | 全局变量值 -1 | ❌ 未实现 |
| `/flushglobalvar` | - | 删除全局变量 | ❌ 未实现 |
| `/listvar` | `/listchatvar` | 列出所有变量 | ❌ 未实现 |
| `/let` | `/var` | 声明作用域变量 | ⚠️ 部分（作用域栈，未持久化） |

### 3. 控制流命令 (Control Flow)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/if` | 条件判断 | ⚠️ 部分（块语法 + truthy 判断） |
| `/while` | 循环执行 | ⚠️ 部分（块语法 + truthy 判断） |
| `/times` | 重复执行 N 次 | ⚠️ 部分（块语法） |
| `/for` | 遍历数组/对象 | ❌ 未实现 |
| `/break` | 跳出循环 | ⚠️ 部分（支持退出当前块） |
| `/continue` | 继续下一次循环 | ❌ 未实现（消息版 `/continue` 已实现） |

### 4. 数学运算命令 (Math)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/add` | 加法 | ⚠️ 部分（基础数值求和） |
| `/sub` | 减法 | ⚠️ 部分（基础数值相减） |
| `/mul` | 乘法 | ❌ 未实现 |
| `/div` | 除法 | ❌ 未实现 |
| `/mod` | 取模 | ❌ 未实现 |
| `/pow` | 幂运算 | ❌ 未实现 |
| `/sin` | 正弦 | ❌ 未实现 |
| `/cos` | 余弦 | ❌ 未实现 |
| `/log` | 对数 | ❌ 未实现 |
| `/abs` | 绝对值 | ❌ 未实现 |
| `/sqrt` | 平方根 | ❌ 未实现 |
| `/round` | 四舍五入 | ❌ 未实现 |
| `/floor` | 向下取整 | ❌ 未实现 |
| `/ceil` | 向上取整 | ❌ 未实现 |
| `/max` | 最大值 | ❌ 未实现 |
| `/min` | 最小值 | ❌ 未实现 |
| `/rand` | 随机数 | ❌ 未实现 |

### 5. 消息命令 (Messages)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/send` | - | 发送用户消息 | ⚠️ 部分（at/name/return 基础版） |
| `/trigger` | - | 触发 AI 生成 | ⚠️ 部分（await/member/锁 基础版） |
| `/sendas` | - | 以指定角色发送消息 | ⚠️ 部分（回调优先，fallback 文本前缀） |
| `/sys` | `/narrator` | 发送系统/旁白消息 | ⚠️ 部分（需回调，fallback `[SYS]`） |
| `/comment` | - | 发送评论消息 | ❌ 未实现 |
| `/impersonate` | `/imp` | AI 扮演用户回复 | ⚠️ 部分（需回调，fallback send+trigger） |
| `/continue` | `/cont` | 继续生成 | ⚠️ 部分（调用 onContinue/trigger） |
| `/swipe` | - | 切换回复 swipe | ⚠️ 部分（仅透传回调，占位） |
| `/swipes-count` | - | 获取 swipe 数量 | ❌ 未实现 |
| `/swipes-go` | - | 跳转到指定 swipe | ❌ 未实现 |
| `/swipes-del` | - | 删除当前 swipe | ❌ 未实现 |
| `/del` | - | 删除消息 | ❌ 未实现 |
| `/cut` | - | 剪切消息 | ❌ 未实现 |
| `/hide` | - | 隐藏消息 | ❌ 未实现 |
| `/unhide` | - | 显示隐藏消息 | ❌ 未实现 |
| `/edit` | - | 编辑消息 | ❌ 未实现 |
| `/getmessage` | `/getmes` | 获取消息内容 | ❌ 未实现 |
| `/setmessage` | `/setmes` | 设置消息内容 | ❌ 未实现 |
| `/messages` | `/mes` | 获取消息列表 | ❌ 未实现 |
| `/message-on` | - | 启用消息 | ❌ 未实现 |
| `/message-off` | - | 禁用消息 | ❌ 未实现 |

### 6. 聊天管理命令 (Chat Management)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/newchat` | - | 开始新聊天 | ❌ 未实现 |
| `/delchat` | - | 删除当前聊天 | ❌ 未实现 |
| `/renamechat` | - | 重命名聊天 | ❌ 未实现 |
| `/getchatname` | - | 获取聊天名称 | ❌ 未实现 |
| `/closechat` | - | 关闭当前聊天 | ❌ 未实现 |
| `/tempchat` | - | 开启临时聊天 | ❌ 未实现 |
| `/chat-manager` | `/manage-chats` | 打开聊天管理器 | ❌ 未实现 |
| `/forcesave` | - | 强制保存聊天 | ❌ 未实现 |
| `/go` | `/goto` | 跳转到指定消息 | ❌ 未实现 |

### 7. 角色命令 (Characters)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/char` | `/character` | 切换角色 | ❌ 未实现 |
| `/char-find` | `/findchar` | 查找角色 | ❌ 未实现 |
| `/dupe` | - | 复制角色 | ❌ 未实现 |
| `/rename-char` | - | 重命名角色 | ❌ 未实现 |
| `/avatar` | - | 设置角色头像 | ❌ 未实现 |
| `/persona` | - | 切换用户人设 | ❌ 未实现 |
| `/lock` | - | 锁定角色 | ❌ 未实现 |
| `/unlock` | - | 解锁角色 | ❌ 未实现 |

### 8. 群组命令 (Groups)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/group` | 切换群组 | ❌ 未实现 |
| `/memberadd` | 添加群组成员 | ❌ 未实现 |
| `/memberremove` | 移除群组成员 | ❌ 未实现 |
| `/memberup` | 成员上移 | ❌ 未实现 |
| `/memberdown` | 成员下移 | ❌ 未实现 |
| `/peek` | 查看群组成员 | ❌ 未实现 |
| `/activate` | 激活群组成员 | ❌ 未实现 |
| `/deactivate` | 停用群组成员 | ❌ 未实现 |

### 9. World Info / Lorebook 命令

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/world` | - | 切换 World Info | ❌ 未实现 |
| `/getchatbook` | `/getchatlore` | 获取聊天 lorebook | ❌ 未实现 |
| `/getcharbook` | `/getcharlore` | 获取角色 lorebook | ❌ 未实现 |
| `/getglobalbooks` | `/getgloballore` | 获取全局 lorebook | ❌ 未实现 |
| `/getpersonabook` | `/getpersonalore` | 获取人设 lorebook | ❌ 未实现 |
| `/findentry` | `/findlore` | 查找条目 | ❌ 未实现 |
| `/getentryfield` | `/getlorefield` | 获取条目字段 | ❌ 未实现 |
| `/setentryfield` | `/setlorefield` | 设置条目字段 | ❌ 未实现 |
| `/createentry` | `/createlore` | 创建条目 | ❌ 未实现 |
| `/wi-set-timed-effect` | - | 设置定时效果 | ❌ 未实现 |
| `/wi-get-timed-effect` | - | 获取定时效果 | ❌ 未实现 |

### 10. API/连接命令 (API & Connection)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/api` | 切换 API | ❌ 未实现 |
| `/model` | 切换模型 | ❌ 未实现 |
| `/preset` | 切换预设 | ❌ 未实现 |
| `/instruct` | 切换 instruct 模板 | ❌ 未实现 |
| `/instruct-on` | 启用 instruct 模式 | ❌ 未实现 |
| `/instruct-off` | 禁用 instruct 模式 | ❌ 未实现 |
| `/context` | 切换 context 模板 | ❌ 未实现 |
| `/tokenizer` | 切换分词器 | ❌ 未实现 |
| `/profile` | 切换连接配置 | ❌ 未实现 |
| `/server` | 设置服务器地址 | ❌ 未实现 |

### 11. UI/显示命令 (UI & Display)

| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/bg` | `/background` | 设置背景 | ❌ 未实现 |
| `/theme` | - | 切换主题 | ❌ 未实现 |
| `/panels` | `/togglepanels` | 切换面板 | ❌ 未实现 |
| `/resetpanels` | `/resetui` | 重置面板 | ❌ 未实现 |
| `/vn` | - | 切换视觉小说模式 | ❌ 未实现 |
| `/movingui` | - | 切换 MovingUI 预设 | ❌ 未实现 |
| `/css-var` | - | 设置 CSS 变量 | ❌ 未实现 |

### 12. 字符串处理命令 (String Operations)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/len` | 获取字符串长度 | ⚠️ 部分（基础实现） |
| `/trim` | 去除首尾空白 | ⚠️ 部分（基础实现） |
| `/split` | 分割字符串 | ❌ 未实现 |
| `/join` | 连接数组 | ❌ 未实现 |
| `/replace` | 替换字符串 | ❌ 未实现 |
| `/slice` | 截取字符串 | ❌ 未实现 |
| `/find` | 查找子串 | ❌ 未实现 |
| `/lower` | 转小写 | ❌ 未实现 |
| `/upper` | 转大写 | ❌ 未实现 |

### 13. 数组/对象命令 (Array & Object)

| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/getindex` | 获取数组元素 | ❌ 未实现 |
| `/setindex` | 设置数组元素 | ❌ 未实现 |
| `/push` | 数组追加 | ⚠️ 部分（仅 append） |
| `/pop` | 数组弹出 | ❌ 未实现 |
| `/shift` | 数组头部弹出 | ❌ 未实现 |
| `/unshift` | 数组头部插入 | ❌ 未实现 |
| `/sort` | 数组排序 | ❌ 未实现 |
| `/reverse` | 数组反转 | ❌ 未实现 |
| `/filter` | 数组过滤 | ❌ 未实现 |
| `/map` | 数组映射 | ❌ 未实现 |
| `/reduce` | 数组归约 | ❌ 未实现 |
| `/object` | 创建对象 | ❌ 未实现 |
| `/keys` | 获取对象键 | ❌ 未实现 |
| `/values` | 获取对象值 | ❌ 未实现 |

### 14. 扩展命令 (Extensions)

#### TTS (文字转语音)
| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/speak` | 朗读文本 | ❌ 未实现 |
| `/tts-on` | 启用 TTS | ❌ 未实现 |
| `/tts-off` | 禁用 TTS | ❌ 未实现 |

#### Expressions (表情)
| 命令 | 别名 | 功能 | 当前状态 |
|------|------|------|----------|
| `/expression-set` | `/sprite`, `/emote` | 设置表情 | ❌ 未实现 |
| `/expression-list` | `/expressions` | 列出表情 | ❌ 未实现 |
| `/expression-last` | `/lastsprite` | 获取上次表情 | ❌ 未实现 |
| `/expression-classify` | `/classify` | 分类表情 | ❌ 未实现 |

#### Data Bank (数据库)
| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/db` | 打开数据库 | ❌ 未实现 |
| `/db-list` | 列出附件 | ❌ 未实现 |
| `/db-get` | 获取附件内容 | ❌ 未实现 |
| `/db-add` | 添加附件 | ❌ 未实现 |
| `/db-update` | 更新附件 | ❌ 未实现 |
| `/db-delete` | 删除附件 | ❌ 未实现 |
| `/db-enable` | 启用附件 | ❌ 未实现 |
| `/db-disable` | 禁用附件 | ❌ 未实现 |

#### Reasoning (推理)
| 命令 | 功能 | 当前状态 |
|------|------|----------|
| `/reasoning-get` | 获取推理内容 | ❌ 未实现 |
| `/reasoning-set` | 设置推理内容 | ❌ 未实现 |
| `/reasoning-parse` | 解析推理 | ❌ 未实现 |
| `/reasoning-template` | 推理模板 | ❌ 未实现 |

---

## 🔧 实现优先级建议

### P0 - 核心功能 (立即需要)
1. `/send` 参数补齐（`at`/`name`/`compact`/`return`），空文本/`...` 行为对齐
2. `/trigger` 返回空字符串并增加 await/生成锁/群组成员选择
3. 变量命令：`/flushvar` 别名、`index`/`as`、本地/全局分离与数字转换
4. 控制流条件：支持表达式求值或将聊天变量注入作用域（`/if someVar` 可用）
5. 返回值契约：`return=`/错误传播与管道一致性

### P1 - 高频使用
1. `/sendas` `/sys` `/impersonate` 对接正式渲染/消息类型
2. `/continue` `/swipe` 与实际生成/多候选状态联动
3. `/comment` 等消息类型补齐
4. 角色/群组命令的最小子集

### P2 - 增强功能
1. 数学运算命令完善 (`/mul` `/div` `/mod` `/rand` 等)
2. 字符串处理命令 (`/split`, `/join`, `/replace`)
3. 数组操作命令 (`/pop`, `/shift`, `/filter`, `/map`)

### P3 - 完整兼容
1. World Info 命令
2. 群组命令
3. 扩展命令

---

## 📝 架构差异说明

### 解析器差异
- **SillyTavern**: 完整的递归下降解析器，支持闭包 `{: ... :}`、宏替换 `{{var::name}}`、parser flags、return 类型枚举。
- **当前项目**: 内核解析器支持块/控制流/命名参数，但缺少宏、parser flags、return 类型与复杂表达式。

### 作用域差异
- **SillyTavern**: 层级链式作用域 (`SlashCommandScope`)，支持变量冒泡与 chat/global 作用域协同。
- **当前项目**: 链式作用域仅供 `/let|/var`/块内使用，聊天变量通过上下文 Map，二者未自动互通。

### 执行模型差异
- **SillyTavern**: Generator + 异步迭代，支持暂停/恢复/调试/断点。
- **当前项目**: 内核执行器为 async generator，支持 `return`/`break`/`abort` 信号，但无调试/await 选项与并发保护。

---

*文档生成时间: 2025-12-10*
*基于 SillyTavern 最新版本分析*
