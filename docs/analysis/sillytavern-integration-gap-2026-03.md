# DreamMiniStage 对齐审计（SillyTavern + JS-Slash-Runner + MagVarUpdate）

> 审计日期：2026-03-04  
> 对比目标：
> - `sillytavern-plugins/SillyTavern`
> - `sillytavern-plugins/JS-Slash-Runner`
> - `sillytavern-plugins/MagVarUpdate`

## 1. 本轮复评结论（先给结论）

- 当前 gap **仍不算小**，P4 已具备可监测回归基线；本轮起停止新增 CI 方向投入，回归主线 gap 收敛。
- 相比上一轮，基础能力和回归稳定性继续改善，核心迁移指标更新为：
  - SillyTavern Slash 命令覆盖：**31.01%**
  - JS-Slash-Runner TavernHelper API 覆盖：**66.15%**
- 结论：P2/P3 gate 持续达标；P4 十一轮沉淀的“自动回放 + 噪音门禁 + run-index”基线继续保留。本轮主线继续收敛 TavernHelper 长尾 regex API（`formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes`），优先清理真实迁移阻塞点而非继续扩 CI 能力。

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

### 1.6 2026-03-03 P2 增量执行结果（二轮：api 命令族最小子集）

- Slash Registry 已补齐 API 高频命令最小只读子集：
  - `api`
  - `api-url`
  - `server`（`api-url` 别名）
- 命令语义对齐：
  - `/api` 无参返回当前 API 类型（支持上下文读取 + `localStorage.llmType` 回落）。
  - `/api-url` 支持 `api=` 命名参数读取目标源 URL，兼容 `custom/zai -> openai`、`kobold/textgenerationwebui -> ollama` 别名。
  - 写路径（`/api <value>`、`/api-url <url>`）在宿主模式统一 fail-fast，避免静默半实现。
- 新增回归覆盖：
  - `lib/slash-command/__tests__/p2-api-command-gaps.test.ts`

### 1.7 2026-03-03 P2 增量执行结果（三轮：fuzzy 命令最小子集）

- Slash Registry 已补齐 `fuzzy` 命令最小可运行语义：
  - 支持 `list`（JSON 数组）
  - 支持 `threshold`（`0~1` 浮点）
  - 支持 `mode=first|best`（默认 `first`）
- 命令语义对齐：
  - `mode=first` 按列表顺序返回首个命中项。
  - `mode=best` 返回阈值内分数最低项；未命中返回空字符串。
  - 参数错误（缺少 `list`、非法 JSON、`threshold` 越界、未知 `mode`、缺少搜索文本）统一显式 fail-fast。
- 新增回归覆盖：
  - `lib/slash-command/__tests__/p2-fuzzy-command-gaps.test.ts`

### 1.8 2026-03-03 P2 增量执行结果（四轮：chat 命令族最小子集）

- Slash Registry 已补齐 chat 管理高频命令最小子集：
  - `chat-manager`
  - `chat-history`（`chat-manager` 别名）
  - `manage-chats`（`chat-manager` 别名）
  - `chat-reload`
- 命令语义对齐：
  - `/chat-manager` 在宿主提供 `openChatManager` 回调时触发管理器打开，并返回空字符串。
  - `/chat-reload` 在宿主提供 `reloadCurrentChat` 回调时触发当前会话重载，并返回空字符串。
  - 宿主未提供回调时统一显式 fail-fast，避免静默 no-op。
- 新增回归覆盖：
  - `lib/slash-command/__tests__/p2-chat-command-gaps.test.ts`

### 1.9 2026-03-03 P2 增量执行结果（五轮：run / trimtokens / reload-page）

- Slash Registry 已补齐高频缺口最小子集：
  - `run`（含 `call` / `exec` 别名）
  - `trimtokens`
  - `reload-page`
- 命令语义对齐：
  - `/run` 支持两条执行路径：直接执行 slash script，或从变量读取脚本后执行；支持 `{{arg::key}}` 形态的命名参数注入。
  - `/trimtokens` 支持 `limit + direction(start|end)`；优先走宿主 tokenizer 回调，缺失时按字符比例做可解释降级；非法参数统一 fail-fast。
  - `/reload-page` 走宿主 `reloadPage` 回调；宿主未注入时显式 fail-fast。
- Script Bridge 上下文补齐：
  - `slash-handlers` 在执行上下文内注入 `runSlashCommand`，收敛 `/run` 到单一执行入口。
  - `ApiCallContext` 新增 `onReloadPage` 注入位，与 `reload-page` 命令保持单路径映射。
- 新增回归覆盖：
  - `lib/slash-command/__tests__/p2-utility-command-gaps.test.ts`
  - `hooks/script-bridge/__tests__/api-surface-contract.test.ts`

### 1.10 2026-03-03 P2 增量执行结果（六轮：branch / ui 最小子集）

- Slash Registry 已补齐 `branch / ui` 高频缺口最小子集：
  - `branch-create`
  - `panels`（含 `togglepanels` 别名）
  - `bg`（含 `background` 别名）
  - `theme`
  - `movingui`
  - `css-var`
  - `vn`
  - `resetpanels`（含 `resetui` 别名）
  - `?`（含 `help` 别名）
- 命令语义对齐：
  - `/branch-create` 默认使用最后一条消息，创建分支名并自动进入分支会话，且复用 `checkpoint` 状态链路。
  - UI 命令统一走宿主回调注入（`togglePanels/resetPanels/toggleVisualNovelMode/setBackground/setTheme/setMovingUiPreset/setCssVariable`）。
  - 宿主缺失对应回调时统一显式 fail-fast，避免静默 no-op。
- Script Bridge 上下文补齐：
  - `ApiCallContext` 新增 UI 注入位（含 `onSetCssVariable`）。
  - `slash-handlers` 将 UI 回调透传到 `ExecutionContext`，保持 `iframe -> handler -> slash` 单路径映射。
- 新增回归覆盖：
  - `lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts`

### 1.11 2026-03-03 P4 增量执行结果（首轮：Playwright MCP E2E 落地）

- 已在 `app/test-script-runner` 落地 P4 浏览器执行面：
  - `page.tsx`：P4 场景控制台（批量执行、单场景执行、JSON 报告输出）。
  - `scenarios.ts`：四条主场景编排（脚本工具、Slash 控制流、MVU 变量链路、音频事件链路）。
- 已完成 `test-baseline-assets` 场景映射固化：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/p4-playwright-e2e.md`
- 已固化首轮运行证据：
  - 截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-console-network.md`
- 首轮结果：`4/4` 场景通过，`0` 失败。

### 1.12 2026-03-03 P4 增量执行结果（二轮：故障注入补齐）

- `app/test-script-runner/scenarios.ts` 已补齐 3 条故障注入场景：
  - `tool-timeout-failfast`
  - `macro-unknown-failfast`
  - `reload-page-failfast`
- `app/test-script-runner/page.tsx` 已支持主链路/故障注入分类展示，避免“失败即红”误读（故障注入命中预期失败同样记 PASS）。
- 二轮实跑结果：`7/7` 通过（`4` 主链路 + `3` 故障注入），无额外失败样本。
- 二轮证据已固化：
  - 截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round2-console-network.md`

### 1.13 2026-03-03 P4 增量执行结果（三轮：音频回调缺失注入）

- `lib/slash-command/registry/handlers/js-slash-runner.ts` 已收敛音频命令的宿主能力检查：
  - `/audioplay`、`/audioimport`、`/audioselect`、`/audiopause`、`/audioresume`、`/audiostop` 等命令在缺失回调时统一显式 fail-fast。
  - 保持“有能力就执行、缺能力就报错”的单路径语义，避免静默 no-op。
- `app/test-script-runner/scenarios.ts` 已新增故障注入场景：
  - `audio-callback-missing-failfast`
- 三轮实跑结果：`8/8` 通过（`4` 主链路 + `4` 故障注入），无额外失败样本。
- 三轮证据已固化：
  - 截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round3-console-network.md`

### 1.14 2026-03-03 P4 增量执行结果（四轮：串联命令一致性注入）

- `app/test-script-runner/scenarios.ts` 已新增故障注入场景：
  - `chain-failfast-consistency`
- `lib/slash-command/__tests__/js-slash-runner-audio.test.ts` 已新增串联命令断言：
  - `/setvar guard -> /reload-page(fail-fast) -> /audiostop -> /setvar tail`
  - 验证前置副作用保留、后续命令截断、音频状态不回退。
- 四轮实跑结果：`9/9` 通过（`4` 主链路 + `5` 故障注入），无额外失败样本。
- 四轮证据已固化：
  - 截图：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-console-network.md`
  - 原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round4-network.log`

### 1.15 2026-03-03 P4 增量执行结果（五轮：`/session` 真实 UI）

- 已补齐 `/session` 真实交互路径验证：
  - 在 `IndexedDB` 注入双角色/双会话测试数据（`session-a` / `session-b`）。
  - `session-a` 页面执行输入提交，校验用户消息即时渲染。
  - 返回首页点击会话卡切换到 `session-b`，校验无跨会话消息污染。
- 已固化执行前清理脚本：
  - `scripts/p4-playwright-preflight.sh`（自动回收 `mcp-chrome/Playwright` 残留进程）。
- 五轮证据已固化：
  - 截图（输入提交）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-input-pass.png`
  - 截图（会话切换）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console-network.md`
  - 原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round5-session-network.log`

### 1.16 2026-03-03 P4 增量执行结果（六轮：`/session` slash + 刷新一致性审计）

- 六轮执行目标：把“建议项”落地成可复现审计链路，覆盖 `/session` 下 slash 输入路径、`401` 后刷新一致性、跨会话隔离复验。
- 六轮关键结果：
  - `session-a` 输入 `/send P4 Round6 SlashPathMessage|/trigger` 后，UI 渲染原始文本并进入 LLM 链路，说明 slash 直达执行未命中。
  - 同链路命中 `https://api.openai.com/v1/chat/completions -> 401`（fail-fast 可见）。
  - 刷新 `session-a` 后仅保留 opening，上一条用户输入消失，确认“失败后输入未持久化”缺口。
  - 切换 `session-b` 后仅见 `P4 Round6 Opening B`，会话隔离语义保持成立。
- 六轮证据已固化：
  - 截图（slash 输入现状）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-slash-input-raw-path.png`
  - 截图（刷新后状态）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-refresh-state.png`
  - 截图（会话隔离复验）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-session-b-isolation-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console-network.md`
  - 原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round6-network.log`

### 1.17 2026-03-03 P4 增量执行结果（七轮：`/session` 修复复验）

- 七轮执行目标：验证六轮暴露的两项 UI 缺口修复是否生效（slash 直达分流、失败路径消息持久化），并复验会话隔离不回退。
- 七轮关键结果：
  - `session-a` 输入 `/send P4 Round7 SlashPathMessage|/trigger` 后，UI 渲染 `P4 Round7 SlashPathMessage`，slash 直达执行链路命中。
  - 刷新 `session-a` 后仍可见该用户消息，刷新一致性恢复（不再回退为 opening-only）。
  - 切换 `session-b` 后仅见 `P4 Round7 Opening B`，跨会话隔离语义保持成立。
  - 本轮 console/network 未再出现 `No response returned from workflow` 业务错误；仅剩背景图 `404` 与统计请求中断噪音。
- 七轮证据已固化：
  - 截图（slash 直达通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-slash-direct-pass.png`
  - 截图（刷新持久化通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-refresh-persistence-pass.png`
  - 截图（会话隔离复验）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-session-b-isolation-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-console-network.md`
  - 原始日志：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round7-network.log`

### 1.18 2026-03-03 P4 增量执行结果（八轮：普通输入 `401` 独立证据）

- 八轮执行目标：补齐“普通输入触发 `401` 后刷新仍保留 user 节点”的浏览器独立证据，并与七轮 slash 场景解耦。
- 八轮关键结果：
  - `session-a` 普通输入 `P4 Round8 Plain401 Message A3` 命中 `https://api.openai.com/v1/chat/completions -> 401`。
  - 同链路出现 `No response returned from workflow`（fail-fast 语义可见）。
  - 刷新 `session-a` 后仍保留 `P4 Round8 Plain401 Message A2/A3`，输入持久化不回退。
  - 本轮同步补齐固定入口：`pnpm p4:preflight`、`pnpm p4:session-dev`。
- 八轮证据已固化：
  - 截图（失败后刷新持久化通过）：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-plain-refresh-pass.png`
  - console/network 摘要：`docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-console-network.md`
  - 原始日志（刷新前）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-pre-refresh-network.log`
  - 原始日志（刷新后）：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-console.log`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-playwright-e2e-round8-network.log`

### 1.19 2026-03-03 P4 增量执行结果（九轮：round7+8 自动回放 + CI）

- 九轮执行目标：将 round7 + round8 `/session` 复验收敛为“单命令 + 可归档产物 + CI 可执行”路径。
- 九轮关键结果：
  - 新增自动回放脚本：
    - `scripts/p4-session-replay-e2e.mjs`
    - `scripts/p4-session-replay-lib.mjs`
  - 新增单命令入口：
    - `pnpm p4:session-replay`
  - 自动回放实跑通过：`10/10` checkpoints 全绿（slash 直达、刷新持久化、会话隔离、普通输入 `401`）。
  - 新增 CI 工作流：
    - `.github/workflows/p4-session-replay.yml`
    - 工作流已接入 `pnpm p4:preflight` + `pnpm p4:session-replay` + 产物上传。
- 九轮证据已固化（示例 run）：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/summary.md`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round7-slash-direct-pass.png`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r9-1772544554577/round8-plain-refresh-pass.png`

### 1.20 2026-03-03 P4 增量执行结果（十轮：噪音基线差分门禁）

- 十轮执行目标：优先收敛主链路判读噪音，把 `p4-session-replay` 从“可回放”升级为“可回放 + 可门禁”。
- 十轮关键结果：
  - 自动回放新增噪音候选采集：console `error|warning` + network `>=400/requestfailed/mock`。
  - 新增基线规则文件：`docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json`。
  - 自动回放新增差分门禁：`noise-baseline-diff` checkpoint；若出现新增噪音签名则脚本直接 fail-fast。
  - 十轮实跑通过：`11/11` checkpoints 全绿，`unknownSignatureCount=0`。
- 十轮证据已固化：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r10-1772552610608/summary.md`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r10-1772552610608/round10-noise-baseline-report.md`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r10-1772552610608/round10-noise-baseline-report.json`

### 1.21 2026-03-04 P4 增量执行结果（十一轮：run 索引 + 规则健康审计）

- 十一轮执行目标：优先收敛“跨轮可对比性”，把主链路回放从“单次可判读”升级到“连续可趋势化”。
- 十一轮关键结果：
  - 自动回放新增 run 聚合索引：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md`
  - `noise-baseline` 新增规则命中审计（`allRuleIds/matchedRuleIds/unusedRuleIds`），并在报告中输出 Rule Audit。
  - `run-index` 规则健康跟踪新增 `consecutiveMisses` 与 `staleRules`（默认阈值：连续 `3` 次 miss 提示可清理）。
  - replay `summary` 新增 run-index 引用与 `staleRuleCount`，便于 handoff 与 CI 直接跳转。
  - 实跑通过：`pnpm p4:session-replay` -> `11/11` checkpoints，`unknownSignatureCount=0`，`staleRuleCount=0`。
- 十一轮证据已固化（正式 run）：
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r11-1772588355116/summary.md`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r11-1772588355116/round10-noise-baseline-report.md`
  - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md`

### 1.22 2026-03-04 主线增量执行结果（registerSlashCommand 回调闭环）

- 本轮执行目标：回归主线 gap 收敛，优先修复“已注册 slash 回调在宿主端不可执行”的真实迁移阻塞。
- 本轮关键结果：
  - `registerSlashCommand` 新增 `hasCallback + iframeId` 执行路径，命令执行时通过 `SLASH_COMMAND_CALL` 派发到 iframe callback，再由 `SLASH_COMMAND_RESULT` 回传结果。
  - `ScriptSandbox` 新增 `SLASH_COMMAND_RESULT` 处理，接入 extension-handlers 的 pending/timeout 机制。
  - shim 新增 `SLASH_COMMAND_CALL` 分支，并统一为 slash 定义补齐 `iframeId` 透传。
  - 注册阶段新增 fail-fast：若既无本地 callback，又无 iframe callback 声明，直接拒绝注册。
  - iframe 卸载时新增未完成 slash callback 清理，避免悬挂 promise。
- 本轮回归：
  - `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
  - `pnpm vitest run lib/core/__tests__/st-baseline-slash-command.test.ts`
  - 结果：全部通过。

### 1.23 2026-03-04 主线增量执行结果（十三轮结构拆分）

- 本轮执行目标：在不新增能力前提下拆分桥接实现，降低 `extension-handlers` 与 shim 的耦合密度，控制后续语义收敛风险。
- 本轮关键结果：
  - `hooks/script-bridge/extension-handlers.ts` 收敛为门面层，行为导出保持不变。
  - 新增子模块：
    - `hooks/script-bridge/function-tool-bridge.ts`
    - `hooks/script-bridge/slash-command-bridge.ts`
    - `hooks/script-bridge/iframe-dispatcher-registry.ts`
  - `public/iframe-libs/slash-runner-shim.js` 拆出独立分块：
    - `createSlashCommandBridge`（slash 回调注册/执行）
    - `createMessageDispatcher`（消息路由分发）
  - `hooks/script-bridge/README.md` 已同步门面/子模块职责和文件清单。
- 本轮回归：
  - `pnpm exec eslint hooks/script-bridge/extension-handlers.ts hooks/script-bridge/function-tool-bridge.ts hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/iframe-dispatcher-registry.ts public/iframe-libs/slash-runner-shim.js`
  - `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`
  - 结果：全部通过（`4 files / 66 tests`）。

### 1.24 2026-03-04 主线增量执行结果（十四轮参数语义收敛）

- 本轮执行目标：收敛 `registerSlashCommand` 参数语义等价性，补齐执行期约束与错误语义。
- 本轮关键结果：
  - `hooks/script-bridge/slash-command-bridge.ts` 已增加 `namedArgumentList/unnamedArgumentList` 执行期校验。
  - 已收敛 fail-fast 路径：
    - 缺失必填命名参数；
    - 传入未声明命名参数；
    - 位置参数数量超过定义上限（未声明 `acceptsMultiple`）。
  - callback 运行时上下文已补齐结构化参数视图：
    - `namedArgumentList`（name/value/isRequired）
    - `unnamedArgumentList`（value/description/isRequired）
  - iframe 桥接消息 `SLASH_COMMAND_CALL` 已透传 `unnamedArgs` 与结构化参数列表。
  - `public/iframe-libs/slash-runner-shim.js` 已接入上述上下文透传，保持本地 callback 与 iframe callback 语义一致入口。
- 本轮回归：
  - `pnpm exec eslint hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/__tests__/extension-lifecycle.test.ts public/iframe-libs/slash-runner-shim.js`
  - `pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`
  - 结果：全部通过（`3 files / 67 tests`）。

### 1.25 2026-03-04 主线增量执行结果（十六轮 parser 深语义第一切片）

- 本轮执行目标：落地 `flags/debug/scope chain` 最小可复现语义，且在 `st-baseline-slash-command` 固化断言。
- 本轮关键结果：
  - `lib/slash-command/core/parser.ts` 已接入 parser flag 状态机：
    - 新增 `/parser-flag` 解析期指令；
    - 支持 `STRICT_ESCAPING`（未闭合引号 fail-fast）；
    - 支持 `REPLACE_GETVAR`（`{{getvar::}}/{{getglobalvar::}}` 归一到 scoped macro 形态）。
  - parser/executor 已补齐 `scopeDepth + parserFlags` 元数据透传：
    - `CommandNode` 增加 `scopeDepth/parserFlags`；
    - `CommandInvocationMeta` 同步透传到执行期 handler。
  - debug 语义补齐：
    - 新增 `breakpoint` AST 节点；
    - debug 开启时命中 `/breakpoint` 会产出 `debug:breakpoint` 事件；
    - debug 关闭时 `/breakpoint` 按指令语义安全忽略。
  - 基线断言已落地：
    - `st-baseline-slash-command` 新增 `STRICT_ESCAPING`、`breakpoint` 与 `scope chain` 行为断言。
- 本轮回归：
  - `pnpm exec eslint lib/slash-command/core/parser.ts lib/slash-command/core/executor.ts lib/slash-command/core/debug.ts lib/slash-command/core/types.ts lib/slash-command/executor.ts lib/slash-command/parser.ts lib/slash-command/types.ts lib/slash-command/index.ts lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`
  - `pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts`
  - `pnpm exec tsc --noEmit`
  - 结果：全部通过（`2 files / 74 tests`，lint/tsc 均全绿）。

### 1.26 2026-03-04 主线增量执行结果（十九轮 util 长尾 API 收口）

- 本轮执行目标：按“真实触发失败”补齐 TavernHelper 长尾 util API，统一 fail-fast 语义。
- 本轮关键结果：
  - `compatHandlers` 新增 util API：
    - `substitudeMacros`：使用 `STMacroEvaluator` 执行宏替换，注入 `lastMessage/lastUserMessage/lastCharMessage/lastMessageId` 与全局+角色变量快照。
    - `getLastMessageId`：返回当前会话最后一条消息索引（无消息时返回 `null`）。
    - `getMessageId`：按上游 iframe 命名约定 `TH-message--<id>--<suffix>` 解析楼层 id，格式不合法显式 fail-fast。
  - `slash-runner-shim` 新增 util 暴露：
    - `substitudeMacros/getLastMessageId/getMessageId` 统一走 `API_CALL`；
    - `errorCatched` 在 shim 侧提供本地包装器，参数非法显式 fail-fast。
  - `capability-matrix` / 合同测试同步更新，避免 shim 与 handler 漂移。
- 本轮回归：
  - `pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
  - `pnpm exec tsc --noEmit`
  - 结果：全部通过（`3 files / 14 tests`，`tsc` 全绿）。

### 1.27 2026-03-04 主线增量执行结果（二十轮 regex 长尾 API 收口）

- 本轮执行目标：按“真实触发失败”补齐 TavernHelper 长尾 regex API 最小读取闭环，并保持 fail-fast 语义。
- 本轮关键结果：
  - `hooks/script-bridge/compat-regex-handlers.ts` 新增 regex API：
    - `formatAsTavernRegexedString`：复用 `RegexProcessor` 执行文本格式化，支持 `source/destination/depth/character_name` 参数。
    - `isCharacterTavernRegexesEnabled`：读取角色 regex settings 的 `enabled` 状态。
    - `getTavernRegexes`：支持 `scope + enable_state` 过滤，并输出与上游兼容的 tavern regex 结构。
  - `compatHandlers` 收敛为门面聚合：通过 `...compatRegexHandlers` 合并长尾 regex 能力，避免单文件继续膨胀。
  - `slash-runner-shim` 新增 `formatAsTavernRegexedString/isCharacterTavernRegexesEnabled/getTavernRegexes` 入口，全部统一走 `API_CALL`。
  - `capability-matrix` / `api-surface-contract` / `p3-api-compat-gaps` 同步更新，确保 shim 与 handler 无漂移。
- 本轮回归：
  - `pnpm vitest run hooks/script-bridge/__tests__/p3-api-compat-gaps.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts`
  - `pnpm exec tsc --noEmit`
  - 结果：全部通过（`3 files / 17 tests`，`tsc` 全绿）。

## 2. 审计口径与量化结果

### 2.1 SillyTavern Slash 覆盖（核心差距）

- 上游命令总量：`258`
  - 统计口径：`SillyTavern/public/scripts` 下 `SlashCommand.fromProps({ name: ... })` 唯一命令名。
- 当前命令总量：`152`
  - 统计口径：
    - `lib/slash-command/registry/index.ts` 中 `COMMAND_REGISTRY`；
    - `lib/slash-command/core/parser.ts` 控制命令（`if/while/times/return/break/abort`）；
    - `lib/slash-command/core/executor.ts` 特殊命令（`let/var`）。
- 交集：`80`
- 覆盖率：`80 / 258 = 31.01%`

### 2.2 JS-Slash-Runner TavernHelper API 覆盖

- 上游聚合 API：`130`
  - 统计口径：`JS-Slash-Runner/src/function/index.ts` 中 `getTavernHelper()` 返回对象顶层 key。
- 当前 shim 顶层 API：`124`
  - 统计口径：`public/iframe-libs/slash-runner-shim.js` 中 `window.TavernHelper` 顶层 key。
- 交集：`86`
- 覆盖率：`86 / 130 = 66.15%`

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

### 3.6 P2 api 命令族回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-api-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - `2` files passed
  - `60` tests passed

### 3.7 P2 fuzzy 命令回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-fuzzy-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - `2` files passed
  - `58` tests passed

### 3.8 P2 chat 命令回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-chat-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - `2` files passed
  - `57` tests passed

### 3.9 P2 run / trimtokens / reload-page 命令回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-utility-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts
```

- 结果：
  - `3` files passed
  - `65` tests passed

### 3.10 P2 branch / ui 命令回归（本轮新增）

- 执行命令：

```bash
pnpm vitest run \
  lib/slash-command/__tests__/p2-branch-ui-command-gaps.test.ts \
  lib/slash-command/__tests__/p2-checkpoint-command-gaps.test.ts \
  lib/core/__tests__/st-baseline-slash-command.test.ts \
  hooks/script-bridge/__tests__/api-surface-contract.test.ts
```

- 结果：
  - `4` files passed
  - `69` tests passed

### 3.11 P4 Playwright MCP E2E（本轮新增）

- 执行路径：
  - 启动 `pnpm dev`（`3303`）
  - Playwright MCP 打开 `/test-script-runner`
  - 点击 `运行全部 P4 场景`
- 结果：
  - 场景通过：`4/4`
  - 失败：`0`
  - Console：`0 error / 0 warning`
  - 关键链路日志已观测：
    - `[registerFunctionTool] Registered: p4_tool_echo`
    - `[/event-emit] Emitted: stage_change {source: p4-audio}`

### 3.12 P4 Playwright MCP E2E（二轮故障注入）

- 执行路径：
  - 启动 `pnpm dev`（`3303`）
  - Playwright MCP 打开 `/test-script-runner`
  - 点击 `运行全部 P4 场景`（含故障注入）
- 结果：
  - 场景通过：`7/7`
  - 失败：`0`
  - Console：`0 error / 0 warning`（总日志 `63`）
  - 故障注入命中：
    - `Function tool timeout: p4_tool_timeout`
    - `unsupported macro '{{unknown::p4_case}}'`
    - `/reload-page is not available in current context`

### 3.13 P4 Playwright MCP E2E（三轮音频注入）

- 执行路径：
  - 启动 `pnpm dev`（`3303`）
  - Playwright MCP 打开 `/test-script-runner`
  - 点击 `运行全部 P4 场景`（含音频回调缺失注入）
- 结果：
  - 场景通过：`8/8`
  - 失败：`0`
  - Console：`0 error / 0 warning`（总日志 `31`）
  - 故障注入新增命中：
    - `/audioplay is not available in current context`

### 3.14 P4 Playwright MCP E2E（四轮串联一致性注入）

- 执行路径：
  - 启动 `pnpm dev`（`3303`）
  - Playwright MCP 打开 `/test-script-runner`
  - 点击 `运行全部 P4 场景`（含串联命令一致性注入）
- 结果：
  - 场景通过：`9/9`
  - 失败：`0`
  - Console：`0 error / 0 warning`（总日志 `31`）
  - 四轮新增命中：
    - `Command /reload-page failed: /reload-page is not available in current context`
    - `guard=before-fail`
    - `tail` 未写入
    - `isPlayingBeforeChain=true` 且 `isPlayingAfterChain=true`

### 3.15 P4 Playwright MCP E2E（五轮 `/session` 真实 UI）

- 执行路径：
  - 执行 `scripts/p4-playwright-preflight.sh` 清理残留浏览器进程。
  - 启动 `pnpm dev`（`3303`）。
  - Playwright MCP 注入 `IndexedDB` 双会话测试数据并打开 `/session?id=session-a`。
  - 提交输入消息并切换到 `session-b` 验证隔离。
- 结果：
  - 场景通过：`1/1`
  - 失败：`0`
  - Console：`Errors=6 / Warnings=4`（其中核心业务错误为无 API key 的 `401`，命中预期 fail-fast）
  - 关键命中：
    - `P4 Round5 UI Message A2` 在 `session-a` 页面渲染成功
    - 切换后 `session-b` 页面仅保留 `P4 Round5 Opening B`
    - 未观测跨会话消息污染

### 3.16 P4 Playwright MCP E2E（六轮 `/session` slash + 刷新审计）

- 执行路径：
  - 执行 `scripts/p4-playwright-preflight.sh` 清理残留浏览器进程。
  - 启动 `pnpm dev`（`3303`）。
  - Playwright MCP 注入 `IndexedDB` 双会话测试数据并打开 `/session?id=p4r6-1772535993689-session-a`。
  - 在输入框提交 `/send P4 Round6 SlashPathMessage|/trigger`，随后刷新同会话。
  - 返回首页切换到 `session-b` 复验隔离。
- 结果：
  - 审计检查执行：`3/3`
  - 通过：`1`（会话隔离）
  - 发现缺口：`2`（slash 直达未命中、失败后输入未持久化）
  - Console：关键错误集中在 `401` 与 `No response returned from workflow`。

### 3.17 P4 Playwright MCP E2E（八轮 `/session` 普通输入 `401` 独立证据）

- 执行路径：
  - 执行 `scripts/p4-playwright-preflight.sh` 清理残留浏览器进程。
  - 使用 Playwright MCP 注入 `IndexedDB` 单会话测试数据并打开 `/session?id=p4r8-1772539665354-session-a`。
  - 提交普通输入 `P4 Round8 Plain401 Message A3`，命中 LLM `401` 链路。
  - 导出 `pre-refresh` 原始日志后刷新同会话，复验消息持久化。
- 结果：
  - 复验检查：`1/1` 通过。
  - `pre-refresh`：`Errors=4 / Warnings=4`，关键错误为 `401` + `No response returned from workflow`。
  - `post-refresh`：`Errors=0 / Warnings=0`，无新增业务错误，用户消息保持可见。

### 3.18 P4 Playwright MCP E2E（十轮 `noise baseline` 差分门禁）

- 执行命令：

```bash
pnpm p4:session-replay
```

- 结果：
  - 自动回放 checkpoints：`11/11` 通过（新增 `noise-baseline-diff`）。
  - 噪音差分：`unknownSignatureCount=0`，无新增噪音签名。
  - 报告输出：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r10-1772552610608/round10-noise-baseline-report.md`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-p4r10-1772552610608/round10-noise-baseline-report.json`

### 3.19 P4 自动回放（十一轮 `run-index + stale-rules`）

- 执行命令：

```bash
pnpm vitest run scripts/__tests__/p4-session-replay-lib.test.ts
pnpm p4:session-replay
```

- 结果：
  - 单测：`1` file / `2` tests 全绿（规则审计 + 连续 miss 累积）。
  - 自动回放：`11/11` checkpoints 通过，`unknownSignatureCount=0`。
  - 正式 run：`p4r11-1772588355116`（`duration=16.7s`）。
  - 产物新增：
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.json`
    - `docs/plan/2026-03-03-sillytavern-gap-reduction/artifacts/p4-session-replay-run-index.md`

### 3.20 主线结构拆分回归（十三轮）

- 执行命令：

```bash
pnpm exec eslint hooks/script-bridge/extension-handlers.ts hooks/script-bridge/function-tool-bridge.ts hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/iframe-dispatcher-registry.ts public/iframe-libs/slash-runner-shim.js
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts hooks/script-bridge/__tests__/api-surface-contract.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - Lint：通过（新增拆分文件 + shim 改造文件）。
  - 测试：`4` files / `66` tests 全绿。
  - 结论：本轮为纯结构重排，未引入行为回退。

### 3.21 主线参数语义回归（十四轮）

- 执行命令：

```bash
pnpm exec eslint hooks/script-bridge/slash-command-bridge.ts hooks/script-bridge/__tests__/extension-lifecycle.test.ts public/iframe-libs/slash-runner-shim.js
pnpm vitest run hooks/script-bridge/__tests__/extension-lifecycle.test.ts lib/script-runner/__tests__/slash-runner-shim-contract.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
```

- 结果：
  - Lint：通过（bridge 参数约束 + shim 上下文透传改造文件）。
  - 测试：`3` files / `67` tests 全绿（含新增参数约束失败路径与结构化上下文断言）。
  - 结论：`registerSlashCommand` 参数约束从“声明位”推进到“执行位”，错误语义已进入可回归状态。

### 3.22 parser 深语义回归（十六轮）

- 执行命令：

```bash
pnpm vitest run lib/slash-command/__tests__/kernel-core.test.ts lib/core/__tests__/st-baseline-slash-command.test.ts
pnpm exec tsc --noEmit
```

- 结果：
  - 测试：`2` files / `74` tests 全绿（新增 `STRICT_ESCAPING`、`breakpoint`、`scopeDepth/parserFlags` 断言）。
  - 类型检查：通过。
  - 结论：`flags/debug/scope chain` 最小语义切片已进入稳定可回归状态。

## 4. 关键缺口（按影响面排序）

### 4.1 Slash 内核能力仍偏轻

- 当前 parser/executor 已补齐 `flags/debug/scope chain` 第一切片（`parser-flag`、`breakpoint` 事件、`scopeDepth/parserFlags` 透传），但与上游仍有深语义差距（严格转义细节、更多 parser 指令交互）。
- 关键位置：
  - 当前：`lib/slash-command/core/parser.ts`
  - 上游：`SillyTavern/public/scripts/slash-commands/SlashCommandParser.js`

### 4.2 TavernHelper 能力面不完整

- API 覆盖率已提升到 `66.15%` 并持续高于 `55%` 门槛，但 shim 仍是“可运行子集”，与上游聚合 API 仍有可见缺口（主要在低频 displayed-message 等簇）。
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
- `registerSlashCommand` 的参数约束与结构化上下文已打通本地/iframe 双路径。
- 剩余风险主要集中在更细粒度语义：`acceptsMultiple/defaultValue/rawQuotes` 与重复命名参数保序行为。
- 关键位置：
  - `hooks/script-bridge/extension-handlers.ts`
  - `hooks/script-bridge/slash-command-bridge.ts`
  - `public/iframe-libs/slash-runner-shim.js`
  - `lib/nodeflow/LLMNode/LLMNodeTools.ts`

### 4.5 P2 高频缺口头部（六轮后）

- `branch-create` 与 `ui` 高频命令最小子集已接入，P2 目标覆盖率已达成。
- 头部缺口已进一步后移到低频命令与素材驱动深语义能力（regex/worldbook 组合链路），短期更适合通过素材回归曝露真实阻塞点。
- 建议从“继续堆命令数”转向“以 E2E 场景驱动补缺”，优先修复能复现实际迁移失败的路径。

### 4.6 P4 现阶段风险（主线回归后）

- 八轮已补齐“普通输入触发 `401` 后刷新仍保留 user 节点”浏览器独立证据，失败路径不再只依赖单测。
- `mcp-chrome` 抢占风险已通过 `scripts/p4-playwright-preflight.sh` + `pnpm p4:preflight` 收敛，并在 CI 工作流中落地调用。
- 十轮已落地噪音基线差分门禁：已知噪音可追踪，新增噪音会直接 fail-fast。
- 十一轮已补齐 run-index 与规则健康审计：跨轮趋势可见、过期规则可提示。
- 本轮已明确停止新增 CI 方向投入；当前剩余风险主要在 regex/worldbook 组合语义与长尾 parser 细节，仍可能影响复杂脚本迁移。

## 5. 本轮结论（主线优先）

本轮判定：**项目方向已回归“主线 gap 收敛优先”，P4 保留为可监测回归基线，不再继续扩展 CI 能力面**。

1. 脚本执行面保持 `9/9` 全绿（`4` 主链路 + `5` 故障注入）。  
2. `/session` 真实 UI 链路已覆盖输入、slash、刷新、隔离四类关键路径。  
3. 六轮暴露的两项阻塞已在七轮闭环，八轮进一步补齐普通输入 `401` 失败链路浏览器证据。  
4. preflight 入口已固定化，可复用性提升（`pnpm p4:preflight` / `pnpm p4:session-dev`）。
5. round7+round8 已收敛为单命令回放（`pnpm p4:session-replay`），并形成 runId 产物目录。
6. `p4:preflight + p4:session-replay` 仍可作为回归基线入口，基建层面维持现状。
7. 噪音基线差分已接入主链路，十轮实跑 `unknownSignatureCount=0`。
8. run-index 已落地，历史 run 的耗时/通过率/噪音趋势可单文件查看。
9. 本轮完成十六轮 parser 深语义第一切片：`flags/debug/scope chain` 已进入可回归状态，主线迁移阻塞后移到 regex/worldbook 组合链路。

## 6. 下一阶段建议（主线执行）

1. 优先推进素材驱动回归：覆盖 `V2.0Beta.png` 与 `Sgw3.*` 的 `regex_scripts` 关键组合（`runOnEdit/substituteRegex/minDepth/maxDepth`）。  
2. 推进 worldbook 组合语义验证：`probability/useProbability/depth/group/groupWeight` 执行链一致性。  
3. 仅把 `p4-session-replay` 作为回归基线使用，在每次主线修复后按需复跑，确保质量不倒退。

## 7. 基于测试素材的优先级重排（核心功能提级）

### 7.1 素材证据（2026-03-04 复评）

- 本轮可结构化解析素材：
  - `test-baseline-assets/preset/*.json`
  - `test-baseline-assets/worldbook/*.json`
  - `test-baseline-assets/character-card/Sgw3.card.json`
  - `test-baseline-assets/character-card/*.png`（含新增 `V2.0Beta.png`，已按 PNG card 元数据解码）
- 宏族出现频次（跨素材去重聚合，按 payload hash 去重）：
  - `random=78`、`trim=64`、`getvar=47`、`setvar=42`、`addvar=37`、`roll=17`
- 真实 slash 触发集中：
  - `/send=9`、`/trigger=9`、`/if=5`、`/let=2`
  - 结论：素材迁移风险并不主要来自“命令种类数量不足”，而是来自“少数高频命令 + 运行时语义一致性”。
- Regex/Worldbook 特性密集：
  - 新增角色卡 `V2.0Beta.png`：`regex_scripts=12`
  - 主素材 `Sgw3.*`：`regex_scripts=44`
  - regex 脚本字段高频出现：`findRegex/replaceString/runOnEdit/substituteRegex/minDepth/maxDepth/placement/trimStrings`
  - worldbook 结构字段高频出现：`probability/useProbability/depth/group/groupWeight/scanDepth` 等。

### 7.2 剩余 gap 重新分级（把核心功能提到最高优先）

#### P0（最高，迁移阻塞优先）

- regex 脚本执行链素材回归：
  - 覆盖 `V2.0Beta.png` 与 `Sgw3.*` 的 `runOnEdit/substituteRegex/minDepth/maxDepth` 组合断言。
- 目标：先收敛“真实素材可复现失败”，再考虑扩展低频能力面。

#### P1（高，内容生产链稳定性）

- worldbook 执行链回归加固：
  - `probability/useProbability/depth/group/groupWeight` 组合语义一致性。
- parser 深语义第二切片：
  - 严格转义与 parser 指令交互细节（在已有 `flags/debug/scope chain` 第一切片上补齐）。

#### P2（中，能力面收口）

- TavernHelper 长尾 API 缺口按“真实触发失败”补齐：
  - 继续保持 fail-fast，不做静默兼容分支。
- 低频 slash 命令补齐降级到 P2：
  - 不再按“命令总数”驱动优先级，改为“素材可复现阻塞”驱动。

## 8. 能力需求清单（真实素材 vs 非素材）

### 8.1 当前真实素材能力需求（从 `test-baseline-assets` 提取）

- Slash 主链路：`/send`、`/trigger`、`/if`、`/let`（含管道与块组合）。
- 宏与变量高频：`random`、`trim`、`getvar`、`setvar`、`addvar`、`roll`。
- regex 脚本组合：`findRegex`、`replaceString`、`runOnEdit`、`substituteRegex`、`minDepth`、`maxDepth`、`placement`、`trimStrings`。
- worldbook 组合字段：`probability`、`useProbability`、`depth`、`group`、`groupWeight`、`scanDepth`。

### 8.2 当前项目已支持（对应真实素材需求）

- Slash 执行内核已稳定支持：管道、块、`/if`、`/while`、`/times`、`/return`、`/break`、`/abort`。
- 高频命令已覆盖：`/send`、`/trigger`、`/if`、`/let` 及变量链路（`set/get/add/inc/dec`）。
- parser 深语义第一切片已落地：
  - `/parser-flag`（`STRICT_ESCAPING`、`REPLACE_GETVAR`）；
  - debug gate 下 `/breakpoint`；
  - `scopeDepth/parserFlags` 执行期透传。
- regex/worldbook 基线能力可运行（`st-baseline-regex`、`st-baseline-worldbook` 已在基线回归通过）。

### 8.3 当前真实素材仍待补充

- regex 组合场景专项回归：
  - 已补齐 `V2.0Beta.png` 与 `Sgw3.*` 的 `runOnEdit/substituteRegex/minDepth/maxDepth` 组合断言（素材驱动测试已固化）。
- worldbook 组合语义回归：
  - 已补齐 `probability/useProbability/depth/group/groupWeight` 的执行链一致性测试，并修复 `useProbability/groupWeight` 兼容读取。
- parser 深语义第二切片仍缺：
  - 严格转义与 parser 指令交互细节（在当前第一切片基础上继续对齐上游）。

### 8.4 非真实素材需求之外仍建议补充的能力

- TavernHelper 长尾 API（低频但兼容面相关）：
  - 继续收敛 `util/regex/displayed-message` 等簇，保持 fail-fast。
- 低频 slash 命令族的机会性补齐：
  - 不作为主线优先级，但需在真实脚本触发失败时补齐最小闭环。
- 解析/调试可观测性增强：
  - 在现有 `debug:breakpoint` 基础上继续补齐更细粒度 parser 执行轨迹（仅在 debug gate 下生效）。

## 9. 2026-03-04 十八轮执行结果（素材驱动收敛）

- 新增 regex 素材回归：
  - `lib/core/__tests__/st-baseline-regex-material.test.ts`
  - 覆盖 `Sgw3.card.json` 与 `Sgw3.png` 关键字段分布一致性；
  - 覆盖 `Sgw3.*` 的 `minDepth/maxDepth` 边界过滤；
  - 覆盖 `V2.0Beta.png` 的 `runOnEdit/substituteRegex` 元信息完整性。
- 新增 worldbook 组合回归：
  - `lib/core/__tests__/st-baseline-worldbook-material.test.ts`
  - 覆盖 `服装随机化.json` 的 `useProbability/depth/groupWeight` 导入保真；
  - 覆盖 `probability/useProbability/depth/group/groupWeight` 执行链一致性（含分组筛选 + depth 注入）。
- 主线修复与兼容收敛：
  - `normalizeRegexScript` 对 `minDepth/maxDepth=null` 统一归一为 `undefined`，避免深度过滤误判；
  - worldbook 导入与存储链路补齐 `useProbability/groupWeight` 字段；
  - `WorldBookAdvancedManager` 增加 `extensions` 回退读取（`probability/useProbability/group/depth/groupWeight`）。
- 本轮验证：
  - `pnpm vitest run lib/core/__tests__/st-baseline-regex-material.test.ts lib/core/__tests__/st-baseline-worldbook-material.test.ts lib/core/__tests__/st-baseline-worldbook.test.ts lib/core/__tests__/world-book-advanced-features.test.ts lib/models/__tests__/regex-script-model.property.test.ts`
  - `pnpm exec tsc --noEmit`
  - 结果：全部通过。
