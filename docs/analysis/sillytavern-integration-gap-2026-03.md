# DreamMiniStage 对齐审计（SillyTavern + JS-Slash-Runner + MagVarUpdate）

> 审计日期：2026-03-03  
> 对比目标：
> - `sillytavern-plugins/SillyTavern`
> - `sillytavern-plugins/JS-Slash-Runner`
> - `sillytavern-plugins/MagVarUpdate`

## 1. 本轮复评结论（先给结论）

- 当前 gap **仍不算小**，不满足“进入 Playwright E2E”条件。
- 相比上一轮，基础能力和回归稳定性已明显改善，但核心迁移指标仍偏低：
  - SillyTavern Slash 命令覆盖：**24.42%**
  - JS-Slash-Runner TavernHelper API 覆盖：**60.77%**
- 结论：继续做“高价值缺口收敛”比直接做 E2E 更划算，E2E 先作为下一阶段 gate。

### 1.1 2026-03-03 P0 增量执行结果

- `registerFunctionTool` 已收敛到单一状态源：`extension-handlers` 负责注册/调用/清理，`tool-handlers` 仅保留适配导出，消除双注册表漂移。
- `LLMNodeTools`（含 Claude 分支）已打通 `tool_calls -> invokeScriptTool -> iframe callback -> 结果拼接回传` 链路。
- 变量 API 已补齐：`registerVariableSchema`、`updateVariablesWith`、`insertVariables`（shim + handler 同步，参数不合法 fail-fast）。
- `ScriptSandbox` 卸载链路已增加工具清理：除监听器外同步清理 function tools / slash ownership，避免跨 iframe 生命周期残留。
- 新增回归覆盖：
  - `hooks/script-bridge/__tests__/extension-lifecycle.test.ts`（同步/异步 callback + 错误 + 超时）
  - `lib/nodeflow/__tests__/llm-node-script-tools.test.ts`（LLM tool_calls 闭环）

### 1.2 2026-03-03 P1 增量执行结果

- MVU 执行器已落地 `strictSet` 语义：`strictSet=false` 时对 `ValueWithDescription` 仅更新值位，`strictSet=true` 时按普通 set 替换整个值。
- `strictTemplate` / `concatTemplateArray` 已接入执行期配置读取（从根 schema 统一透传到 `insert` 模板应用）。
- Slash 条件流已接入宏预处理与表达式求值：`/if`、`/while` 支持 `{{getvar::}}` + 比较运算；未知宏显式 fail-fast。
- `st-baseline-slash-command` 宏条件流相关 `5` 个 skip 已全部解除。
- 新增回归覆盖：
  - `lib/mvu/__tests__/executor-option-semantics.test.ts`
  - `lib/slash-command/__tests__/kernel-core.test.ts`

### 1.3 2026-03-03 P3 增量执行结果（首轮）

- Script Bridge 已补齐 `import_raw` 高频接口：
  - `importRawPreset`
  - `importRawWorldbook`
  - `importRawTavernRegex`
  - `importRawChat`
  - `importRawCharacter`（当前宿主不支持二进制上传路径，显式 fail-fast）
- 已补齐 script buttons / version 相关接口：
  - `getAllEnabledScriptButtons`
  - `getTavernHelperVersion` / `getFrontendVersion` / `getTavernVersion`
  - `updateTavernHelper` / `updateFrontendVersion`（宿主模式显式 fail-fast）
- `shim + handler + capability matrix` 已同步收敛到单一声明面，`api-surface-contract` 可持续校验。
- 新增回归覆盖：
  - `hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts`

### 1.4 2026-03-03 P3 增量执行结果（二轮：extension 管理最小集）

- Script Bridge 已补齐 extension 管理最小 API：
  - `isAdmin`
  - `getTavernHelperExtensionId`
  - `getExtensionType`
  - `getExtensionStatus`
  - `isInstalledExtension`
  - `installExtension` / `uninstallExtension` / `reinstallExtension` / `updateExtension`（宿主模式显式 fail-fast）
- `shim + handler + capability matrix` 已同步收敛到单一声明面，`api-surface-contract` 继续全绿。
- 新增/增强回归覆盖：
  - `hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts`（extension 读接口 + 写接口 fail-fast）

### 1.5 2026-03-03 P2 增量执行结果（checkpoint 命令族首轮）

- Slash Registry 已补齐 checkpoint 高频命令最小集：
  - `checkpoint-create`
  - `checkpoint-get`
  - `checkpoint-list`
  - `checkpoint-go`
  - `checkpoint-exit`
  - `checkpoint-parent`
- 兼容面同步补齐：
  - 新增 `go -> character` 别名路由，补齐常见脚本中的角色跳转入口。
  - checkpoint 命令默认按当前消息上下文执行，参数错误（非法/越界 `mesId`）显式 fail-fast。
- 命令语义：
  - 支持 `mesId/mes` 双命名参数读取消息索引。
  - `checkpoint-list links=true` 返回 checkpoint 名称列表；默认返回消息索引列表。
  - `checkpoint-go -> checkpoint-parent -> checkpoint-exit` 形成最小会话闭环。
- 样本频次采样：
  - 基于 `test-baseline-assets` + 上游脚本样本（`SillyTavern/public/scripts`）抽样，当前高频缺口头部集中在 `api / fuzzy / reload-page`，checkpoint 家族已从缺口头部移除。

## 2. 审计口径与量化结果

### 2.1 SillyTavern Slash 覆盖（核心差距）

- 上游命令总量：`258`
  - 统计口径：`SillyTavern/public/scripts` 下 `SlashCommand.fromProps({ name: ... })` 唯一命令名。
- 当前命令总量：`126`
  - 统计口径：
    - `lib/slash-command/registry/index.ts` 中 `COMMAND_REGISTRY`；
    - `lib/slash-command/core/parser.ts` 控制命令（`if/while/times/return/break/abort`）；
    - `lib/slash-command/core/executor.ts` 特殊命令（`let/var`）。
- 交集：`63`
- 覆盖率：`63 / 258 = 24.42%`

### 2.2 JS-Slash-Runner TavernHelper API 覆盖

- 上游聚合 API：`130`
  - 统计口径：`JS-Slash-Runner/src/function/index.ts` 中 `getTavernHelper()` 返回对象顶层 key。
- 当前 shim 顶层 API：`117`
  - 统计口径：`public/iframe-libs/slash-runner-shim.js` 中 `window.TavernHelper` 顶层 key。
- 交集：`79`
- 覆盖率：`79 / 130 = 60.77%`

### 2.3 JS-Slash-Runner slash_command 子集

- 子集范围：`event-emit` + `audioenable/audioplay/audioselect/audioimport/audiomode`
- 结果：**6/6 已接入（100%）**
  - 注册点：`lib/slash-command/registry/index.ts`
  - 上游参考：`JS-Slash-Runner/src/slash_command/audio.ts`、`event.ts`

## 3. 回归测试现状

### 3.1 基线回归（本轮已复跑）

执行命令：

```bash
pnpm vitest run \
  lib/core/__tests__/st-baseline-assembly.test.ts \
  lib/core/__tests__/st-baseline-dialogue-flow.test.ts \
  lib/core/__tests__/st-baseline-macro.test.ts \
  lib/core/__tests__/st-baseline-mvu.test.ts \
  lib/core/__tests__/st-baseline-plugin-integration.test.ts \
  lib/core/__tests__/st-baseline-regex.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  lib/core/__tests__/st-baseline-worldbook.test.ts
```

结果：

- `8` files passed
- `267` tests passed
- `5` skipped

### 3.2 高风险增量回归（本轮已复跑）

执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-operators.test.ts \
  lib/slash-command/__tests__/p2-message-command-aliases.test.ts \
  lib/slash-command/__tests__/p2-character-command-gaps.test.ts \
  lib/slash-command/__tests__/p2-variable-scope.test.ts \
  lib/slash-command/__tests__/js-slash-runner-audio.test.ts \
  hooks/script-bridge/__tests__/extension-lifecycle.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  hooks/script-bridge/__tests__/mvu-handlers-option-semantics.test.ts
```

结果：

- `8` files passed
- `55` tests passed

### 3.3 宏条件流回归收敛

- 执行命令：

```bash
pnpm vitest run \
  lib/mvu/__tests__/executor-option-semantics.test.ts \
  lib/core/__tests__/st-baseline-mvu.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  lib/slash-command/__tests__/kernel-core.test.ts
```

- 结果：
  - `4` files passed
  - `131` tests passed
  - `0` skipped（`st-baseline-slash-command` 宏条件流 skip 清零）

### 3.4 P3 API 缺口回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts \
  hooks/script-bridge/__tests__/extension-lifecycle.test.ts \
  hooks/script-bridge/__tests__/plugin-minimal-regression.test.ts \
  lib/script-runner/__tests__/slash-runner-shim-contract.test.ts
```

- 结果：
  - `5` files passed
  - `21` tests passed

### 3.5 P2 checkpoint 命令族回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-checkpoint-command-gaps.test.ts \
  lib/slash-command/__tests__/p2-character-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - `3` files passed
  - `67` tests passed

## 4. 关键缺口（按影响面排序）

### 4.1 Slash 内核能力仍偏轻

- 当前 parser/executor 已支持基础控制流 + 宏条件表达式，但仍缺少上游 parser 的 flags/debug/scope 等完整语义。
- 关键位置：
  - 当前：`lib/slash-command/core/parser.ts`
  - 上游：`SillyTavern/public/scripts/slash-commands/SlashCommandParser.js`

### 4.2 TavernHelper 能力面不完整

- API 覆盖率已提升到 `60.77%` 并跨过 `55%` 门槛，但 shim 仍是“可运行子集”，与上游聚合 API 仍有可见缺口（主要在低频 util/regex/displayed-message 等簇）。
- 关键位置：
  - 当前：`public/iframe-libs/slash-runner-shim.js`
  - 上游：`JS-Slash-Runner/src/function/index.ts`

### 4.3 MVU strict 语义收敛（P1 已完成首轮）

- `strictSet` / `strictTemplate` / `concatTemplateArray` 已从类型位推进到执行位，并补齐专项测试。
- 剩余风险主要在更细粒度的模板边缘场景（深层嵌套对象模板覆盖策略）与上游大样本脚本验证。
- 关键位置：
  - 当前：`lib/mvu/core/executor.ts`
  - 上游：`MagVarUpdate/src/function.ts`

### 4.4 Tool 注册与调用闭环（P0 已完成首轮收敛）

- `registerFunctionTool` 已完成单路径收敛，`tool_calls` 执行闭环可回归通过。
- 剩余风险主要在 `registerSlashCommand` 的 callback 回流形态（当前 shim 注册与宿主执行路径仍未完全等价）。
- 关键位置：
  - `hooks/script-bridge/extension-handlers.ts`
  - `hooks/script-bridge/tool-handlers.ts`
  - `lib/nodeflow/LLMNode/LLMNodeTools.ts`

## 5. 为什么本轮不做 Playwright E2E

本轮判定：**暂缓 E2E，先补核心缺口**。原因：

1. 关键瓶颈已收敛到 Slash 侧：命令覆盖率虽提升到 `24.42%`，但仍低于 `30%` gate，E2E 失败仍将以“已知缺命令”为主。  
2. 虽然 TavernHelper API 覆盖已达 `60.77%`，但 Slash 命令族与 parser 语义仍未达可观测新信息的阶段。  
3. 先完成下一阶段 P2 的命令族补齐后，再用 `test-baseline-assets` 做 Playwright 场景回归，信噪比更高。

## 6. 下一阶段门槛（建议）

进入 Playwright MCP E2E 前，建议至少达到：

- Slash 覆盖率 ≥ `30%`
- TavernHelper API 覆盖率 ≥ `55%`
- `st-baseline-slash-command` 中宏条件流 skip 清零或降到可接受白名单
- Function tool 从注册到 LLM 调用结果回传形成可重复闭环
