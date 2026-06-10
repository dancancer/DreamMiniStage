# 架构决策记录（ADR）

本目录沉淀 DreamMiniStage 关键的、难以逆转的架构决策与其背后的**用户意图和权衡**，让后来者（含 AI 评审）看代码时不再困惑"当初为什么这么做"，也避免反复重提已被否决的方案。

格式遵循 `~/.claude/skills/grill-with-docs/ADR-FORMAT.md`：顺序编号、每篇聚焦一个决策、记录"决策 + 为什么"，必要时补"被否决的替代方案"与"后果"。

来源：本批 ADR 提炼自 2026-05-29 Story Agent 路线的立项会话（Codex session `019e725e-…`）、其产出的 `docs/plan/2026-05-29-story-agent-asset-compiler/plan.md` 与三轮 Claude blocker review。

## 索引

| 编号 | 决策 | 状态 |
|------|------|------|
| [0001](0001-sillytavern-as-import-source.md) | SillyTavern 仅作导入源，一次性编译为 SessionBlueprint，运行时不再解析原始资产 | accepted |
| [0002](0002-no-external-asset-format-checks-at-runtime.md) | 运行时禁止外部资产格式判断（无 `prompt_order`/`placement`/`keysecondary` 分支） | accepted |
| [0003](0003-greenfield-hard-replace.md) | 绿地 hard-replace：不双轨、不迁移、不 legacy/shadow flag | accepted |
| [0004](0004-llm-repair-typed-patch-deterministic-risk.md) | LLM 质检修复仅输出 typed patch，risk 由确定性 path map 决定 | accepted |
| [0005](0005-ui-only-render-intent-whitelist.md) | UI 仅走 RenderIntent 白名单，unsupported 显式诊断不静默 | accepted |
| [0006](0006-stateful-world-activation-in-story-session.md) | 世界书有状态激活（sticky/cooldown/delay）归 StorySession，不写回静态定义 | accepted |
| [0007](0007-runtime-owned-story-state.md) | Story State / status 变量由 runtime 拥有；首轮只编译静态初始变量 | accepted |
| [0008](0008-story-render-mode-boundary.md) | Story Agent 渲染走 story render mode，与 legacy RegexProcessor 有运行时边界 | accepted |
| [0009](0009-capability-parity-trunk-goal.md) | 主干目标：对真实 SillyTavern + 插件做能力对齐（gap-driven）；分支能力非主干、后置 | accepted |
| [0010](0010-variable-convention-registry-with-llm-fallback.md) | 初始变量提取：确定性 Variable Convention 注册表 + 导入期 LLM 推断兜底 | accepted |
