# AI 会话交接文档（2026-03-02）

> 目的：给下一次 AI 会话提供可直接执行的上下文，避免重复审计与重复改造。
> 当前日期：2026-03-02

## 1. 项目目标（本轮不变）

对齐并整合以下三部分能力：

1. `sillytavern-plugins/SillyTavern` 核心流程
2. `sillytavern-plugins/JS-Slash-Runner`
3. `sillytavern-plugins/MagVarUpdate`

并在开发期持续执行“去兼容化”：移除历史数据/旧入口兼容分支，收敛到单路径实现。

---

## 2. 已完成（可视为当前基线）

### 2.1 Workflow 主链路收敛（messages 单轨）

- `HistoryPreNode` 已移除 `chatHistoryText` 输出，仅保留 `chatHistoryMessages + conversationContext`。
- `ContextNode` 已改为纯透传，不再做 `{{chatHistory}}` 字符串替换。
- `LLMNode` 仅消费 `messages[]`，移除字符串 fallback 组装。
- `MemoryRetrievalNode` + `MemoryNodeTools` 已改为直接操作 `messages[]`。
- `PresetNode` / `PresetNodeTools` 不再输出 `systemMessage/userMessage`，只保留 `messages + presetId`。

### 2.2 Script Bridge 去兼容

- `triggerSlash(command, options)` 中 options 覆盖分支已移除。
- 回调统一由 `ApiCallContext` 注入（`onSend/onTrigger/...`）。

### 2.3 iframe shim 去兼容（本轮重点）

- 已移除顶层全局别名注入：
  - 不再导出 `window.getVariables` / `window.triggerSlash` / `window.getChatMessages` 等。
  - 统一通过 `window.TavernHelper` / `window.SillyTavern` 命名空间访问。
- 未实现的群聊 API 已从“静默默认值”改为 **fail-fast**：
  - `getGroupMembers` -> Promise reject
  - `isGroupChat` -> throw Error
- 新增 API 面一致性测试：确保 shim 中声明的 `api("...")/callApi("...")` 都有 script-bridge handler 对应，防止漂移。

### 2.4 文档整理

- 历史阶段文档已归档到 `docs/archive/2026-03-integration-refresh/`。
- 主入口文档已更新，当前结论集中在：
  - `docs/README.md`
  - `docs/analysis/sillytavern-integration-gap-2026-03.md`

### 2.5 Slash 命令覆盖补齐（P2 第一批）

- 已新增高频算子/字符串命令：
  - 数学：`/mul`、`/div`、`/mod`、`/rand`
  - 字符串：`/split`、`/join`、`/replace`（含别名 `/re`）
- 行为约定（当前实现）：
  - `div/mod` 在除数为 0 时显式报错（fail-fast）。
  - `rand` 支持位置参数与 `from/to/round` 命名参数。
  - `replace` 支持 `mode=literal|regex`，`regex` 兼容 `/pattern/flags` 风格。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.6 Slash 命令覆盖补齐（P2 第二批）

- 已新增高频数学命令：
  - `/pow`、`/max`、`/min`
- 行为约定（当前实现）：
  - `pow` 使用顺序幂运算（可消费 pipe 作为首项）。
  - `max/min` 与现有算子一致，支持位置参数与 pipe 输入。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.7 变量 API 参数语义对齐（MagVarUpdate 高频路径）

- `mvu.getVariable/mvu.getVariables` 已补齐上游常见参数形态：
  - `{ type: "chat" | "message" | "global" | "character" | "script", message_id }`
  - 兼容 `messageId` 与 legacy 位置参数（字符串/数字消息引用）
- `message_id` 语义与变量主链路保持一致：
  - 支持 `latest`、负索引、数字字符串
  - 越界时显式报错（fail-fast）
- MVU 会话键选择已收敛为 `chatId > dialogueId > characterId > global`，减少跨会话串写风险。
- 相关实现：
  - `hooks/script-bridge/mvu-handlers.ts`
- 相关测试：
  - `hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`

### 2.8 Slash 命令覆盖补齐（P2 第三批：变量族）

- 已新增变量高频命令与别名（对齐 SillyTavern 示例脚本常见写法）：
  - 本地/别名：`/addvar`、`/setchatvar`、`/getchatvar`、`/addchatvar`、`/incchatvar`、`/decchatvar`、`/flushchatvar`
  - 全局：`/setglobalvar`、`/getglobalvar`、`/addglobalvar`、`/incglobalvar`、`/decglobalvar`、`/flushglobalvar`
- 行为约定（当前实现）：
  - `addvar/addglobalvar` 支持数值累加、字符串拼接、以及 JSON 数组追加（与 ST add*var 的核心路径对齐）。
  - 全局变量命令优先走 `ExecutionContext` 的 scoped 变量接口；若宿主未提供 scoped 能力，则回退到本地变量接口。
  - Script Bridge 侧已拆分本地/全局变量视图，避免 `setglobalvar/getglobalvar` 被角色变量覆盖。
- 相关实现：
  - `lib/slash-command/registry/handlers/variables.ts`
  - `lib/slash-command/registry/index.ts`
  - `hooks/script-bridge/slash-handlers.ts`
  - `lib/slash-command/types.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-variable-scope.test.ts`
  - `hooks/script-bridge/__tests__/api-surface-contract.test.ts`

### 2.9 Slash 命令覆盖补齐（P2 第四批：单参数数学）

- 已新增单参数数学命令：
  - `/sin`、`/cos`、`/log`、`/abs`、`/sqrt`、`/round`
- 行为约定（当前实现）：
  - 支持“位置参数优先，pipe 兜底”的单值取数模式。
  - `log` 在输入 `<= 0` 时显式报错（fail-fast）。
  - `sqrt` 在输入 `< 0` 时显式报错（fail-fast）。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.10 Slash 命令覆盖补齐（P2 第五批：正则匹配）

- 已新增高频正则命令：
  - `/match`
- 行为约定（当前实现）：
  - `pattern` 支持普通文本与 `/pattern/flags` 形式。
  - 非全局正则返回首个匹配数组（未命中返回空字符串）。
  - 全局正则返回匹配数组列表（未命中返回 `[]`）。
- 相关实现：
  - `lib/slash-command/registry/handlers/operators.ts`
  - `lib/slash-command/registry/index.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-operators.test.ts`

### 2.11 Slash 变量语义补齐（P2 第六批：global index/as）

- 已补齐 `set/getglobalvar` 的高频参数语义：
  - `index=...`：支持数组下标与对象键路径写入/读取。
  - `as=...`：支持 `string/number/int/float/bool/array/object/null/undefined` 类型转换。
- 行为约定（当前实现）：
  - `setglobalvar index=...` 统一落盘为 JSON 字符串，避免容器形态漂移。
  - `getglobalvar index=...` 读取对象值时返回 JSON 文本。
  - 索引容器类型不匹配时显式报错（fail-fast），不再静默吞错。
- 相关实现：
  - `lib/slash-command/registry/handlers/variables.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-variable-scope.test.ts`

### 2.12 Slash 变量语义补齐（P2 第七批：local/chat index/as）

- 已补齐 `set/getvar`（含 `set|getchatvar` 别名）的高频参数语义：
  - `index=...`：支持数组下标与对象键路径写入/读取。
  - `as=...`：支持 `string/number/int/float/bool/array/object/null/undefined` 类型转换。
- 行为约定（当前实现）：
  - `setvar index=...` 与 `setglobalvar` 复用同一索引写入骨架，统一落盘为 JSON 字符串。
  - `getvar index=...` 读取对象值时返回 JSON 文本。
  - 索引容器类型不匹配时显式报错（fail-fast），不再静默吞错。
  - 已移除旧式兼容写法：`/setvar name=Bob age=30`（多 named-args 批量赋值）不再支持，命令会 fail-fast 报错。
  - `set/getvar` 与 `set/getglobalvar` 仅接受 `key=...` 命名参数，不再接受 `name=...` 兼容别名。
- 相关实现：
  - `lib/slash-command/registry/handlers/variables.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-variable-scope.test.ts`

### 2.13 Slash 变量语义补齐（P2 第八批：addvar/addglobalvar index 路径追加）

- 已补齐 `addvar/addglobalvar` 的 `index=...` 路径追加语义：
  - 支持对象路径与数组路径（示例：`index=player.hp`、`index=player.tags`）。
  - 路径内数值节点执行累加，路径内数组节点执行追加。
  - 路径类型不匹配时显式报错（fail-fast），不再静默忽略。
- 行为约定（当前实现）：
  - `addvar/addglobalvar` 仅接受 `key/value/index/as` 命名参数，其他命名参数 fail-fast。
  - `index` 支持 `a.b[0].c` / `a.b.0.c` 形式。
  - 路径节点缺失时会按路径类型自动建容器（数组/对象），最终统一回写 JSON 字符串。
- 相关实现：
  - `lib/slash-command/registry/handlers/variables.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-variable-scope.test.ts`

### 2.14 JS-Slash-Runner 命令补齐（P2 第九批：audioplaypause 别名）

- 已补齐历史别名命令：
  - `audioplaypause`（与 `audioplay` 共享参数语义）
- 行为约定（当前实现）：
  - `type=bgm|ambient` 通道解析与 `audioplay` 保持一致。
  - `play=true|false` 语义保持一致；未指定时默认播放。
- 相关实现：
  - `lib/slash-command/registry/handlers/js-slash-runner.ts`
  - `lib/slash-command/registry/index.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/js-slash-runner-audio.test.ts`

### 2.15 Slash 命令覆盖补齐（P2 第十批：消息侧高频别名/列表）

- 已补齐消息侧高频别名与列表命令：
  - 别名：`setmessage/setmes`、`edit`、`del`、`narrator`、`imp`
  - 新增：`messages/mes`（消息快照列表）
- 行为约定（当前实现）：
  - `messages/mes` 默认返回全量消息快照，传入索引时返回单条消息数组。
  - `setmessage/setmes/edit/del/getmessage` 统一使用同一索引规范化逻辑，支持负索引并在越界时报错（fail-fast）。
  - `narrator` 与 `sys` 共用处理器，`imp` 与 `impersonate` 共用处理器，避免双实现漂移。
- 相关实现：
  - `lib/slash-command/registry/handlers/messages.ts`
  - `lib/slash-command/registry/index.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-message-command-aliases.test.ts`

### 2.16 Slash 命令覆盖补齐（P2 第十一批：角色侧最小命令集 + comment）

- 已补齐角色侧最小高频命令与消息注释命令：
  - 角色：`char`、`character`、`char-find`、`findchar`
  - 消息：`comment`（复用系统消息通道）
- 行为约定（当前实现）：
  - `char` 无参数返回当前角色摘要（`{ id, name }`），有参数时尝试切换角色。
  - 当前宿主若未注入 `switchCharacter` 回调，`char` 切换路径显式报错（fail-fast）。
  - `char-find/findchar` 基于角色 `name/id` 做大小写无关匹配并返回数组结果。
  - Script Bridge `slash` 适配层已补齐角色查询能力（`getCurrentCharacter/listCharacters`）。
- 相关实现：
  - `lib/slash-command/registry/handlers/characters.ts`
  - `lib/slash-command/registry/index.ts`
  - `lib/slash-command/types.ts`
  - `hooks/script-bridge/slash-handlers.ts`
  - `hooks/script-bridge/types.ts`
  - `hooks/script-bridge/capability-matrix.ts`
- 相关测试：
  - `lib/slash-command/__tests__/p2-character-command-gaps.test.ts`

---

## 3. 本轮新增/关键文件

### 3.1 代码

- `public/iframe-libs/slash-runner-shim.js`
  - 删除顶层 alias
  - 群聊 API 改为 fail-fast
- `hooks/script-bridge/capability-matrix.ts`
  - 新增脚本桥接能力矩阵单源（shim API + slash command）
- `lib/slash-command/registry/handlers/variables.ts`
  - 新增 add/global 变量命令族，以及 `set/getglobalvar` + `set/getvar` 的 `index/as` 语义对齐
- `hooks/script-bridge/slash-handlers.ts`
  - 变量上下文拆分为 local/global，并暴露 scoped 读写接口
- `lib/slash-command/registry/handlers/operators.ts`
  - 新增 `sin/cos/log/abs/sqrt/round/match` 命令处理器
- `lib/slash-command/registry/handlers/messages.ts`
  - 收敛消息索引解析，并新增 `messages/mes` 快照输出
- `lib/slash-command/registry/handlers/characters.ts`
  - 新增 `char/character/char-find/findchar` 最小角色命令集
- `hooks/script-bridge/slash-handlers.ts`
  - 补齐角色摘要查询适配（当前角色 + 全量角色列表）

### 3.2 测试

- `lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
  - 校验只暴露命名空间入口
  - 校验不再存在 `createStub/createAsyncStub/warnUnimplemented`
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts`
  - 校验 shim API 面与 handler 注册面一致
- `hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
  - JS-Slash-Runner/MagVarUpdate 最小链路回归
- `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`
  - 覆盖 `registerFunctionTool/registerSlashCommand` 的注册、调用、清理、再注册链路
- `hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`
  - 覆盖 MVU `{ type, message_id }` 参数语义与会话键优先级
- `hooks/script-bridge/__tests__/api-surface-contract.test.ts`
  - 通过 `capability-matrix.ts` 同步校验 shim/handler/slash 三侧能力面一致性
- `lib/slash-command/__tests__/p2-variable-scope.test.ts`
  - 覆盖 `addvar/globalvar`、chat/global alias，以及 `set/getglobalvar` + `set/getvar` 的 `index/as` 语义
- `lib/slash-command/__tests__/p2-operators.test.ts`
  - 补充单参数数学、`/match` 与 fail-fast 异常分支回归
- `lib/slash-command/__tests__/p2-message-command-aliases.test.ts`
  - 覆盖消息侧别名（`setmessage/setmes/edit/del/messages/mes`）及核心别名（`narrator/imp`）
- `lib/slash-command/__tests__/p2-character-command-gaps.test.ts`
  - 覆盖 `comment`、`char/character`、`char-find/findchar` 与切换缺失回调 fail-fast 分支

### 3.3 文档

- `hooks/script-bridge/README.md`
- `docs/analysis/sillytavern-integration-gap-2026-03.md`

---

## 4. 已执行验证（命令与结果）

> 注意：测试统一使用 `pnpm vitest run ...`，不要使用 watch 模式。

已通过：

- `pnpm vitest run lib/script-runner/__tests__/slash-runner-shim-contract.test.ts hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- `pnpm vitest run lib/script-runner/__tests__/slash-runner-shim-contract.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts lib/slash-command/__tests__/js-slash-runner-audio.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-variable-scope.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`
- `pnpm vitest run hooks/script-bridge/__tests__/slash-handlers.integration.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/slash-command/__tests__/p2-variable-scope.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-operators.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-variable-scope.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-variable-scope.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-variable-scope.test.ts lib/slash-command/__tests__/p2-operators.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-variable-scope.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts lib/slash-command/__tests__/p2-operators.test.ts hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/variable-handlers.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-message-command-aliases.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`
- `pnpm vitest run lib/slash-command/__tests__/p2-character-command-gaps.test.ts lib/slash-command/__tests__/p2-message-command-aliases.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts`

结果：全部通过。

---

## 5. 当前差距（下一会话应继续）

### 5.1 高优先（建议先做）

1. **变量 API 参数语义对齐**（MagVarUpdate 高频路径）✅ 已完成
   - `mvu.getVariable/mvu.getVariables` 已支持 `{ type, message_id }` 与 `messageId`。
   - `message_id` 已支持 `latest`、负索引、数字字符串，越界 fail-fast。
   - 新增回归：`hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts`。

2. **音频命令语义对齐**（JS-Slash-Runner）✅ 已完成（本会话）
   - `audio*` 已按上游常用参数语义对齐：
     - `/audioplay type=... play=...`：播放/暂停切换
     - `/audiomode`：`repeat|random|single|stop`
     - `/audioimport`：逗号分隔 URL，支持 `play=false`
     - `/audioselect`：不存在则先入列表再播放
   - 相关实现：
     - `lib/slash-command/registry/handlers/js-slash-runner.ts`
     - `hooks/script-bridge/slash-handlers.ts`（补齐按通道音频上下文）
     - `lib/slash-command/types.ts`（扩展通道级音频执行接口）
   - 回归测试：
     - `lib/slash-command/__tests__/js-slash-runner-audio.test.ts`

3. **Slash 命令覆盖继续补齐**（P2 多批次已完成）
- 已补：`mul/div/mod/rand/split/join/replace(re)/pow/max/min`。
- 本轮新增变量族：`addvar/set|get|add|inc|dec|flush globalvar` 与 `set|get|add|inc|dec|flush chatvar` 别名。
- 本轮新增数学族：`sin/cos/log/abs/sqrt/round`。
- 本轮新增正则匹配：`match`。
- 本轮新增变量深度语义：`set/getglobalvar` 与 `set/getvar` 的 `index/as`。
- 本轮新增变量追加语义：`addvar/addglobalvar` 的 `index` 路径内累加/追加。
- 本轮新增 JS-Slash-Runner 音频别名：`audioplaypause`。
- 本轮新增消息侧高频别名/列表：`setmessage/setmes/edit/del/messages/mes`，以及核心别名 `narrator/imp`。
- 本轮新增角色侧最小命令：`char/character/char-find/findchar`，并补 `comment`。
- 脚本采样（SillyTavern + JS-Slash-Runner + MagVarUpdate 文档/示例，忽略 dist 与依赖目录）中消息侧仍有频次缺口：
  - `/messages`：9 次
  - `/comment`：6 次
  - `/edit`：5 次（已补齐）
  - `/character`：2 次（已补最小路径）、`/char-find`：1 次（已补）
- 下一批建议优先（按插件脚本采样）：
  - 打通 `char/character` 真正切换路径（宿主注入 `switchCharacter` 回调并补集成回归）
  - 并行评估 MVU `parseCommandValue` 的 mathjs/YAML 差距并确定是否引入外部依赖
- 仍需按真实插件脚本使用频率推进，不追求盲目全量。

### 5.2 中优先

4. `registerFunctionTool/registerSlashCommand` 生命周期测试继续加深：✅ 已补齐最小回归
   - 已覆盖：注册 -> 调用 -> iframe 清理 -> 再注册。
   - 相关测试：`hooks/script-bridge/__tests__/extension-lifecycle.test.ts`

5. 能力清单单源化：✅ 已完成首版
   - 新增 `hooks/script-bridge/capability-matrix.ts` 作为单源声明。
   - `api-surface-contract.test.ts` 已校验 shim 暴露面、script-bridge handlers、slash registry 三侧一致性。

---

## 6. 执行注意事项（给下一会话）

1. 仓库当前是 **dirty worktree**，大量文件非本任务改动；禁止回滚无关变更。
2. 本项目是新项目，默认 **禁止** 增加“兼容旧代码/旧数据/旧语法”的适配分支；发现已有兼容分支应直接删除并收敛实现。
3. 继续遵循“开发期去兼容化”策略：
   - 优先单路径
   - 失败显式暴露
   - 不做静默 fallback
4. 若新增兼容逻辑，必须先说明“为何不是坏味道”，否则默认应删。
5. 运行测试请使用精确文件级命令，避免全量长跑影响迭代速度。

---

## 7. 下一会话建议起手动作（可直接复制）

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-variable-scope.test.ts \
  lib/slash-command/__tests__/js-slash-runner-audio.test.ts \
  lib/slash-command/__tests__/p2-operators.test.ts \
  lib/slash-command/__tests__/p2-message-command-aliases.test.ts \
  lib/slash-command/__tests__/p2-character-command-gaps.test.ts \
  hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  hooks/script-bridge/__tests__/variable-handlers.test.ts
```

然后优先打通 `char/character` 的宿主切换回调链路（当前仅查询路径可用），并并行评估 MVU `parseCommandValue` 在 mathjs/YAML 场景的语义差距；继续排查变量/脚本桥接链路中的“兼容旧路径”分支，发现即删并补 fail-fast 测试。
