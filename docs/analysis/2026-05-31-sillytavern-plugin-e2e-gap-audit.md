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

## Remaining Gaps

### 1. Opening selection is not wired through the created Story Agent session

`Sgw` compiles 11 openings and `origin` compiles 8 openings, but the session view did not show the opening navigator in the E2E run. This is a direct product gap because upstream SillyTavern supports switching alternate greetings before committing the first user turn.

Theater still displays its instruction-only opener:

```text
<开局>
请按下面要求处理
</开局>
```

That opener is useful as a trigger/instruction convention, but it is not a good user-facing first message.

### 2. Prompt topology is still too fragmented

Upstream ST requests in the committed traces use a compact alternating shape, usually 4 to 8 messages over these short runs. Dream now sends many small system messages:

| Card | Dream roles |
| --- | --- |
| `Sgw` | 39 system, 4 assistant, 2 user |
| `theater` | 40 system, 1 assistant, 1 user |
| `origin` | 21 system, 1 assistant, 1 user |
| `seagull` | 5 system, 1 assistant, 1 user |

This is not a request to mimic ST's exact layout. The issue is that the current compiler is exposing internal asset fragments as request topology. That makes prompt inspection harder and increases provider-specific risk. We need a story prompt normalizer that compacts adjacent same-role fragments into a small number of semantically named blocks.

Good signal: current user input appeared once in each captured request, and no `{{char}}` / `{{user}}` macros remained unresolved.

### 3. Status/UI coverage is inconsistent by card family

`Sgw` now has a working status render contract. The captured response's `<SFW>{...}</SFW>` became a status panel and did not leak raw tags.

`theater` has state/action UI but no status contract. When a response contains an unmatched `<SFW>` block, the HTML/tag layer can strip the tag and leave naked JSON visible. `origin` shows the same failure mode. This is not a model issue; it is a render-contract boundary issue.

Required behavior should be deterministic:

- If a status-like tag is compiled into a render intent, render it.
- If a status-like tag is unsupported, remove it with an explicit unsupported diagnostic or leave it as escaped plain text with a clear user-visible warning.
- Do not silently strip the tag and expose raw JSON as story prose.

### 4. MagVarUpdate semantics are only partially covered

The current runtime can consume simple `<UpdateVariable>` commands after the model emits them. That closes the most obvious raw-tag leak.

The larger plugin behavior is still not covered:

- initial variable templates and default state are not consistently compiled into `StorySession.storyState`;
- cards that rely on `StatusDashboard` or custom MVU variables still need card-specific state schema extraction;
- `status_current_variables` is not guaranteed for every card that used MVU upstream;
- visible reasoning/planning text from upstream-style prompts remains possible and needs a QA/output policy.

The important distinction: we should not execute MagVarUpdate. We should compile the variable model it implies.

### 5. RenderIntent coverage is still narrow

Theater action choices now work. Origin's opening choices are visible. But community-card UI is broader than the current whitelist:

- status dashboards;
- multi-section meters;
- world/map controls;
- collapsible long summaries;
- card-specific action widgets;
- media/opening player widgets.

Unsupported UI should become an explicit import-time/product diagnostic. Silent degradation is still too easy.

### 6. Model requests still originate from the browser

The E2E capture endpoint received `/v1/chat/completions` directly from the browser context. That means the Story Agent path still exposes the provider endpoint and bearer credential to client-side execution. This was already identified in the Sgw report and remains open.

The hard-replace direction should keep the runtime clean, but the transport boundary needs a server-side model gateway before this is product-grade.

### 7. Legacy render pipeline still sits under Story Agent messages

`MessageBubble` still runs `useMessageRenderPipeline` before rendering Story Agent `RenderIntentView`. That means the story path still shares old HTML/tag/script rendering machinery. The current hard-replace runtime is cleaner than before, but rendering still has a mixed boundary:

- `RenderIntent` is safe and structured;
- old tag/HTML parsing can still affect content before/around the structured UI.

This should be split so Story Agent messages use a dedicated structured renderer and legacy script/HTML behavior is not accidentally reintroduced.

## Recommended Next Work

1. Fix multi-opening lifecycle for compiled Story Agents.
   - Show the opening navigator when `profile.openings.length > 1`.
   - Keep opening unlocked until the first user turn.
   - Add E2E coverage for `Sgw` and `origin`.

2. Add an opening compiler rule.
   - Detect instruction-only openers such as `<开局> 请按下面要求处理 </开局>`.
   - Prefer a playable alternate opening when available.
   - Otherwise show an explicit import diagnostic and a neutral generated first scene.

3. Normalize prompt topology.
   - Merge adjacent same-role system fragments into semantic sections.
   - Preserve provenance in debug metadata, not in request message count.
   - Gate with captured request snapshots.

4. Harden status/render contract handling.
   - Ensure unmatched status-like tags cannot leak naked JSON.
   - Add tests for `<SFW>...</SFW>` with and without matching render intent.
   - Expand status/data extraction for `origin` and `theater` families.

5. Compile MVU-style initial state.
   - Extract variable defaults from character/worldbook/prompt conventions.
   - Seed `StorySession.storyState` before turn 1.
   - Keep the execution model deterministic; do not run third-party plugin code.

6. Add server-side model gateway.
   - Browser should call DreamMiniStage.
   - DreamMiniStage should call the provider.
   - Keep request capture/prompt viewer hooks at the gateway boundary.

7. Split Story Agent rendering from legacy HTML/script rendering.
   - Story Agent output should be plain narrative plus `RenderIntent` components.
   - Unsupported HTML/script assets should remain import diagnostics, not runtime behavior.

## Verdict

The direction is still sound. The recent fixes moved real behavior, not just docs: imports are more robust, model request settings are correct, and state/action render intents now work for concrete card patterns.

The remaining gaps are not about copying SillyTavern menus. They are about preserving the semantics that users actually experience: greeting choice, persistent variables, action affordances, status dashboards, and long-session prompt stability. The next implementation pass should start with opening lifecycle and render/status hardening because those are immediately visible in E2E.
