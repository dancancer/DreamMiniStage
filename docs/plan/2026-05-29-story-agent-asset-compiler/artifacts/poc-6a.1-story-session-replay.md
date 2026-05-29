# POC-6a.1 StorySession Replay

## Goal

Verify that one `SessionBlueprint` can drive consecutive turns through the new runtime while preserving:

- character prompt identity
- recent transcript
- world hits
- render state
- post-processed screen output

## Fixture

`lib/story-agent/runtime/__tests__/story-session.test.ts` uses a synthetic blueprint with:

- one system prompt: `Stay in character.`
- one `WorldModule`
- one output transform: `raw -> screen`
- one `choice-list` `RenderIntent`

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Result

Passed as part of the targeted Phase 6a test set:

```text
function/dialogue/__tests__/opening-baseline.test.ts
function/dialogue/__tests__/init-workflow.test.ts
function/dialogue/__tests__/chat-first-message.test.ts
function/dialogue/__tests__/chat-streaming.test.ts
lib/story-agent/runtime/__tests__/story-session.test.ts
lib/generation-runtime/__tests__/prepare-dialogue-execution.test.ts
lib/generation-runtime/__tests__/run-dialogue-generation.test.ts
```

Observed assertions:

- prepared model messages contain the compiled world hit `Alpha lore`
- `scriptTools` is absent from `LLMConfig`
- output transform produces `screen answer`
- committed transcript roles are `user`, `assistant`
- committed render state contains `choices`
