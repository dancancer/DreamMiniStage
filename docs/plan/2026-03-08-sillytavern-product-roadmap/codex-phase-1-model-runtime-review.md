# Review Report: `codex/phase-1-model-runtime`

- Review target: `codex/phase-1-model-runtime`
- Base branch: `main`
- Merge base: `06e556264664961120df144f53bdb65ba9b851bd`
- Overall correctness: **patch is incorrect**

## Executive Summary

这次审查聚焦 `codex/phase-1-model-runtime` 相对 `main` 的改动。

这批改动把模型高级参数和 runtime 配置收口到了统一层，方向是对的；但当前仍有 2 个作者大概率会立即修复的问题：

1. 新增的每配置 `Streaming` 默认值，实际会被聊天页的全局 `streamingEnabled` 持续覆盖，导致配置级开关失效。
2. 新增的 `Timeout` / `Max Retries` 在 UI 中作为通用高级参数暴露，但对 Gemini / Ollama 路径并未真正生效，属于可保存但不兑现语义的配置项。

因此当前结论仍然是：**不建议按现状合入**。

## Findings

### [P1] Stop overriding every config's streaming default

- Location: `/Users/xupeng/mycode/DreamMiniStage/hooks/character-dialogue/useDialoguePreferences.ts:43`

#### Problem

`buildDialogueLlmConfig()` 现在总是把 `{ streaming: streamingEnabled }` 作为 request 层传入，而 `resolveModelAdvancedSettings()` 会让 request 层优先于 `activeConfig.advanced`。

这意味着模型侧边栏中保存的每配置 `Streaming` 默认值，在正常聊天链路里会被聊天页头部的全局 `streamingEnabled` 覆盖：

- `send`
- `regenerate`
- `continue`

这些路径最终都不会按当前模型配置自己的 `advanced.streaming` 生效，而是继续跟着单一的聊天 UI 开关走。

#### Impact

当用户保存两个具有不同 `Streaming` 默认值的模型配置时，切换配置本身并不会改变实际请求行为；除非用户再去手动切换聊天页头部的全局开关。

这会让“配置级 Streaming 开关”变成一个看起来存在、实际上不会影响正常聊天请求的假配置。

#### Why This Should Be Fixed

这里混淆了两层语义：

- 聊天页即时开关：控制当前会话发送行为
- 模型配置默认值：控制切换到该配置后的默认行为

如果保留这两个层次，就不能让 request 层无条件覆盖 session/config 层；否则新增的 per-config `Streaming` 功能实际上并未打通。

---

### [P2] Scope timeout/retry controls to supported backends

- Location: `/Users/xupeng/mycode/DreamMiniStage/components/model-sidebar/DesktopSidebarView.tsx:102`

#### Problem

侧边栏现在把 `Timeout` 与 `Max Retries` 作为通用高级参数暴露给所有模型类型，但当前只有 OpenAI 路径真正消费了这两个值。

具体表现：

- `handleTestModel()` 中，Gemini / Ollama 测试路径没有使用这两个参数。
- `LLMNodeTools.createLLM()` 中，也只有 OpenAI 分支传入了 `timeout` / `maxRetries`；Gemini / Ollama 分支没有对应接线。

因此用户虽然可以在 UI 中填写、保存并反复看到这两个字段，但对 Gemini / Ollama 生成与测试都不会产生实际效果。

#### Impact

这会制造明显的语义错位：

- UI 宣称这些是模型高级参数。
- 持久化层也会保存它们。
- 但非 OpenAI 后端不会兑现这些配置。

结果就是用户以为自己已经配置了超时和重试保护，实际请求行为却没有改变，排障时会非常误导。

#### Why This Should Be Fixed

对于这种会影响失败边界和稳定性的参数，系统要么：

1. 只在支持的后端上展示；
2. 要么把它们真正贯穿到所有展示它们的后端实现里。

当前这种“对所有类型开放输入，但只有一部分后端生效”的状态，会把配置系统变成不可靠的承诺。

## Conclusion

当前补丁的主要问题不在于方向，而在于**配置面已经扩张，但语义闭环还没有完成**：

- `Streaming` 的配置级默认值没有真正进入正常聊天主链路。
- `Timeout` / `Max Retries` 的 UI 暴露范围大于实际支持范围。

建议先修掉这两个问题，再继续推进 phase 1 的 runtime 收口工作。
