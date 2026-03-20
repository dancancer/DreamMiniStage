# 执行清单（2026-03-08）

## 1. 总目标校准

- [ ] 建立新的产品语义能力矩阵，覆盖 `SillyTavern core`、`JS-Slash-Runner`、`MagVarUpdate`。
- [ ] 明确统一判定标准：`已落地 / 部分落地 / 脚本层已落地 / 未落地`。
- [ ] 停止仅以命令覆盖率作为主要完成度指标。

## 2. Phase 1：模型与生成语义闭环

- [x] 梳理模型参数当前真实数据流（UI / localStorage / preset / workflow / LLM）。
- [x] 修复 preset 参数保留与转换，不再硬编码覆盖 `openai_max_context/openai_max_tokens/temperature/top_p/...`。
- [x] 修复 workflow / LLM 参数透传链路。
- [x] 增加模型高级设置 UI。
- [x] 增加真实请求参数断言测试。

## 3. Phase 2：Prompt 行为产品面

- [x] 统一 Prompt 行为状态源（preset / instruct / sysprompt / context / stop strings）。
- [x] 增加对应 UI 面板。
- [x] 保证 UI 与 slash 命令操作同一状态源。
- [x] 增加 prompt viewer 的最终生效配置展示。

## 4. Phase 3：会话、消息、群聊、Quick Reply

- [x] 设计 Quick Reply 产品面与状态模型。
- [x] 设计群聊基础产品面与状态模型。
- [x] 对齐 swipe / branch / message mutation / JSONL 行为。
- [x] 将相关宿主能力接入真实 `/session` 页面。

## 5. Phase 4：世界书、正则、Persona 与迁移体验

- [x] 建立迁移语义检查清单。
- [x] 增强导入结果报告。
- [x] 建立真实素材迁移样例集。
- [x] 对齐 Persona / 世界书 / 正则组合工作流。
- [x] 完成 Phase 4 统一运行时收敛（generation runtime / slash 宏时序 / render pipeline / store action 分层）。
- [ ] 下一轮若继续停留在 Phase 4，仅允许补强样例、迁移语义表达与评审整理；不再继续主骨架改造。

## 6. Phase 5：JS-Slash-Runner 宿主完成度

- [x] 整理宿主能力矩阵与 fail-fast 矩阵。
- [x] 增强 Script Debugger。
- [x] 拉通高价值宿主能力的真实产品路径。
- [x] 明确哪些能力默认支持、条件支持、显式不支持。
- [x] Phase 5 Batch 1：完成 `tool registration / audio / extension-state / clipboard` 这组首批宿主语义切片的矩阵建模、调试可视化与定向验证。
- [x] Phase 5 Batch 2：完成 `clipboard` 默认宿主读写、`extension-state` 默认读路径、`extension-toggle` 条件支持保留，以及 host-debug 对这批 slash 路径的来源解析。
- [x] Phase 5 Batch 3：提炼 `/session` host wiring 模块，并拉通 `gallery` 的默认宿主路径、最小产品面与 host-debug 语义。
- [x] Phase 5 Batch 4：提炼 `/session` 消息事件模块，并把 `gallery` 扩到“角色头像 + 会话图片链接”的更真实素材集合。
- [x] Phase 5 Batch 5：提炼 `/session` 的 store-backed slash host（`checkpoint / group / timed-effect`），并把 `gallery` 扩到 opening messages 素材集合。
- [x] Phase 5 Batch 6：将 `/session/page.tsx` 收口为入口壳，主页面逻辑下沉到 `session-page-content.tsx`，避免入口文件继续膨胀。
- [x] Phase 5 Batch 7：提炼 `/session` 的 slash 执行器与主视图路由层，继续压缩 `session-page-content.tsx`。
- [x] Phase 5 Batch 8：将 `/session` 内容页继续拆成 route state / page effects / layout / dialogue actions / quick-reply adapter，彻底压回多文件职责边界内。
- [x] Phase 5 Batch 9：补全 host capability matrix，把 `/session` 已落地的 navigation / proxy / quick-reply / checkpoint / group-member / translate / yt-script / timed-world-info` 纳入单一支持矩阵与 debugger 展示。
- [x] Phase 5 Batch 10：让 `/session` 页面直输 slash 与 iframe script bridge 共享同一 host-debug 记录链，避免 debugger 只能观察脚本路径。
- [x] Phase 5 Batch 11：让 `/session` 页面直输 slash 复用默认 UI host（`popup / bubble / default / closechat` 等）并把这批 bridge-only 能力纳入 host matrix。
- [x] Phase 5 Batch 12：让 `/session` 页面直输 slash 继续复用共享默认 UI host（`theme / movingui / css-var / panels / resetpanels / vn`）并把 `panel-layout` 纳入 host matrix。
- [x] Phase 5 Batch 13：让 `/session` 页面直输 slash 继续复用共享默认 UI host（`bg / lockbg / unlockbg / autobg`）并把 `background` 纳入 host matrix。

## 7. Phase 6：MagVarUpdate 产品化

- [x] 明确 MVU 标准工作流。
- [x] 增加变量调试与可视化面板。
- [x] 打通 MVU 与真实会话生成链路。
- [x] 建立 MagVarUpdate 真实样例回放集。

## 8. 阶段回顾机制（强制）

- [x] 建立统一阶段质检门 `pnpm verify:stage`（lint、typecheck、vitest run、build）。
- [x] 将“每阶段完成后必须执行 `pnpm verify:stage`，未通过不得进入 review/PR/下一阶段”写入规划、计划与 `AGENTS.md`。
- [x] 每个阶段都必须从最新主干签出新的 `codex/` 前缀阶段分支。
- [ ] 当前阶段完成后，必须基于该阶段分支提交 PR；PR 未合入前不得进入下一阶段开发。
- [ ] 下一阶段必须在当前阶段 PR 合入主干后，重新从最新主干签出新分支。
- [x] 每个阶段完成后必须做一次阶段 review。
- [x] 每次 review 必须记录方向校准、问题清单、剩余优先级重排、下一阶段目标。
- [x] review 结论必须同步更新到 `docs/plan` 当前版本文档。
