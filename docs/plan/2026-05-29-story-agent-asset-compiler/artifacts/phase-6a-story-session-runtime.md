# SAC-Phase 6a StorySession Runtime

## Scope

`SAC-Phase 6a` replaces the product generation path with a blueprint-native runtime. `/session` now prepares model requests from:

- compiled `SessionBlueprint`
- persisted `StorySession`
- recent transcript
- `WorldModule` matcher output
- input/output text transforms
- compiled `RenderIntent` rules

It does not parse character cards, ST presets, raw worldbook entries, runtime regex `placement`, MVU state, slash script or TavernHelper assets during generation.

## State Model

Runtime state lives in `StorySessionState`:

| Field | Purpose |
| --- | --- |
| `dialogueId` | Product dialogue binding |
| `blueprintId` | Compiled `SessionBlueprint` binding |
| `recentTranscript` | Last 24 user/assistant turns used by prompt assembly |
| `worldbookActivationState` | Sticky/cooldown/delay counters keyed by `moduleId:entryId` |
| `renderState.activeIntentIds` | UI intents active after the latest turn |

Long-term memory, summaries and consolidation policy remain deferred to `SAC-Phase 6b`.

## Runtime Flow

1. `prepareDialogueExecution()` calls `loadStoryRuntimeBinding(dialogueId)`.
2. Missing `StorySession` or missing `SessionBlueprint` fails fast.
3. `prepareStoryTurn()` applies input transforms, matches `WorldModule`, assembles prompt messages and builds `LLMConfig`.
4. `runDialogueGeneration()` invokes the model using the story `LLMConfig`.
5. `finalizeDialogueResult()` rejects non-story contexts.
6. `finalizeStoryTurn()` applies output transforms and persists the next `StorySessionState`.
7. `processPostResponseAsync()` writes the assistant response to the dialogue tree and refreshes the UI summary cache.

## Slash And Script Boundary

`/session` no longer executes slash/script bridge paths.

- `app/session/session-slash-executor.ts` rejects direct slash input.
- Quick Reply is plain input only; `/` payloads reject.
- `hooks/useScriptBridge.ts` records a fail-fast host-debug entry and throws.

This is a hard replacement, not a feature flag or dual runtime.
