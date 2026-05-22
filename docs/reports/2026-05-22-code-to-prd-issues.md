# Code-to-PRD Issue Log

> 日期：2026-05-22
> 来源：`code-to-prd` analyzer/scaffolder、人工阅读当前源码、文档对照。

## 1. P1 - 真实路由 `/test-script-runner` 未被旧 PRD 覆盖

**现象**

旧 PRD 只覆盖 8 个页面，未覆盖 `app/test-script-runner/page.tsx`。

**影响**

`/test-script-runner` 是真实路由，虽然属于内部 QA 页面，但缺失页面文档会让路由清单不完整。

**处理**

本轮已新增 `prd/pages/09-test-script-runner.md`，并在 PRD README 中标注为内部验证页面。

## 2. P1 - `code-to-prd` scaffold 会把内部模块和测试误识别为页面

**现象**

scaffolder 基于文件系统生成了 54 个 page stubs，其中包含：

- `app/i18n/*`
- `app/session/__tests__/*`
- `app/session/session-*.ts`
- `app/test-script-runner/scenario-helpers.ts`

这些不是用户可访问的业务页面。

**影响**

如果不人工过滤，PRD 会膨胀成模块清单，业务读者无法判断真实页面边界。

**处理**

本轮生成 PRD 时已人工过滤为真实路由与用户可见 modal/panel 入口，未把内部 helper/test 文件落成页面 PRD。后续若继续使用 `code-to-prd`，需要固定执行“真实路由过滤”：

- 只保留 `page.tsx` 对应路由和用户可访问的 modal/panel 入口。
- 内部 helper/test 文件放到 appendix 或 architecture，不拆成页面 PRD。

## 3. P1 - 认证能力的代码与当前可见产品入口不一致

**现象**

`hooks/useAuth.ts` 和 `lib/api/auth.ts` 支持邮箱/密码、token、注册、用户名更新等 API 路径；但 `components/LoginModal.tsx` 当前只提供 guest name 登录。

**影响**

如果 PRD 写成“支持正式账号登录”，会把未暴露的 API client 当成当前产品能力。

**处理**

本轮选择 guest/local-first：

- `hooks/useAuth.ts` 已移除远端登录/注册/token 刷新调用，仅保留本地 guest 身份。
- `lib/api/auth.ts` 已删除，避免 dormant API client 被误读为当前产品能力。
- `lib/api/README.md`、`docs/ARCHITECTURE.md`、`docs/BUSINESS_REQUIREMENTS.md` 已同步当前边界。

## 4. P2 - 多个源码文件超过 400 行维护线

**现象**

按 `find app components hooks lib function types -type f (*.ts|*.tsx) | wc -l` 粗扫，非测试文件中超过 400 行的典型文件包括：

| 行数 | 文件 |
|------|------|
| 588 | `hooks/script-bridge/capability-matrix.ts` |
| 580 | `hooks/script-bridge/compat-handlers.ts` |
| 577 | `lib/core/prompt/post-processor.ts` |
| 573 | `components/model-sidebar/MobileSidebarView.tsx` |
| 566 | `lib/mvu/core/executor.ts` |
| 566 | `hooks/script-bridge/host-capability-matrix.ts` |
| 561 | `lib/core/token-manager.ts` |
| 558 | `lib/mvu/variable-init.ts` |
| 549 | `lib/slash-command/registry/index.ts` |
| 538 | `lib/slash-command/registry/handlers/js-slash-runner.ts` |
| 534 | `lib/slash-command/registry/handlers/quick-reply.ts` |
| 525 | `components/character-chat/MessageItem.tsx` |
| 524 | `lib/prompt-viewer/performance.ts` |
| 523 | `hooks/script-bridge/slash-command-bridge.ts` |
| 514 | `components/prompt-viewer/PromptViewerErrorBoundary.tsx` |
| 507 | `lib/core/regex-processor.ts` |
| 504 | `lib/core/world-book-cascade-loader.ts` |
| 494 | `lib/nodeflow/WorkflowEngine.ts` |
| 487 | `lib/store/prompt-viewer-store.ts` |
| 484 | `lib/nodeflow/PresetNode/PresetNodeTools.ts` |
| 480 | `components/CharacterChatPanel.tsx` |
| 475 | `lib/mvu/core/parser.ts` |
| 475 | `components/WorldBookEditor.tsx` |
| 469 | `lib/extensions/summarize.ts` |
| 467 | `lib/core/extension-prompts.ts` |
| 461 | `components/Sidebar.tsx` |
| 451 | `lib/data/roleplay/regex-script-operation.ts` |
| 451 | `hooks/script-bridge/compat-regex-handlers.ts` |
| 437 | `components/worldbook-editor/WorldBookTable.tsx` |
| 436 | `lib/prompt-config/service.ts` |
| 430 | `hooks/script-bridge/variable-handlers.ts` |
| 421 | `lib/data/local-storage.ts` |
| 420 | `lib/script-runner/message-bridge.ts` |
| 418 | `components/regex-editor/RegexScriptEditor.tsx` |
| 416 | `components/DialogueTreeModal.tsx` |
| 414 | `lib/core/memory-manager.ts` |
| 414 | `hooks/script-bridge/character-handlers.ts` |
| 413 | `components/PresetEditor.tsx` |
| 405 | `lib/slash-command/core/parser.ts` |
| 405 | `lib/plugins/plugin-discovery.ts` |

**影响**

这些文件大多处于高复杂域：slash、script bridge、prompt、MVU、编辑器。继续堆积会增加回归风险。

**处理**

本轮已处理 `code-to-prd` 明确点名、且最适合低风险切分的两类静态清单：

- `lib/slash-command/registry/index.ts` 已拆为 `command-group-foundation.ts`、`command-group-conversation.ts`、`command-group-generation.ts`、`command-group-operators.ts`，入口仅负责 compose。
- `hooks/script-bridge/capability-matrix.ts` 已拆为 API 矩阵、slash 聚合、core slash、extended slash 四个文件。
- 剩余超过 400 行的行为密集模块已落入 `docs/reports/2026-05-22-line-count-backlog.md`，后续按单域重构与定向测试推进。

## 5. P2 - 仓库跟踪了 `.backup` 源文件

**现象**

当前 git 跟踪了：

- `components/RegexScriptEditor.tsx.backup`
- `hooks/useRegexScripts.ts.backup`
- `lib/slash-command/registry.ts.backup`

**影响**

备份文件会污染代码搜索、PRD 静态扫描和维护判断。尤其 `registry.ts.backup` 与真实 `registry/index.ts` 同名域接近，容易误读。

**处理**

本轮已删除这三个被跟踪的 `.backup` 源文件，并在 `.gitignore` 中加入 `*.backup`，防止再次入仓。

## 6. P2 - 旧文档时间线和当前代码事实混杂

**现象**

旧 `docs/README.md` 使用 `2026-03` 导航语境，`app/session/README.md` 内有多段历史变更记录。历史记录有价值，但不适合作为当前架构入口。

**影响**

新同学或评审者可能把历史计划、已完成重构和当前产品事实混在一起。

**处理**

本轮已重写 `docs/README.md` 和 `docs/ARCHITECTURE.md`，把历史资料降级为背景入口。

## 7. P3 - 注释风格不一致

**现象**

仓库中同时存在中文分块注释、英文简短注释、旧的兼容说明和少量过时描述。例如部分文件头仍写“re-export / 向后兼容”，但项目当前策略要求严格收敛兼容路径。

**影响**

注释会制造“仍需兼容旧入口”的心理负担。

**处理**

本轮已清理当前检索到的 stale 兼容叙述：

- 删除 `components/RegexScriptEditor.tsx` 旧 re-export 入口，调用方改为直接使用 `components/regex-editor/RegexScriptEditor.tsx`。
- `hooks/script-bridge/types.ts`、`lib/core/world-book-advanced.ts`、`lib/core/st-preset-runtime.ts`、`lib/data/agent/agent-conversation-operations.ts` 已移除“re-export / 向后兼容”表述。
- `lib/core/world-book-loader.ts` 旧 wrapper 已删除，调用方直接使用 `loadWorldBooksFromSources`。
- `PluginRegistry.executeTool` 无引用兼容入口已删除。

## 验证记录

- `pnpm exec eslint <touched code files>`：通过。
- `pnpm vitest run app/session/__tests__/session-content-view.test.tsx app/session/__tests__/page.slash-integration.test.tsx lib/nodeflow/__tests__/preset-summary-injection.test.ts lib/nodeflow/__tests__/preset-active-selection.test.ts`：40 tests passed。
- `pnpm vitest run hooks/script-bridge/__tests__/api-surface-contract.test.ts hooks/script-bridge/__tests__/host-capability-matrix.test.ts lib/slash-command/__tests__/p1-messages.test.ts lib/slash-command/__tests__/p3-extension-command-gaps.test.ts`：22 tests passed。
- `pnpm verify:stage`：PASS lint / typecheck / test / build，223 files、1934 tests passed。
