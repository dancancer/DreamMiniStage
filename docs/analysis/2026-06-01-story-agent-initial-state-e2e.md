# Story Agent initial state E2E verification

Date: 2026-06-01

## Scope

This check verifies that Story Agent imports compile MVU-style initial variables
into the `SessionBlueprint`, seed `StorySession.storyState` before the first user
turn, and send the resulting state through the runtime-owned session memory
channel.

The test also checks that legacy SillyTavern variable echo text is not duplicated
inside world context.

## Fixture

- App: `http://localhost:3303`
- Import page: `http://localhost:3303/story-agent-import`
- Source asset: `test-baseline-assets/character-card/Sgw3.png`
- Model config: OpenAI-compatible `deepseek-v4-pro`
- Captured endpoint: `**/api/model-gateway/chat-completions`
- Response: mocked OpenAI-compatible JSON body

The mock route only prevents external model variance. The inspected artifact is
the real browser request body emitted by DreamMiniStage.

## Flow

1. Open `/story-agent-import`.
2. Upload `Sgw3.png`.
3. Run `检查资产`.
4. Create the Story Agent.
5. Enter the generated session.
6. Send `你好，今天发生了什么？`.
7. Capture the POST body sent to `/api/model-gateway/chat-completions`.

## Assertions

The generated summary is:

```json
{
  "containsInitialRelationshipState": true,
  "containsFirstTurnSessionMemory": true,
  "containsUpdateVariableRule": true,
  "containsUnresolvedHandlebarMacros": false,
  "containsLegacyStatDataEcho": false,
  "actualStateSnapshotBlockCount": 1,
  "worldContextContainsActualStateSnapshot": false,
  "worldContextContainsLegacyEcho": false,
  "sessionMemoryContainsStateSnapshot": true
}
```

Key result:

- `[World context]` keeps the variable update policy text.
- `[Session memory]` carries the single structured state snapshot.
- `{{get_message_variable::stat_data}}` no longer appears in the model request.
- The first user turn sees compiled relationship variables such as `高松灯.好感度`,
  `长崎素世.好感度`, and `丰川祥子.好感度`.

## Artifacts

- Screenshot: `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-e2e.png`
- Request body: `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-request-body.json`
- Summary: `docs/analysis/artifacts/2026-06-01-story-agent-initial-state-e2e-summary.json`

## Verdict

Initial MVU-style state for the tested Sgw card now crosses the full path:
import asset -> `SessionBlueprint.initialState` -> `StorySession.storyState` ->
first-turn model request.

The remaining MVU work is broader schema coverage and output policy, not the
basic first-turn state bootstrap.
