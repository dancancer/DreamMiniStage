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

- [ ] 设计 Quick Reply 产品面与状态模型。
- [ ] 设计群聊基础产品面与状态模型。
- [ ] 对齐 swipe / branch / message mutation / JSONL 行为。
- [ ] 将相关宿主能力接入真实 `/session` 页面。

## 5. Phase 4：世界书、正则、Persona 与迁移体验

- [ ] 建立迁移语义检查清单。
- [ ] 增强导入结果报告。
- [ ] 建立真实素材迁移样例集。
- [ ] 对齐 Persona / 世界书 / 正则组合工作流。

## 6. Phase 5：JS-Slash-Runner 宿主完成度

- [ ] 整理宿主能力矩阵与 fail-fast 矩阵。
- [ ] 增强 Script Debugger。
- [ ] 拉通高价值宿主能力的真实产品路径。
- [ ] 明确哪些能力默认支持、条件支持、显式不支持。

## 7. Phase 6：MagVarUpdate 产品化

- [ ] 明确 MVU 标准工作流。
- [ ] 增加变量调试与可视化面板。
- [ ] 打通 MVU 与真实会话生成链路。
- [ ] 建立 MagVarUpdate 真实样例回放集。

## 8. 阶段回顾机制（强制）

- [x] 建立统一阶段质检门 `pnpm verify:stage`（lint、typecheck、vitest run、build）。
- [x] 将“每阶段完成后必须执行 `pnpm verify:stage`，未通过不得进入 review/PR/下一阶段”写入规划、计划与 `AGENTS.md`。
- [x] 每个阶段都必须从最新主干签出新的 `codex/` 前缀阶段分支。
- [ ] 当前阶段完成后，必须基于该阶段分支提交 PR；PR 未合入前不得进入下一阶段开发。
- [ ] 下一阶段必须在当前阶段 PR 合入主干后，重新从最新主干签出新分支。
- [ ] 每个阶段完成后必须做一次阶段 review。
- [ ] 每次 review 必须记录方向校准、问题清单、剩余优先级重排、下一阶段目标。
- [ ] review 结论必须同步更新到 `docs/plan` 当前版本文档。
