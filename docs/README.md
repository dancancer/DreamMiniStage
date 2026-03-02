# 文档导航（2026-03）

本目录已完成一次面向 SillyTavern 对齐工作的文档清理，目标是：

- 保留当前仍有效、可执行的文档；
- 将历史阶段性报告集中归档；
- 建立单一入口，避免“多个版本结论互相冲突”。

## 当前优先阅读

1. 对齐现状与缺口（最新）
   - `docs/analysis/sillytavern-integration-gap-2026-03.md`
   - `docs/analysis/ai-session-handoff-2026-03-02.md`（会话交接与下一步执行清单）
2. 项目入门与运行
   - `docs/GETTING_STARTED.md`
3. 架构与核心机制
   - `docs/ARCHITECTURE.md`
   - `docs/EVENT_SYSTEM.md`
   - `lib/script-runner/README.md`（脚本执行器实现说明）
   - `hooks/script-bridge/README.md`（脚本桥接能力说明）
4. 关键能力参考
   - `docs/API_PROMPT_MANAGER.md`
   - `docs/API_MACRO_EVALUATOR.md`
   - `docs/MACRO_REFERENCE.md`
   - `docs/PRESET_FORMAT.md`
   - `docs/MIGRATION_GUIDE.md`（仅保留 SillyTavern 导入流程，不再包含历史本地数据迁移）

## 已归档（历史版本）

以下文档已归档到 `docs/archive/2026-03-integration-refresh/`，原因是内容阶段性较强、且与最新结论重复或冲突：

- `SILLYTAVERN_INTEGRATION_REPORT.md`
- `sillytavern-gap-analysis.md`
- `sillytavern-integration-gap-latest.md`
- `INTEGRATION_TASKS.md`
- `MASTER_MIGRATION_PLAN.md`
- `baseline-gap-report.md`
- `slash-command-comparison.md`
- `slash-command-behavior-diff.md`
- `message-assembly-analysis.md`
- `COMPATIBILITY_DEBT_REPORT.md`
- `ANY_TYPES_FIX_REPORT.md`
- `legacy-docs/SCRIPT_API_REFERENCE.md`
- `legacy-docs/SCRIPT_RUNNER_ARCHITECTURE.md`
- `legacy-docs/WORLDBOOK_INJECTION_COMPARISON.md`
- `legacy-docs/PROBLEM.md`

归档文档保留原始内容，不作为当前实施依据。
