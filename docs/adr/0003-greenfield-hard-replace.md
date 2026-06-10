---
status: accepted
date: 2026-05-29
---

# 绿地 hard-replace：不双轨、不迁移、不 feature flag

## 背景与用户意图

项目仍处于开发阶段。要让 [[0002-no-external-asset-format-checks-at-runtime]] 真正成立，必须决定既有 ST-shaped runtime 是"替换"还是"共存"。

用户原话（立项会话）：

> "我们的项目还在开发阶段，无需做任何的历史数据兼容或者之类的处理逻辑，一切都按最彻底的方式来做，不要搞什么过渡方案，双轨方案。"

## 决策

对既有 ST-shaped runtime 采取 **hard replace**：

- 不做历史数据兼容、不做旧 IndexedDB 迁移、不保留双轨运行时、不加 legacy/shadow feature flag、不做灰度切换。
- 旧数据、旧 runtime、旧 schema、旧测试若与新路线冲突，在对应阶段直接替换、删除或重写。
- SAC-Phase 6a 是产品运行时替换点；生成链路在此接管，不再调用 `STPromptManager`、`PresetNodeTools.convertToSTOpenAIPreset` 和 runtime `placement` 分支。
- **回滚预案**：失败时回到上一 commit 或整批 revert 当前阶段变更，**不在代码里保留旧 runtime 作为 fallback**。

## 被否决的替代方案

- **共存 / 双轨 + feature flag 渐进切换**：否决——只要 `/session` 仍可能跑旧 runtime，"运行时不认 ST 字段"就是假命题，且永久背负兼容债。

## 后果

- cutover 是 big-bang，不可回退面较大；为缩小该面，长期记忆从 6a 拆出到 SAC-Phase 6b（最小 runtime 先跑通，记忆系统失败不阻塞 cutover）。
- 任何"为兼容/过渡而保留旧路径"的重构建议都与本决策冲突，应先重开本 ADR 再讨论。
