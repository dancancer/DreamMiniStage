# DreamMiniStage Documentation

> 更新时间：2026-05-22

本目录按“当前代码事实”重新整理。历史计划和阶段报告仍保留，但产品、架构和 PRD 判断优先看下列文档。

## 主要文档

| 文档 | 用途 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 当前系统架构、路由、状态、存储、生成链路、slash/script bridge 边界 |
| [BUSINESS_REQUIREMENTS.md](BUSINESS_REQUIREMENTS.md) | 业务目标、用户角色、核心能力、非目标、验收规则 |
| [../prd/README.md](../prd/README.md) | 使用 `code-to-prd` 生成并人工校准的 PRD 总入口 |
| [reports/2026-05-22-code-to-prd-issues.md](reports/2026-05-22-code-to-prd-issues.md) | 本轮代码阅读和文档生成发现的问题清单 |

## 能力专题

| 文档 | 用途 |
|------|------|
| [API_MACRO_EVALUATOR.md](API_MACRO_EVALUATOR.md) | 宏求值 API 与运行规则 |
| [API_PROMPT_MANAGER.md](API_PROMPT_MANAGER.md) | Prompt 管理能力 |
| [CHAT_JSONL_IMPORT_EXPORT.md](CHAT_JSONL_IMPORT_EXPORT.md) | 会话 JSONL 导入导出 |
| [EVENT_SYSTEM.md](EVENT_SYSTEM.md) | 事件系统 |
| [MACRO_REFERENCE.md](MACRO_REFERENCE.md) | 宏语法参考 |
| [PRESET_FORMAT.md](PRESET_FORMAT.md) | SillyTavern 预设格式 |
| [VECTOR_MEMORY.md](VECTOR_MEMORY.md) | 向量记忆能力 |

## 工程与部署

| 文档 | 用途 |
|------|------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | 本地开发启动 |
| [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) | 迁移说明 |
| [BASELINE_TEST_PLAN.md](BASELINE_TEST_PLAN.md) | 基线测试计划 |
| [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) | Vercel 部署 |

## 历史资料

- `docs/analysis/`：专项分析与历史技术判断。
- `docs/plan/`、`docs/plans/`：阶段计划。
- `docs/reports/`：审查报告、问题记录、阶段输出。

历史文档可能包含已过期的文件名、路线或能力假设。更新业务/架构/PRD 时必须回到当前源码复核。
