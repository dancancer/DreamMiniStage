# Phase 2: Prompt 行为产品面 - 代码质量审查

**审查日期**: 2026-03-10
**审查范围**: `codex/phase-2-prompt-product-surface` 分支全量变更
**变更规模**: 26 个文件，+617/-155 行

---

## 执行摘要

Phase 2 的核心设计决策是**将散落在 localStorage 各处的 prompt 相关状态收口到单一 Zustand store**（`usePromptConfigStore`），并让 UI 面板与 slash 命令共享同一状态源。这是正确的架构方向，消除了状态漂移的根因。

**架构质量**: 优秀
**代码质量**: 良好（存在跨文件重复）
**400 行规范**: 不通过（3 个文件严重超标）
**测试覆盖**: 不足（新核心逻辑无测试）

---

## 架构分析

### 做得好的地方

#### 1. 三层分离清晰

```
state.ts (纯类型 + normalizer)
    ↓
service.ts (业务操作)
    ↓
prompt-config-store.ts (持久化状态管理)
```

职责划分干净，符合单一职责原则。

#### 2. catalog.ts 独立于 state

预设定义与状态逻辑解耦，后续扩展内建模板不会污染状态层。

#### 3. PromptViewerModal 的 EffectiveConfigCard

```typescript
const items = [
  ["Preset", config.presetName || "未启用"],
  ["Instruct", config.instructEnabled ? (config.instructPreset || "已启用") : "关闭"],
  ["Context", config.contextName],
  ["Sysprompt", config.syspromptEnabled ? config.syspromptName : "关闭"],
  ["Post", config.promptPostProcessing],
  ["Stops", config.stopStrings.length > 0 ? config.stopStrings.join(" | ") : "无"],
] as const;

return (
  <div className="grid gap-3 sm:grid-cols-2">
    {items.map(([label, value]) => (
      <div key={label} className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground break-words">{value}</div>
      </div>
    ))}
  </div>
);
```

**好品味**：用 `as const` 元组数组驱动渲染，零分支、零特殊情况。

#### 4. localStorage 碎片清理

移除了以下死代码：
- `CUSTOM_STOP_STRINGS_STORAGE_KEY`
- `PROMPT_POST_PROCESSING_STORAGE_KEY`
- `readStringArrayFromStorage`
- `writeStringArrayFromStorage`

干净利落。

#### 5. 测试同步更新

mock 结构从 `getActivePresetSampling` 迁移到 `getActivePromptPreset` + `resolvePromptRuntimeConfig`，断言也从 localStorage 切换到 store 验证。

---

## 问题与建议

### 🔴 严重：400 行硬性指标违规

| 文件 | 行数 | 超出 | 状态 |
|---|---|---|---|
| `app/session/page.tsx` | **1168** | 768 行 | 本次新增 ~130 行 |
| `hooks/script-bridge/slash-context-adapter.ts` | **1869** | 1469 行 | 本次新增 ~50 行 |
| `lib/nodeflow/LLMNode/LLMNodeTools.ts` | **533** | 133 行 | 已存在 |

#### 问题分析

`page.tsx` 新增的 14 个 `useCallback` 几乎是一模一样的 thin wrapper pattern：

```typescript
const handleGetInstructMode = useCallback(async () => {
  return getPromptInstructState();
}, []);

const handleSetInstructMode = useCallback(async (patch: { enabled?: boolean; preset?: string }) => {
  return updatePromptInstructState({
    enabled: patch.enabled,
    preset: patch.preset,
  });
}, []);

const handleGetStopStrings = useCallback(async () => {
  return getPromptStopStrings();
}, []);

const handleSetStopStrings = useCallback(async (stopStrings: string[]) => {
  return setPromptStopStrings(stopStrings);
}, []);

// ... 还有 10 个类似的
```

#### 建议方案

提取 `usePromptConfigCallbacks()` 自定义 hook：

```typescript
// hooks/use-prompt-config-callbacks.ts
export function usePromptConfigCallbacks() {
  const handleGetInstructMode = useCallback(async () => {
    return getPromptInstructState();
  }, []);

  const handleSetInstructMode = useCallback(async (patch) => {
    return updatePromptInstructState(patch);
  }, []);

  // ... 其余 12 个

  return {
    handleGetInstructMode,
    handleSetInstructMode,
    handleGetStopStrings,
    handleSetStopStrings,
    handleGetPromptPostProcessing,
    handleSetPromptPostProcessing,
    handleGetModel,
    handleSetModel,
    handleGetPreset,
    handleSetPreset,
    handleListPresets,
    handleSelectContextPreset,
    handleListPromptEntries,
    handleSetPromptEntriesEnabled,
  };
}
```

`page.tsx` 只需：

```typescript
const promptCallbacks = usePromptConfigCallbacks();

const apiCallContext = useMemo(() => ({
  // ... 其他回调
  ...promptCallbacks,
  // ... 其他回调
}), [
  // ... 其他依赖
  promptCallbacks,
  // ... 其他依赖
]);
```

**预期收益**：立即砍掉 ~130 行，`page.tsx` 降至 1038 行。

---

### 🟡 中等：page.tsx 与 slash-context-adapter.ts 重复逻辑

#### 问题

以下逻辑在两个文件中几乎完全一样：

| 操作 | page.tsx | slash-context-adapter.ts |
|---|---|---|
| getModel | `handleGetModel` | `defaultGetModel` |
| setModel | `handleSetModel` | `defaultSetModel` |
| getPreset | `handleGetPreset` | `getPreset` |
| listPresets | `handleListPresets` | `listPresets` |
| listPromptEntries | `handleListPromptEntries` | `listPromptEntries` |
| setPromptEntriesEnabled | `handleSetPromptEntriesEnabled` | `setPromptEntriesEnabled` |

同一段逻辑出现在两处意味着：改一处忘改另一处就会产生行为分叉。

#### 建议方案

把这些操作下沉到 `service.ts`：

```typescript
// lib/prompt-config/service.ts
export async function getActiveModel(): Promise<string> {
  const { configs, activeConfigId } = useModelStore.getState();
  const active = configs.find((config) => config.id === activeConfigId) || configs[0];
  if (!active) {
    throw new Error("No active model config");
  }
  return active.model;
}

export async function setActiveModel(model: string): Promise<string> {
  const nextModel = model.trim();
  if (!nextModel) {
    throw new Error("Model name is required");
  }

  const { configs, activeConfigId, updateConfig } = useModelStore.getState();
  const active = configs.find((config) => config.id === activeConfigId) || configs[0];
  if (!active) {
    throw new Error("No active model config");
  }

  updateConfig(active.id, { model: nextModel });
  syncModelConfigToStorage({ ...active, model: nextModel });
  return nextModel;
}

export async function listPromptEntries(): Promise<Array<{ identifier: string; name: string; enabled: boolean }>> {
  const active = await getActivePromptPreset();
  if (!active) {
    return [];
  }

  return (active.prompts || [])
    .map((prompt) => {
      const identifier = (prompt.identifier || "").trim();
      if (!identifier) {
        return null;
      }

      return {
        identifier,
        name: (prompt.name || identifier).trim() || identifier,
        enabled: prompt.enabled !== false,
      };
    })
    .filter((entry): entry is { identifier: string; name: string; enabled: boolean } => !!entry);
}

export async function setPromptEntriesEnabled(
  updates: Array<{ identifier: string; enabled: boolean }>,
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const active = await getActivePromptPreset();
  if (!active?.id) {
    throw new Error("No active preset");
  }

  const enabledMap = new Map(updates.map((item) => [item.identifier, item.enabled] as const));
  const nextPrompts = (active.prompts || []).map((prompt) => {
    const identifier = (prompt.identifier || "").trim();
    if (!identifier || !enabledMap.has(identifier)) {
      return prompt;
    }
    return {
      ...prompt,
      enabled: enabledMap.get(identifier),
    };
  });

  const saved = await PresetOperations.updatePreset(active.id, { prompts: nextPrompts });
  if (!saved) {
    throw new Error("Failed to update prompt entries");
  }
}
```

两边只做简单绑定：

```typescript
// page.tsx
const handleGetModel = useCallback(async () => getActiveModel(), []);
const handleSetModel = useCallback(async (model: string) => setActiveModel(model), []);

// slash-context-adapter.ts
const onGetModel = ctx.onGetModel ?? getActiveModel;
const onSetModel = ctx.onSetModel ?? setActiveModel;
```

---

### 🟡 中等：resolvePromptRuntimeConfig 的隐式副作用

#### 问题

`service.ts:184-190`：

```typescript
if (!useSnapshotPreset && activePreset) {
  const defaults = applyPresetPromptDefaults(activePreset);
  usePromptConfigStore.setState((state) => ({
    ...state,
    ...defaults,
  }));
}
```

函数名叫 `resolve...`，读起来像纯查询，但实际会**静默修改全局 store**。这违反了最小惊讶原则——调用者不期望 `resolve` 会写状态。

#### 建议方案

**方案 A**：将同步逻辑提取为独立函数

```typescript
function syncActivePresetIfNeeded(
  snapshot: PromptBehaviorState,
  activePreset: Preset | null,
): void {
  const useSnapshotPreset = Boolean(
    snapshot.activePresetId && activePreset?.id === snapshot.activePresetId,
  );

  if (!useSnapshotPreset && activePreset) {
    const defaults = applyPresetPromptDefaults(activePreset);
    usePromptConfigStore.setState((state) => ({
      ...state,
      ...defaults,
    }));
  }
}

export async function resolvePromptRuntimeConfig(input: {
  characterId: string;
  username?: string;
}): Promise<ResolvedPromptRuntimeConfig> {
  const snapshot = getPromptConfigSnapshot();
  const activePreset = await getActivePromptPreset();

  syncActivePresetIfNeeded(snapshot, activePreset);

  // ... 其余逻辑
}
```

**方案 B**：在函数签名/注释中明确标注副作用

```typescript
/**
 * 解析当前 prompt 运行时配置
 *
 * ⚠️ 副作用：如果 snapshot 中没有 activePresetId 但存在 activePreset，
 * 会自动同步 preset 默认值到 store
 */
export async function resolvePromptRuntimeConfig(/* ... */) {
  // ...
}
```

推荐方案 A，因为它让副作用显式化。

---

### 🟡 中等：normalizeContextPresetField 与 normalizeContextPreset 重复

#### 问题

`preset-import.ts` 新增的 `normalizeContextPresetField` 与 `state.ts` 的 `normalizeContextPreset` 逻辑几乎完全一致，只多了一个 `isNonNullObject` 前置检查。

#### 建议方案

```typescript
// preset-import.ts
function normalizeContextPresetField(value: unknown): STContextPreset | undefined {
  if (!isNonNullObject(value)) {
    return undefined;
  }
  return normalizeContextPreset(value as Partial<STContextPreset>);
}
```

`normalizeSyspromptField` 同理可部分复用 `normalizeSyspromptState`：

```typescript
function normalizeSyspromptField(value: unknown): STSyspromptPreset | undefined {
  if (!isNonNullObject(value)) {
    return undefined;
  }

  const normalized = normalizeSyspromptState(value as Partial<STSyspromptPreset>);
  const content = normalized.content.trim();
  const postHistory = normalized.post_history.trim();

  if (content.length === 0 && postHistory.length === 0) {
    return undefined;
  }

  return {
    name: normalized.name,
    content: normalized.content,
    post_history: normalized.post_history,
  };
}
```

---

### 🟢 轻微：Stop Strings 的逐键触发

#### 问题

`PromptBehaviorPanel.tsx:140-143`：

```typescript
const handleStopStringsChange = useCallback((value: string) => {
  setStopStringText(value);
  setPromptStopStrings(value.split("\n"));
}, []);
```

Textarea 每按一个字符都会触发 `setPromptStopStrings`（写 Zustand + 持久化）。虽然不太可能造成性能问题，但 debounce 300ms 是更优雅的做法。

#### 建议方案

```typescript
import { useDebouncedCallback } from "use-debounce";

const handleStopStringsChange = useDebouncedCallback((value: string) => {
  setPromptStopStrings(value.split("\n"));
}, 300);

const handleStopStringTextChange = useCallback((value: string) => {
  setStopStringText(value);
  handleStopStringsChange(value);
}, [handleStopStringsChange]);
```

---

### 🟢 轻微：空回调体

#### 问题

`AdvancedSettingsEditor.tsx:105`：

```typescript
<TagColorEditor
  onSave={() => {
  }}
  onViewSwitch={onViewSwitch}
/>
```

`TagColorEditor` 的 `onSave` 回调体为空。

#### 建议

如果 `onSave` 是 required prop，这是有意保留的占位符吗？如果不再需要回调，应该让 `onSave` 变为 optional 并移除传入。

---

### 🟡 中等：新增核心逻辑缺少单元测试

#### 问题

以下新文件包含大量纯函数与状态逻辑，但没有对应的测试文件：

- `lib/prompt-config/state.ts` — normalizer、builder、resolveEffectivePostProcessingMode
- `lib/prompt-config/service.ts` — selectPromptPresetById、resolvePromptRuntimeConfig
- `lib/prompt-config/catalog.ts` — findBuiltInContextPreset、findInstructPreset
- `lib/store/prompt-config-store.ts` — setActivePreset、setInstruct、setSysprompt 等

这些都是纯函数或轻量 store 操作，非常适合做单元测试。

#### 建议

至少为 `state.ts` 和 `catalog.ts` 补充覆盖：

```typescript
// lib/prompt-config/__tests__/state.test.ts
describe("normalizeContextPreset", () => {
  it("应该填充默认值", () => {
    const result = normalizeContextPreset({});
    expect(result.name).toBe("Default");
    expect(result.story_string).toBe("");
  });

  it("应该保留提供的值", () => {
    const result = normalizeContextPreset({
      name: "Custom",
      story_string: "{{description}}",
    });
    expect(result.name).toBe("Custom");
    expect(result.story_string).toBe("{{description}}");
  });
});

// lib/prompt-config/__tests__/catalog.test.ts
describe("findBuiltInContextPreset", () => {
  it("应该找到 Default 预设", () => {
    const result = findBuiltInContextPreset("Default");
    expect(result?.name).toBe("Default");
  });

  it("应该忽略大小写", () => {
    const result = findBuiltInContextPreset("minimal");
    expect(result?.name).toBe("Minimal");
  });

  it("未找到时返回 undefined", () => {
    const result = findBuiltInContextPreset("NonExistent");
    expect(result).toBeUndefined();
  });
});
```

---

### 🟢 轻微：PresetNodeTools.ts 位于 398 行刀尖上

#### 问题

`PresetNodeTools.ts` 现在 398 行，距离 400 行只差 2 行。下一次任何改动都会触发违规。

#### 建议

将 `buildContextPresetMessage` 静态方法（~30 行）提取到独立的 utility 文件：

```typescript
// lib/nodeflow/PresetNode/preset-utils.ts
export function buildContextPresetMessage(
  promptManager: STPromptManager,
  env: MacroEnv,
  contextPreset?: STContextPreset,
): ChatMessage | null {
  if (!contextPreset) {
    return null;
  }

  const isDefaultContext = contextPreset.name === DEFAULT_CONTEXT_PRESET.name
    && contextPreset.story_string === DEFAULT_CONTEXT_PRESET.story_string;
  if (isDefaultContext) {
    return null;
  }

  const content = promptManager.renderStoryString(env).trim();
  if (!content) {
    return null;
  }

  const role = contextPreset.story_string_role === 1
    ? "user"
    : contextPreset.story_string_role === 2
      ? "assistant"
      : "system";

  return {
    role,
    content,
    name: contextPreset.name,
  };
}
```

---

### 🟢 轻微：其他小项

#### 1. enabledPreset 查找条件变更

`PresetNodeTools.ts:275` 的 `enabledPreset` 查找条件从 `preset.enabled === true` 改为 `preset.enabled !== false`——语义上扩大了匹配范围（包括 `undefined`）。

**确认**：这是有意行为吗？如果是，建议在注释中说明。

#### 2. generationConfig 类型扩展

`gemini-client.ts:162` 的 `generationConfig` 类型从 `Record<string, number>` 改为 `Record<string, unknown>`——正确，因为现在有 `string[]` 类型的 `stopSequences`。

#### 3. DialogueWorkflow 参数膨胀

`DialogueWorkflow.ts` 的 `initParams` / `outputFields` 数组持续膨胀（现在约 30 个参数）——长期看应该用 params 对象替代线性参数列表。

---

## 安全性

- ✅ 没有发现注入风险或密钥泄露问题
- ✅ `syncModelConfigToStorage` 是对本地 store 的操作，不涉及网络
- ✅ zustand `persist` 使用 localStorage，符合客户端应用的安全模型

---

## 总结评价

| 维度 | 评分 | 说明 |
|---|---|---|
| 架构方向 | ⭐⭐⭐⭐⭐ | 单一状态源是正确决策 |
| 代码质量 | ⭐⭐⭐⭐ | 新文件层次清晰，但存在跨文件重复 |
| 400 行规范 | ❌ | page.tsx / slash-context-adapter.ts 严重超标 |
| 测试覆盖 | ⭐⭐⭐ | 已有测试更新到位，但新核心逻辑无测试 |
| 可维护性 | ⭐⭐⭐ | resolvePromptRuntimeConfig 的隐式副作用需治理 |

---

## 建议在合并前处理的项

### 必须处理（阻塞合并）

1. **提取 `usePromptConfigCallbacks()` hook**（缓解 page.tsx 膨胀）
2. **消除 page.tsx 与 slash-context-adapter.ts 的重复逻辑**（下沉到 service.ts）
3. **显式化 `resolvePromptRuntimeConfig` 的副作用**（提取 `syncActivePresetIfNeeded`）

### 建议处理（改进质量）

4. 消除 `normalizeContextPresetField` 与 `normalizeContextPreset` 的重复
5. 为 `state.ts` 和 `catalog.ts` 补充单元测试
6. 提取 `buildContextPresetMessage` 到独立 utility 文件
7. 为 Stop Strings 输入添加 debounce

### 可延后处理（技术债）

8. 治理 `slash-context-adapter.ts` 的 1869 行（长期重构）
9. 将 `DialogueWorkflow` 的线性参数列表改为 params 对象
10. 明确 `enabledPreset` 查找条件变更的意图

---

## 附录：变更文件清单

### 新增文件（5 个）

- `components/prompt-config/PromptBehaviorPanel.tsx` (350 行)
- `lib/prompt-config/catalog.ts` (70 行)
- `lib/prompt-config/service.ts` (195 行)
- `lib/prompt-config/state.ts` (177 行)
- `lib/store/prompt-config-store.ts` (125 行)

### 修改文件（21 个）

- `app/session/page.tsx` (+165 行)
- `components/AdvancedSettingsEditor.tsx` (+22 行)
- `components/prompt-viewer/PromptViewerModal.tsx` (+34 行)
- `function/dialogue/__tests__/chat-first-message.test.ts` (+58 行)
- `function/dialogue/chat-shared.ts` (+24 行)
- `function/dialogue/chat-streaming.ts` (+4 行)
- `function/dialogue/chat.ts` (+12 行)
- `function/preset/global.ts` (+24 行)
- `hooks/script-bridge/slash-context-adapter.ts` (+104 行)
- `lib/adapters/import/preset-import.ts` (+58 行)
- `lib/core/gemini-client.ts` (+6 行)
- `lib/data/roleplay/preset-operation.ts` (+2 行)
- `lib/models/preset-model.ts` (+3 行)
- `lib/nodeflow/LLMNode/LLMNode.ts` (+4 行)
- `lib/nodeflow/LLMNode/LLMNodeTools.ts` (+8 行)
- `lib/nodeflow/LLMNode/model-invokers.ts` (+2 行)
- `lib/nodeflow/PresetNode/PresetNode.ts` (+12 行)
- `lib/nodeflow/PresetNode/PresetNodeTools.ts` (+84 行)
- `lib/prompt-viewer/prompt-interceptor.ts` (+10 行)
- `lib/slash-command/__tests__/p3-sysprompt-command-gaps.test.ts` (+7 行)
- `lib/slash-command/registry/utils/system-message.ts` (+52 行)
- `lib/workflow/examples/DialogueWorkflow.ts` (+18 行)
- `types/prompt-viewer.ts` (+3 行)

---

**审查人**: Claude Opus 4.6
**审查完成时间**: 2026-03-10
