# SillyTavern 整合增量计划（2026-03-03）

> 目标：在保持当前稳定性的前提下，优先收敛“迁移成功率瓶颈”，再进入 Playwright E2E。  
> 当前基线：Slash 覆盖 `21.71%`，TavernHelper API 覆盖 `43.08%`。

## 1) 规划原则（本轮执行约束）

- 单路径优先：同类能力只保留一个主入口（去掉双入口/兼容回写）。
- fail-fast：未实现能力显式报错，不做静默兜底。
- 指标驱动：每个阶段都以“覆盖率 + 回归结果”作为完成判定。
- 小步快跑：每个阶段最多改一个能力面，改完立刻 `pnpm vitest run` 回归。

## 2) 优先级路线图（可逐步试错）

### P0（最高优先）工具调用主链路收敛

**目标**
- 打通 `registerFunctionTool -> LLM tool_calls -> 回调执行 -> 结果回传` 单路径。
- 补齐 TavernHelper 变量高价值缺口：`registerVariableSchema`、`updateVariablesWith`、`insertVariables`。

**建议先试的最小切片**
1. 先把 `registerFunctionTool` 生命周期收敛到一个注册表（注册、调用、清理、重注册）。
2. 再把 `LLMNodeTools` 的 tool call 执行路径接到该注册表。
3. 最后补齐上面 3 个变量 API，并加失败语义（参数错误直接 fail-fast）。

**完成门槛**
- `extension-lifecycle`、`api-surface-contract`、`mvu-handlers-option-semantics` 全绿。
- 新增“函数工具闭环”专项测试（至少覆盖同步与异步 callback 两条路径）。

### P1（高优先）MVU strict 语义 + Slash 宏条件流

**目标**
- 将 `strictSet` / `strictTemplate` / `concatTemplateArray` 从“类型声明”推进到“执行器生效”。
- 解除 `st-baseline-slash-command` 中宏条件流 skip（`{{getvar::}}` 相关）。

**建议先试的最小切片**
1. 先实现 `strictSet` 执行语义，并补充冲突/拒绝写入测试。
2. 再做 Slash 条件表达式的宏预处理层（仅注入已支持宏，未知宏报错）。
3. 最后解除 skip 并固定行为快照。

**完成门槛**
- `st-baseline-slash-command.test.ts` 的宏条件流 skip 清零（或仅保留有明确豁免说明的最小集合）。
- `st-baseline-mvu.test.ts` 全绿。

### P2（中优先）扩展高频 Slash 命令族

**目标**
- 从“可迁移脚本使用频率”出发补命令，不追求一次性追平 258。
- 优先补 `checkpoint / chat-manager / api / branch / ui` 等常见迁移阻塞命令族。

**建议先试的最小切片**
1. 基于 `test-baseline-assets` 和现有脚本样本抽取 Top N 命令频次。
2. 每轮只补一族命令（含参数签名 + 错误语义 + 测试）。
3. 每轮更新覆盖率并评估收益。

**完成门槛**
- Slash 覆盖率从 `21.71%` 提升到 `>= 30%`。
- 新增命令全部有回归测试和最少一个失败路径测试。

### P3（中优先）TavernHelper API 缺口收敛

**目标**
- 将 API 覆盖从 `43.08%` 推进到 `>= 55%`。
- 优先补脚本执行链上“直接导致迁移失败”的 API，而非低频边缘 API。

**建议先试的最小切片**
1. 先补 import_raw / script buttons / version 相关高频读取接口。
2. 再补 extension 管理相关接口（若宿主不支持则显式 fail-fast）。
3. 持续保持 shim 与 handler capability matrix 同步。

**完成门槛**
- 覆盖率 `>= 55%`。
- `api-surface-contract` 仍保持全绿。

### P4（触发阶段）Playwright MCP E2E

**触发条件（全部满足才进入）**
- Slash 覆盖率 `>= 30%`
- TavernHelper API 覆盖率 `>= 55%`
- 宏条件流 skip 收敛完成
- P0/P1 核心回归全绿

**E2E 场景来源**
- 使用 `test-baseline-assets` 中的脚本/会话素材，优先覆盖：
  1) 脚本注册与调用  
  2) Slash 控制流脚本  
  3) MVU 变量更新链路  
  4) 音频/事件命令链路

## 3) 里程碑与退出条件

- M1（完成 P0）：工具闭环稳定可回归。
- M2（完成 P1）：MVU strict + Slash 宏条件流达成可测等价。
- M3（完成 P2/P3）：覆盖率达到 E2E 门槛。
- M4（完成 P4）：Playwright 场景可重复通过，形成可持续回归资产。
