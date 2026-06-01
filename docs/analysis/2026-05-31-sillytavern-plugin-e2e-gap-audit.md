# SillyTavern plugin E2E gap audit

Date: 2026-05-31

## Scope

This audit compares the current DreamMiniStage Story Agent path against the local upstream SillyTavern lab with the common plugins enabled. The goal is not to copy SillyTavern. The goal is to identify which asset semantics still need to be compiled into DreamMiniStage's own `SessionBlueprint` and runtime.

Upstream lab:

| Component | Version |
| --- | --- |
| SillyTavern | `51ad27f`, `1.18.0`, `http://127.0.0.1:8001` |
| JS-Slash-Runner | `8d735f2` |
| MagVarUpdate | `c1ae3a9` |

DreamMiniStage:

| Component | Version |
| --- | --- |
| Dev app | `http://localhost:3304` |
| Model policy | `deepseek-v4-pro`, `contextWindow=1000000`, `max_tokens=8192`, `stream=false` |

## Method

SillyTavern was checked through the live local lab and its persisted multi-turn chats:

| Card | Upstream chat messages | Observed semantics |
| --- | ---: | --- |
| `Sgw` | 7 | `<UpdateVariable>`, visible reasoning/planning style text |
| `theater` | 5 | `<开局>`, `<UpdateVariable>`, `<action>` |
| `origin` | 5 | `<UpdateVariable>`, `StatusDashboard` style UI |
| `seagull` | 5 | `<opening_scene>`, visible reasoning/planning style text |

Upstream request-shape baselines are the committed actual-model traces in:

- `docs/analysis/2026-05-30-sillytavern-sgw-parity-lab.md`
- `docs/analysis/2026-05-30-sillytavern-multicard-parity-lab.md`

DreamMiniStage was tested in a fresh browser context. The browser imported four real assets through `/story-agent-import`, created sessions, sent one message per card, and made real browser requests to a local OpenAI-compatible capture endpoint. The capture endpoint returned deterministic assistant text containing `<UpdateVariable>`, `<action>`, and `<SFW>` blocks so rendering behavior was auditable without model randomness.

Transient local artifacts:

- `/tmp/dream-current-audit/report.json`
- `/tmp/dream-current-audit/requests.ndjson`
- `/tmp/dream-current-audit/*.png`
- `/tmp/st-current-audit.png`

Targeted regression tests also passed:

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/state-update.test.ts lib/story-agent/render-intent/__tests__/runtime.test.ts lib/story-agent/import/__tests__/flow.test.ts
pnpm vitest run function/dialogue/__tests__/chat-streaming.test.ts lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Current Dream Results

| Card | Import result | Render rules | Request messages | Prompt chars | `stream` | `max_tokens` | UI result |
| --- | --- | ---: | ---: | ---: | --- | ---: | --- |
| `Sgw` | pass | 3 | 45 | 29,525 | `false` | 8192 | status panel rendered, state panel rendered |
| `seagull` | pass | 0 | 7 | 6,442 | `false` | 8192 | plain narrative path |
| `theater` | pass | 2 | 42 | 43,368 | `false` | 8192 | state panel rendered, action buttons rendered, action click appends input |
| `origin` | pass | 6 | 23 | 24,465 | `false` | 8192 | opening UI appears, later status JSON can leak when no matching contract exists |

Closed since the previous parity reports:

1. `seagull` no longer fails import on empty or non-list embedded regex data.
2. Non-streaming is honored at the wire layer. Captured requests used `stream=false`.
3. `deepseek-v4-pro` token policy is active. Captured requests used `max_tokens=8192`.
4. `<UpdateVariable>` is hidden from visible assistant text and can produce a `Story State` panel.
5. `<action>` is hidden from visible assistant text and can produce an `Actions` panel. Clicking `检查侧门` appended `检查侧门` to `#send_textarea`.
6. Theater's instruction-only `<开局>` opener is no longer shown or sent as the playable opening. Follow-up evidence: `docs/analysis/2026-06-01-story-agent-theater-opening-e2e.md`.
7. Story Agent model calls now go through `/api/model-gateway/chat-completions`; follow-up E2E evidence is in `docs/analysis/2026-06-01-story-agent-model-gateway-e2e.md`.
8. Import preview now surfaces high-signal feature-loss diagnostics and the generated first opening. Follow-up evidence: `docs/analysis/2026-06-01-story-agent-import-diagnostics-e2e.md`.
9. Prompt topology is normalized before the model request while preserving source provenance in debug metadata. Follow-up evidence: `docs/analysis/2026-05-31-story-agent-prompt-topology-e2e.md` and `docs/analysis/2026-06-01-story-agent-preset-role-topology-e2e.md`.
10. `origin` card collapsible UI source tags now render through structured `RenderIntent` panels. Follow-up evidence: `docs/analysis/2026-06-01-story-agent-origin-collapsible-render-e2e.md`.
11. Sgw MVU-style initial variables are compiled from `[InitVar]` entries into the blueprint, seed `StorySession.storyState` before turn 1, and reach the first model request through `[Session memory]`. The old `{{get_message_variable::stat_data}}` echo is stripped from world context to avoid duplicated state sources. Follow-up evidence: `docs/analysis/2026-06-01-story-agent-initial-state-e2e.md`.

## Remaining Gaps

### 1. Status/UI coverage is inconsistent by card family

`Sgw` now has a working status render contract. The captured response's `<SFW>{...}</SFW>` became a status panel and did not leak raw tags.

`origin` opening UI now renders its imported `StatusDashboard`, `UnitCard`, and `MissionProtocol` blocks as structured collapsible panels. The remaining issue is broader: `theater` has state/action UI but no status contract, and any card that emits an unsupported status-like tag can still degrade into visible raw data if the contract is missing.

Required behavior should be deterministic:

- If a status-like tag is compiled into a render intent, render it.
- If a status-like tag is unsupported, remove it with an explicit unsupported diagnostic or leave it as escaped plain text with a clear user-visible warning.
- Do not silently strip the tag and expose raw JSON as story prose.

### 2. MagVarUpdate semantics are still broader than initial state bootstrap

The current runtime can consume simple `<UpdateVariable>` commands after the model emits them. Sgw-style initial variables are also compiled and seeded before the first user turn.

The larger plugin behavior is still not fully covered:

- cards that rely on `StatusDashboard` or custom MVU variables still need card-specific state schema extraction;
- `status_current_variables` is now runtime-owned for the covered Sgw path, but broader card families still need extraction coverage;
- visible reasoning/planning text from upstream-style prompts remains possible and needs a QA/output policy.

The important distinction: we should not execute MagVarUpdate. We should compile the variable model it implies.

### 3. RenderIntent coverage is still narrow

Theater action choices now work. Origin's opening collapsible dashboard now works. But community-card UI is broader than the current whitelist:

- status dashboards;
- multi-section meters;
- world/map controls;
- collapsible long summaries;
- card-specific action widgets;
- media/opening player widgets.

Unsupported UI should become an explicit import-time/product diagnostic. Silent degradation is still too easy.

### 4. Legacy render pipeline still sits under Story Agent messages

`MessageBubble` still runs `useMessageRenderPipeline` before rendering Story Agent `RenderIntentView`. That means the story path still shares old HTML/tag/script rendering machinery. The current hard-replace runtime is cleaner than before, but rendering still has a mixed boundary:

- `RenderIntent` is safe and structured;
- old tag/HTML parsing can still affect content before/around the structured UI.

This should be split so Story Agent messages use a dedicated structured renderer and legacy script/HTML behavior is not accidentally reintroduced.

## Closed Opening Lifecycle Notes

The original opening lifecycle blocker is mostly closed in current probes:

- `Sgw` and `origin` expose pre-turn opening navigation and can switch alternate greetings.
- `theater` no longer displays or prompts with its instruction-only opener:

```text
<开局>
请按下面要求处理
</开局>
```

The import page now shows the actual first opening, the `character.instruction_only_opening` diagnostic, and the target/source path that explains why the generated opening was used.

## Recommended Next Work

1. Harden status/render contract handling.
   - Ensure unmatched status-like tags cannot leak naked JSON.
   - Add tests for `<SFW>...</SFW>` with and without matching render intent.
   - Expand status/data extraction for remaining `theater`-style families.

2. Broaden MVU-style state schema coverage.
   - Extract card-specific state schemas beyond the current Sgw `[InitVar]` pattern.
   - Keep `status_current_variables` runtime-owned for every supported MVU family.
   - Keep the execution model deterministic; do not run third-party plugin code.

3. Split Story Agent rendering from legacy HTML/script rendering.
   - Story Agent output should be plain narrative plus `RenderIntent` components.
   - Unsupported HTML/script assets should remain import diagnostics, not runtime behavior.

## Verdict

The direction is still sound. The recent fixes moved real behavior, not just docs: imports are more robust, model request settings are correct, and state/action render intents now work for concrete card patterns.

The remaining gaps are not about copying SillyTavern menus. They are about preserving the semantics that users actually experience: persistent variables, action affordances, status dashboards, and long-session stability. The next implementation pass should prioritize unmatched status/render contracts, broader MVU schema extraction, then split Story Agent rendering away from the old HTML/script pipeline.
