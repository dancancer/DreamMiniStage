# SAC-Phase 0 Runtime Inventory

> 本文件定义 hard-replace 爆炸半径。结论只有三类：保留为导入验证、重写为 story-runtime 验证、删除。没有过渡运行时。

## 1. Prompt Side

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `lib/core/prompt/manager.ts` | `STPromptManager` consumes ST-shaped preset and prompt_order | Delete from `/session`; keep only as baseline reference until replacement report closes |
| `lib/nodeflow/PresetNode/PresetNodeTools.ts` | `convertToSTOpenAIPreset()` synthesizes ST prompt_order and prompts | Replace with `SessionBlueprint -> PromptStack` compiler/runtime |
| `lib/prompt-viewer/prompt-builder.ts` | Prompt preview follows ST assembly assumptions | Rewrite preview to inspect `SessionBlueprint` assembly |
| `lib/core/prompt/preset-utils.ts` | helper logic around ST prompt shape | Replace or delete after PromptStack POC |
| `lib/core/prompt/sorting.ts` | sorting helper for current preset prompt shape | Replace with blueprint prompt order contract |
| `lib/core/prompt/manager-helpers.ts` | ST manager helper surface | Replace or delete with `STPromptManager` removal |

Storage note: `prompt_order` is not a preset storage-layer dependency. `lib/data/roleplay/preset-operation.ts` imports legacy `prompt_order` into `group_id` / `position`, then storage operates on ordered prompts. The hard-replace target is the runtime bridge, not a storage migration.

## 2. Regex And Render Side

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `lib/core/regex-processor.ts` | Runtime filters scripts by ST `placement` and applies regex directly | Replace with compiled transforms/content rules/render intents |
| `lib/utils/content-parser.ts` | Calls regex processor for message content parsing | Rewrite to consume compiled render/content rules |
| `components/message-bubble/useMessageRenderPipeline.ts` | Render pipeline enters `parseContentAsync` | Rewrite to consume sanitized render model; no raw HTML/CSS/JS widget execution |

Deletion timing: old regex runtime deletion belongs to `SAC-Phase 6a`, not Phase 5. Phase 5 only proves classification, RenderIntent feasibility and unsafe fallback behavior.

## 3. Worldbook Side

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `lib/core/world-book-advanced.ts` | Runtime handles ST entry fields directly, including stateful activation | Replace with `WorldModule` matcher and `StorySession.worldbookActivationState` |

Observed stateful semantics that must survive in new state:

- `sticky` / `_stickyRemaining`
- `cooldown` / `_cooldownRemaining`
- `delay` / `_delayUntilTurn`
- recursion and `maxRecursionDepth`
- `depth`
- `insertion_order`
- `selectiveLogic`
- `constant`

Static worldbook definitions must remain immutable after compilation. Per-turn counters live in `StorySession`, not in the compiled `WorldModule`.

## 4. Tool And Model Side

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `lib/tools/status/index.ts` | Writes literal `keysecondary` | Replace with new WorldModule authoring contract or delete tool path |
| `lib/tools/user-setting/index.ts` | Writes literal `keysecondary` | Replace with new WorldModule authoring contract or delete tool path |
| `lib/tools/world-view/index.ts` | Writes literal `keysecondary` | Replace with new WorldModule authoring contract or delete tool path |
| `lib/tools/supplement/index.ts` | Writes literal `keysecondary` | Replace with new WorldModule authoring contract or delete tool path |
| `lib/models/agent-model.ts` | `BaseWorldbookEntry.keysecondary` encodes ST field | Replace with blueprint-native worldbook entry model |

These files are not import adapters. They create or model runtime-facing data and therefore must not keep ST field names after cutover.

## 5. Script Bridge

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `app/session/session-slash-executor.ts` | Connects script-bridge execution to `/session` | Delete or rewrite in `SAC-Phase 6a`; no orphan runtime entry |
| `hooks/script-bridge/*` | Supports current slash/script execution flow | Keep only if rewritten as blueprint-native product feature; otherwise delete |

Decision rule: slash script, TavernHelper and MVU do not execute in the story runtime. Prompt conventions extracted from them may enter `PromptStack`, but control flow and side effects are unsupported.

## 6. Storage Boundary

| Path | Current coupling | Phase decision |
| --- | --- | --- |
| `lib/data/local-storage.ts` | Defines `PRESET_FILE`, `WORLD_BOOK_FILE`, `REGEX_SCRIPTS_FILE`, `MEMORY_ENTRIES_FILE`, vector-memory stores | Phase 1 must decide whether these stores become import-source stores, are replaced by blueprint store, or are removed |

Required decision before Phase 1 implementation:

- `SessionBlueprint` persistence path.
- Whether existing preset/worldbook/regex stores are retained only for asset library management.
- Whether Phase 6b memory reuses `MEMORY_ENTRIES_FILE` / vector memory or replaces them with `StorySession` memory stores.

No legacy migration path is needed. If the new store replaces the old one, old local data is not read by `/session`.

## 7. Baseline Tests

Existing `st-baseline-*` and `phase4-*-baseline` tests are reference material for intentional diff classification only. They are not the terminal invariant. Before `SAC-Phase 6a`, every baseline diff must be classified as:

- `bug`: must close before cutover.
- `intentional`: accepted behavior change with rationale.
- `unsupported`: product-visible limitation with diagnostics.

`SAC-Phase 6a` cannot start with unresolved `bug` diffs.

## 8. Verification Commands

Recommended inventory refresh commands:

```bash
rg -n "prompt_order|STPromptManager|convertToSTOpenAIPreset" lib app components function
rg -n "RegexProcessor|placement|parseContentAsync" lib app components function
rg -n "keysecondary|secondary_keys|selectiveLogic|sticky|cooldown|delay" lib app components function
rg -n "script-bridge|session-slash-executor|TavernHelper|MVU" app hooks lib function
rg -n "PRESET_FILE|WORLD_BOOK_FILE|REGEX_SCRIPTS_FILE|MEMORY_ENTRIES_FILE|MEMORY_EMBEDDINGS_FILE" lib
```

The replacement report must include the command output summary and the final file decisions.
