# SillyTavern 宏替换机制与宏命令列表

本文梳理宏替换管线、内置宏及可注册宏，便于查阅和编写模板。

---

## 宏替换管线概览
- 入口：`evaluateMacros(content, env, postProcessFn)`（`public/scripts/macros.js`）。
- 流程：`preEnvMacros` → `envMacros`（基于传入 env 及注册宏）→ `postEnvMacros`，顺序替换。
- 特性：
  - 若内容不含 `{{` 且宏正则非 legacy/尖括号，快速退出。
  - 替换失败仅告警，不中断整体流程。
  - `postProcessFn` 默认恒等，可由调用方追加处理。
  - `Handlebars` helper：`trim` 保留占位，最终由宏规则删除；`helperMissing` 把未知 helper 退回 `substituteParams("{{...}}")`。

---

## preEnv 宏（先于 env 变量）
| 宏 | 作用 | 位置 |
| --- | --- | --- |
| `<USER>` `<BOT>` `<CHAR>` `<CHARIFNOTGROUP>` `<GROUP>` | legacy 占位，替换为 env 中对应 user/char/group | `macros.js preEnvMacros` |
| `{{roll X}}` | 骰子：`X` 为公式或面数，验证失败返回空 | `getDiceRollMacro` |
| Instruct 宏组（如 `{{instructInput}}`, `{{instructOutput}}`, `{{instructStoryStringPrefix}}`, `{{systemPrompt}}` 等同义词） | 取自 `power_user.instruct`/`sysprompt`/`context`，仅在对应开关启用时输出，否则为空 | `getInstructMacros` |
| 变量宏组：`setvar/addvar/incvar/decvar/getvar` + 全局版 `setglobalvar/addglobalvar/incglobalvar/decglobalvar/getglobalvar` | 读写局部/全局变量，除 get* 以外都替换为空 | `getVariableMacros` |
| `{{newline}}` | 换行 | |
| `{{trim}}` | 删除自身与周围多余换行 | |
| `{{noop}}` | 删除自身 | |
| `{{input}}` | 当前发送框文本 | |

---

## env 宏（基于调用方提供的 env + 注册宏）
- 调用方传入的 `env` 键会生成 `{{key}}` 的替换，值若为函数则先调用（传入 nonce），再做类型清洗。
- `MacrosParser.populateEnv(env)` 会把所有通过 `MacrosParser.registerMacro` 注册的宏注入 env，使其同样以 `{{key}}` 替换。

### 当前已注册的宏（通过 `registerMacro`）
| 宏 | 值/作用 | 定义位置 |
| --- | --- | --- |
| `lastGenerationType` | 最近一次生成类型（normal/continue 等），聊天切换会清空 | `macros.js initMacros` |
| `isMobile` | 是否移动端（字符串） | `macros.js initMacros` |
| `reasoningPrefix` / `reasoningSuffix` / `reasoningSeparator` | 当前推理模板的前后缀与分隔符 | `reasoning.js registerReasoningMacros` |
| `summary` | 记忆扩展的最新总结（若存在） | `extensions/memory/index.js` |
| `charPrefix` / `charNegativePrefix` | 角色正/反向图像生成前缀 | `extensions/stable-diffusion/index.js` |
| `authorsNote` / `charAuthorsNote` / `defaultAuthorsNote` | 作者注、角色作者注、默认作者注 | `authors-note.js` |

> 其它扩展可继续注册新宏；以上为仓库内默认注册项。

---

## postEnv 宏（后于 env 变量）
| 宏 | 作用 | 位置 |
| --- | --- | --- |
| `{{maxPrompt}}` | 当前最大上下文 | `macros.js postEnvMacros` |
| `{{lastMessage}}` / `{{lastMessageId}}` | 最后一条消息内容/ID | |
| `{{lastUserMessage}}` / `{{lastCharMessage}}` | 最后用户/角色消息 | |
| `{{firstIncludedMessageId}}` / `{{firstDisplayedMessageId}}` | 首条纳入/展示的消息 ID | |
| `{{lastSwipeId}}` / `{{currentSwipeId}}` | 末次/当前滑动编号（1-based） | |
| `{{reverse:TEXT}}` | 文本倒序 | |
| `{{// ...}}` | 注释，删除 | |
| 时间日期：`{{time}}` `{{date}}` `{{weekday}}` `{{isotime}}` `{{isodate}}` `{{datetimeformat FORMAT}}` | 本地化时间/日期格式化 | |
| `{{idle_duration}}` | 距离上次用户消息的时间（人类可读） | |
| `{{time_UTC+X}}` | 指定 UTC 偏移的时间 | |
| `{{timeDiff::t1::t2}}` | t1 与 t2 的时间差（人类可读） | |
| `{{outlet::key}}` | 读取扩展自定义 WI outlet 文本 | |
| `{{banned "word"}}` | 记录 banned word（textgen 路径添加到 ban 列表），输出空 | `getBannedWordsMacro` |
| 随机选择：`{{random::a::b::c}}` 或 `{{random a,b,c}}` | 基于非持久 RNG 的随机选项 | `getRandomReplaceMacro` |
| 稳定选择：`{{pick::a::b}}` 或 `{{pick a,b}}` | 基于 chat+内容位置的种子，稳定选择 | `getPickReplaceMacro` |

---

## 变量宏详解（局部/全局）
| 宏 | 作用 | 作用域 |
| --- | --- | --- |
| `{{setvar::name::value}}` | 设定局部变量 name=value，输出空 | 局部 |
| `{{addvar::name::value}}` | 若可数则累加，否则字符串拼接，输出空 | 局部 |
| `{{incvar::name}}` / `{{decvar::name}}` | +1 / -1，输出空 | 局部 |
| `{{getvar::name}}` | 读取局部变量并输出 | 局部 |
| `{{setglobalvar::name::value}}` | 设定全局变量，输出空 | 全局 |
| `{{addglobalvar::name::value}}` | 全局累加/拼接，输出空 | 全局 |
| `{{incglobalvar::name}}` / `{{decglobalvar::name}}` | 全局 +1 / -1，输出空 | 全局 |
| `{{getglobalvar::name}}` | 读取全局变量并输出 | 全局 |

局部变量存于当前聊天的 `chat_metadata.variables`，全局变量存于 `extension_settings.variables.global`。

---

## Instruct 模板宏列表（仅启用 instruct 时生效）
- 输入/输出序列：`{{instructInput}}`/`{{instructUserPrefix}}`，`{{instructUserSuffix}}`，`{{instructOutput}}`/`{{instructAssistantPrefix}}`，`{{instructSeparator}}`/`{{instructAssistantSuffix}}`。
- 首/末输入输出：`{{instructFirstInput}}`/`{{instructLastInput}}`，`{{instructFirstOutput}}`/`{{instructLastOutput}}`。
- 系统序列：`{{instructSystemPrefix}}`/`{{instructSystemSuffix}}`，`{{instructSystemInstructionPrefix}}`。
- 其它：`{{instructStoryStringPrefix}}`，`{{instructStoryStringSuffix}}`，`{{instructStop}}`，`{{instructUserFiller}}`。
- 系统/上下文模板：`{{systemPrompt}}`，`{{defaultSystemPrompt}}`/`{{instructSystem}}`/`{{instructSystemPrompt}}`，`{{chatSeparator}}`，`{{chatStart}}`。

---

## 使用提示
- 需要保留 `{{...}}` 原样传给模型时，可使用未知 helper（触发 helperMissing）或在上游禁用宏替换。
- `{{trim}}` 适合放在模板末尾清理空行。
- 随机宏：`random` 不稳定（每次随机），`pick` 稳定（基于 chat/位置种子）。
- 变量宏写入后可用 `{{getvar}}`/`{{getglobalvar}}` 或脚本读取，适合在 PromptManager 或模板中传递控制信号。
