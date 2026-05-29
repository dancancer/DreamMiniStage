# SAC-Phase 6a Runtime Replacement Report

## Decision

Hard-replace the product generation path. The runtime consumes `SessionBlueprint` and `StorySession` only. There is no feature flag, compatibility branch or fallback to the old ST-shaped generation path.

Rollback strategy remains operational: revert the Phase 6a commit or reset to the previous commit. The codebase does not keep a dual runtime.

## Replacement Matrix

| Coupling Area | Phase 6a Result | Evidence |
| --- | --- | --- |
| Prompt runtime | Replaced with `prepareStoryTurn()` and `assemblePromptContext()` | `prepareDialogueExecution()` imports `loadStoryRuntimeBinding()` and `prepareStoryTurn()` |
| ST workflow bridge | Removed from product generation | No product-path `DialogueWorkflow` grep hits |
| Regex runtime | Replaced by compiled input/output transforms and `RenderIntent` state | No product-path `RegexProcessor` or runtime `placement` grep hits |
| Worldbook runtime | Replaced by `matchWorldModules()` plus `StorySession.worldbookActivationState` | `story-session.test.ts` covers sticky/cooldown/delay state |
| MVU / vector memory | Removed from Phase 6a generation response processing | `processPostResponseAsync()` no longer imports MVU or vector memory |
| Script bridge / slash | Rewritten as fail-fast story boundary | `session-slash-executor.ts` rejects slash input; `useScriptBridge.ts` rejects script messages |
| Storage | Added blueprint/session stores | `STORY_BLUEPRINTS_FILE`, `STORY_SESSIONS_FILE` in `lib/data/local-storage.ts` |

## Remaining Non-Runtime References

`hooks/script-bridge/host-debug-state` remains referenced by `/session` UI because the script debug panel still needs a stable fail-fast debug payload. This is not an execution path and does not call `hooks/script-bridge` handlers.

Import/compile code may still read ST asset fields such as regex `placement`. That is allowed before `SessionBlueprint` creation and is outside the runtime grep scope.

## Targeted Verification

```bash
pnpm vitest run function/dialogue/__tests__/opening-baseline.test.ts function/dialogue/__tests__/init-workflow.test.ts function/dialogue/__tests__/chat-first-message.test.ts function/dialogue/__tests__/chat-streaming.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts lib/generation-runtime/__tests__/prepare-dialogue-execution.test.ts lib/generation-runtime/__tests__/run-dialogue-generation.test.ts
pnpm vitest run app/session/__tests__/session-slash-executor.test.ts app/session/__tests__/session-chat-actions.test.ts app/session/__tests__/page.slash-integration.test.tsx components/__tests__/CharacterChatPanel.bridge.test.tsx function/dialogue/__tests__/chat-shared.test.ts
pnpm typecheck
pnpm lint
```

All targeted commands passed before full `pnpm verify:stage`.

## Cutover Gate

Full stage gate passed:

```bash
pnpm verify:stage
```

Result:

```text
PASS lint
PASS typecheck
PASS test: 235 files / 1933 tests
PASS build
Gate passed
```
