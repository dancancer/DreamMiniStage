---
status: accepted
date: 2026-05-29
---

# 运行时禁止外部资产格式判断

## 背景

[[0001-sillytavern-as-import-source]] 立下"运行时不解析 ST 资产"的原则，但立项 review 指出这条 invariant 当时**不可执行**：既有 `/session` 运行链路正建立在 ST 字段之上——`STPromptManager` 运行时读 `preset.openai.prompt_order`、`PresetNodeTools.convertToSTOpenAIPreset` 重新合成 ST prompts、`regex-processor` 按 `placement` 数组过滤、`world-book-advanced` 实时按 `secondary_keys/selective/delay` 匹配。不显式声明退役策略，invariant 就会沦为口号。

## 决策

运行时代码中**不得出现外部资产格式判断**，例如：

```ts
if (assetType === "sillytavern") {}
if (entry.keysecondary) {}
if (preset.prompt_order) {}
if (regex.placement === 2) {}
```

一切格式差异必须在导入和编译阶段消化掉。`StoryPromptAssembler` / `WorldModule` 只消费 `SessionBlueprint`。

## 后果

- 这要求显式排期 ST-shaped runtime 的退役，落在 SAC-Phase 6a（运行时硬替换点），策略见 [[0003-greenfield-hard-replace]]。
- 既有 `st-baseline-*` 测试只作一次性基线与语义参考；进入新 runtime 后必须重写为 import/compiler/story-runtime regression 或删除并记录原因，不得靠保留旧测试强迫产品运行时继续理解 ST 字段。
