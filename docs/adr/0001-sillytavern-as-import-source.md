---
status: accepted
date: 2026-05-29
---

# SillyTavern 仅作导入源，一次性编译为 SessionBlueprint

## 背景与用户意图

项目最初的目标是"用比较现代的方式复刻 SillyTavern 的功能"。2026-05-29 用第一性原理重新梳理后，用户真实需求被澄清为：**选定一个角色卡、世界书、预设（正则通常内嵌其中）之后，就能稳定地推进一个很长的角色故事会话，并图形化渲染必要的 UI**——而不是逐项复刻上游的所有菜单和插件。

用户原话（立项会话）：

> "不用拘泥于原来的功能，而是使用第一性原理来梳理核心的用户需求……需要能稳定地推进很长的对话，需要图形化地渲染必要的 UI。"
> "在用户选择了角色卡、世界书、预设和正则之后，我们需要根据选择的这些做个一次性的转换，生成一个类似会话配置之类的东西，然后在真正会话进行的时候，不用在运行时去解析那些 SillyTavern 的资产。"

## 决策

SillyTavern 是**导入源格式，不是运行时架构**。用户选定资产后做一次性编译，产出 DreamMiniStage 自有的、版本化、可 diff、可 hash 的 `SessionBlueprint`，作为 `StorySession` 运行时的唯一输入契约。真实会话期间不再解析 `chara`/`ccv3`/`prompt_order`/`keysecondary`/`placement` 等上游细节。导入期负责智能纠错与适配，把普通用户生成的不完善资产修正好，而不是把错误带进运行时。

## 被否决的替代方案

- **运行时与上游保持一致**（旧 `docs/plan/2026-03-08-sillytavern-product-roadmap` 路线）：否决——把脆弱的上游格式判断永久耦合进发货运行时，无法稳定长会话。本路线 supersede 该 roadmap。
- **共存双 runtime**：否决，详见 [[0003-greenfield-hard-replace]]。

## 后果

- 旧 roadmap 识别的能力 gap（模型参数、prompt/preset、世界书、正则、MVU、slash 差距）仍是有效输入，但必须重新归入导入/编译/运行时替换阶段，不再作为"运行时必须保持上游形状"的要求。
- 该决策的可执行形式见 [[0002-no-external-asset-format-checks-at-runtime]]。
