# Line Count Backlog

> 日期：2026-05-22
> 来源：`find app components hooks lib function types -type f (*.ts|*.tsx)`，排除 `__tests__` 与 `*.test.*`。

## 已处理

| 原文件 | 处理结果 |
|--------|----------|
| `lib/slash-command/registry/index.ts` | 拆为 `command-group-foundation.ts`、`command-group-conversation.ts`、`command-group-generation.ts`、`command-group-operators.ts`，入口保留 compose。 |
| `hooks/script-bridge/capability-matrix.ts` | 拆为 `capability-matrix-api.ts`、`capability-matrix-slash.ts`、`capability-matrix-slash-core.ts`、`capability-matrix-slash-extended.ts`。 |

## 剩余队列

这些文件仍超过 400 行。它们多为行为密集模块，后续应按测试覆盖与业务切片分批拆，不建议在文档整理任务中机械切开。

| 行数 | 文件 | 建议切片 |
|------|------|----------|
| 612 | `app/test-script-runner/scenarios.ts` | 拆 `scenario-definitions`、happy-path runners、failure runners。 |
| 610 | `lib/slash-command/types/execution.ts` | 按 host 能力域拆分接口后再由入口聚合。 |
| 580 | `hooks/script-bridge/compat-handlers.ts` | 按 import/extension/script-tree/version 能力拆分。 |
| 577 | `lib/core/prompt/post-processor.ts` | 拆 parser、transform、validation。 |
| 576 | `lib/mvu/core/schema.ts` | 拆 schema domains 与 type guards。 |
| 573 | `components/model-sidebar/MobileSidebarView.tsx` | 拆 layout、provider picker、advanced controls。 |
| 566 | `lib/mvu/core/executor.ts` | 拆 command dispatch 与 mutation apply。 |
| 566 | `hooks/script-bridge/host-capability-matrix.ts` | 按 host capability area 分片。 |
| 561 | `lib/core/token-manager.ts` | 拆 tokenizer adapter、budget calculator、message trimming。 |
| 558 | `lib/mvu/variable-init.ts` | 拆 default state、migration、validation。 |
| 544 | `lib/slash-command/core/executor.ts` | 拆 parse/execute/chain error policy。 |
| 538 | `lib/slash-command/registry/handlers/js-slash-runner.ts` | 按 audio/event helper 分片。 |
| 534 | `lib/slash-command/registry/handlers/quick-reply.ts` | 按 set/context/command 三组拆分。 |
| 525 | `components/character-chat/MessageItem.tsx` | 拆 message chrome、actions、reasoning、swipe controls。 |
| 524 | `lib/prompt-viewer/performance.ts` | 拆 collectors 与 formatters。 |
| 523 | `hooks/script-bridge/slash-command-bridge.ts` | 拆 argument validation、callback bridge、ownership cleanup。 |
| 514 | `components/prompt-viewer/PromptViewerErrorBoundary.tsx` | 拆 boundary、fallback view、debug metadata。 |
| 507 | `lib/core/regex-processor.ts` | 拆 script filtering、execution、replacement policy。 |
| 504 | `lib/core/world-book-cascade-loader.ts` | 拆 source loading、cascade merge、activation filter。 |
| 494 | `lib/nodeflow/WorkflowEngine.ts` | 拆 node scheduling、edge traversal、execution state。 |

## 处理规则

- 先拆静态清单和纯函数模块，再拆 UI 与执行器。
- 每次只拆一个行为域，并同时跑对应定向测试。
- 拆分后入口文件仍保留稳定导出路径，避免调用方无意义扩散修改。
