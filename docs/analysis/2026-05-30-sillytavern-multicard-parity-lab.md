# SillyTavern multicard parity lab

Date: 2026-05-30

## Goal

Run several non-Sgw SillyTavern assets through the fresh upstream SillyTavern lab and DreamMiniStage Story Agent import flow. The goal is not to copy upstream UI or runtime code. The goal is to identify which asset semantics must be compiled into DreamMiniStage's own `SessionBlueprint` and story runtime.

## Lab setup

Local lab root: `/Users/xupeng/mycode/_local/sillytavern-lab`

| Component | Revision / URL | Notes |
| --- | --- | --- |
| SillyTavern | `51ad27f`, `SillyTavern 1.18.0`, `http://127.0.0.1:8001` | Latest upstream lab from the previous Sgw report. |
| JS-Slash-Runner | `8d735f2`, manifest `4.8.9` | Installed under ST third-party extensions. |
| DreamMiniStage | `http://localhost:3304` | A clean dev server was started because the older `3303` process returned `500` for every page during this run. |
| Dream request proxy | `http://127.0.0.1:8002/v1` | Captured outgoing OpenAI-compatible requests and forwarded to the real endpoint from `.env`. |

Shared model configuration:

- Provider shape: OpenAI-compatible DeepSeek endpoint
- Model: `deepseek-v4-pro`
- Context window: `1_000_000`
- Response length: `8192`
- Streaming: disabled
- Preset: `test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json`
- No external global worldbook was enabled for this run

Sensitive values from `.env` were used locally but are not recorded here.

## Cards and scenes

| Slug | Asset | Upstream shape | Test turns |
| --- | --- | --- | --- |
| `origin` | `test-baseline-assets/character-card/2.png` | 8 alternate greetings, 553 embedded worldbook entries, 7 embedded UI regex scripts | Wake from a cryo pod, inspect the room, then ask the system for resources, damaged zones, and repair priority. |
| `seagull` | `test-baseline-assets/character-card/3.png` | Single opening, small embedded world context, `tavern_helper` extension artifact | Offer to share an umbrella at a rainy bus stop, then keep distance while sheltering the other character. |
| `theater` | `test-baseline-assets/character-card/V2.0Beta.png` | Opening is an instruction wrapper, large worldbook, 12 embedded regex scripts, TavernHelper artifacts | Wake backstage, inspect clues and sounds, then write a timeline and open a side door to the auditorium. |

## Upstream SillyTavern observations

Captured request trace: `/tmp/sillytavern-lab-requests.ndjson`

SillyTavern imported and ran all three cards. `origin` and `theater` triggered embedded worldbook and regex import prompts. `seagull` did not block on import and ran as a plain narrative card in the sampled flow.

Observed upstream requests:

| Card | Turn | Model | Stream | Max tokens | Messages | Prompt chars | Notable prompt markers |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- |
| `origin` | 1 | `deepseek-v4-pro` | `false` | `8192` | 4 | 103,308 | `<UpdateVariable>` present |
| `origin` | 2 | `deepseek-v4-pro` | `false` | `8192` | 6 | 105,163 | `<UpdateVariable>` present |
| `seagull` | 1 | `deepseek-v4-pro` | `false` | `8192` | 4 | 22,275 | `<UpdateVariable>` present |
| `seagull` | 2 | `deepseek-v4-pro` | `false` | `8192` | 6 | 29,612 | `<UpdateVariable>` present |
| `theater` | 1 | `deepseek-v4-pro` | `false` | `8192` | 4 | 57,936 | `<开局>` and `<UpdateVariable>` present |
| `theater` | 2 | `deepseek-v4-pro` | `false` | `8192` | 6 | 60,204 | `<开局>` and `<UpdateVariable>` present |

UI observations:

- `theater` rendered a real interactive-looking status panel in upstream SillyTavern, including investigator stats, current scene text, command buttons, and a world-map style control. Screenshot: `/tmp/st-multicard/theater-chat.png`.
- `origin` imported a very large worldbook and UI regex set. The automation screenshot was partially covered by the Lorebook panel, but DOM inspection reported status/UI content and the request prompt carried the expected UI/update markers.
- `seagull` behaved like a mostly narrative card in this run. It is useful as a control sample because it does not depend on a rich status panel to be usable.
- Upstream also leaked some planning/prompt-like content in generated assistant text. This remains evidence that import-time QA should repair noisy community assets instead of preserving every upstream behavior blindly.

## DreamMiniStage observations

Captured request trace: `/tmp/dreamministage-requests.ndjson`

Screenshots:

- `/tmp/dream-multicard/origin-import.png`
- `/tmp/dream-multicard/origin-opening.png`
- `/tmp/dream-multicard/origin-chat.png`
- `/tmp/dream-multicard/seagull-failure.png`
- `/tmp/dream-multicard/theater-import.png`
- `/tmp/dream-multicard/theater-opening.png`
- `/tmp/dream-multicard/theater-chat.png`

The in-app browser was used to verify the clean Dream dev page at `http://localhost:3304/story-agent-import`. File-upload and multi-card replay were driven by a standalone Playwright script because these PNG card imports require stable local file attachment.

Observed Dream requests:

| Card | Turn | Model | Stream | Max tokens | Messages | Prompt chars | Notable prompt markers |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- |
| `origin` | 1 | `deepseek-v4-pro` | `false` | `8192` | 38 | 25,575 | no `<UpdateVariable>` in request |
| `origin` | 2 | `deepseek-v4-pro` | `false` | `8192` | 40 | 27,699 | no `<UpdateVariable>` in request |
| `theater` | 1 | `deepseek-v4-pro` | `false` | `8192` | 56 | 44,036 | `<开局>` and `<UpdateVariable>` present |
| `theater` | 2 | `deepseek-v4-pro` | `false` | `8192` | 58 | 47,681 | `<开局>` and `<UpdateVariable>` present |

No request was sent for `seagull` because import failed before session creation.

Positive signals:

- Actual wire requests still honor `stream:false`.
- Actual wire requests still honor `max_tokens:8192`.
- `deepseek-v4-pro` is used consistently.
- `origin` imports its 8 openings, 553 worldbook entries, and 7 regex scripts; the preview compiles 6 UI render rules.
- `theater` imports and runs through two turns, proving large instruction-heavy cards can reach the model through the Story Agent path.

Differences and gaps:

1. `seagull` import fails even though it should be a simple narrative control card. The browser error is `NoAdapterMatchError: 没有适配器能处理此输入格式`, coming from `createEmbeddedRegexScripts` -> `createRegexScripts` -> `importRegexScripts`. Code evidence: `lib/adapters/import/bundle-builder.ts` only checks whether `extensions.regex_scripts` exists, then treats it as importable regex input. For cards with an empty or non-list `regex_scripts` extension value, the whole import fails. This should become `[]` or an unsupported diagnostic, not a hard card-level failure.

2. Dream's prompt topology is far from upstream. Upstream sends compact 4/6-message requests shaped roughly as `system, assistant, user, assistant...`; Dream sends 38-58 messages with many leading `user` and `system` fragments. This is not automatically wrong, but it makes prompt ordering and role semantics a first-class compiler concern. It also makes prompt diffing harder.

3. `origin` demonstrates partial UI success by accident rather than by a clean compiled UI contract. Its opening contains tags like `<StatusDashboard>`, and the current render path styles them through `MarkdownConverter` / `TagReplacer`. However the actual request does not carry `<UpdateVariable>`, and the runtime log still says `RegexProcessor 完成，应用脚本: (无)`. That means this is not yet the intended Story Agent render-runtime contract.

4. `theater` shows the sharper failure mode. The opening `<开局> 请按下面要求处理 </开局>` is displayed as ordinary content in Dream, while upstream regex/scripts use it as an instruction trigger. Dream then sends `<开局>` into the model request and later displays `<UpdateVariable>` blocks as styled text instead of executing a compiled state update. The model still produces useful narrative, but state progression is not persisted as structured memory.

5. Both `origin` and `theater` still leak planning text such as `好的，haruki已理解了这个创作任务。让我先进行构思...`. Upstream also leaks planning in places, so this is not solely a Dream bug. It is a strong import-time QA requirement: community presets need repair rules that suppress visible planning / analysis sections unless the card explicitly wants them.

6. Dream currently reports many diagnostics but does not surface enough actionable per-feature loss to the user. Example: `theater` preview shows 12 regex rules but 0 UI render rules; the user should be told which regex semantics became unsupported, which became prompt conventions, and which became safe render/state intents.

## Interpretation

The expanded sample changes the diagnosis:

- `Sgw` showed that MVU/status variables and status panels are missing.
- `origin` shows that UI tags can appear directly in openings and replies, so the renderer needs a typed allowlist contract rather than ad hoc tag coloring.
- `seagull` shows that import robustness matters even for simple cards; one malformed or empty extension field must not kill the whole card.
- `theater` shows that regex can be the mechanism that turns an instruction-shaped opening into a playable scene and turns model-emitted state blocks into updated game state.

The right product direction is still the hard-replace route:

- Do not execute upstream JavaScript, TavernHelper, MVU, or arbitrary HTML.
- Do compile their deterministic semantics into first-party modules.
- Do surface unsupported semantics explicitly at import time.
- Do keep requests stable and inspectable.

## Recommended next work

1. Import robustness fix

   Treat empty or unsupported embedded `extensions.regex_scripts` as an empty list plus diagnostic, not a fatal import error. This should unblock `海鸥小岛与天堂`.

2. Regex semantic classifier split

   For each imported regex, classify into at least:

   - prompt convention
   - output cleanup
   - state update grammar
   - safe render intent
   - unsupported

   `theater` needs this because `开局-*`, `隐藏思维链选项`, `本周目经历`, and `去除变量更新` are different semantics, not one generic regex bucket.

3. State update module POC

   Compile `<UpdateVariable>` / `_.set` / `_.assign` / `_.add` style output into a safe state update grammar. The runtime should persist accepted updates into `StorySession` state and hide raw update blocks from the visible assistant message.

4. Opening compiler rule

   Instruction-shaped openings such as `<开局> 请按下面要求处理 </开局>` should not be displayed as the playable opening. The compiler should either convert them into prompt-only setup or select/generate a playable opening, with diagnostics.

5. Prompt topology normalization

   Collapse the many compiled fragments into a smaller deterministic prompt stack with explicit provenance. The final user input should have one canonical slot, and prompt-viewer should show why each role/message exists.

6. RenderIntent coverage

   Replace generic tag coloring for domain UI with typed render intents. For `origin`, `<StatusDashboard>`, `<UnitCard>`, mission options, resources, tasks, and base state should map to safe UI components or explicit unsupported warnings.

7. QA repair rule for visible planning

   Add import-time or runtime output QA that prevents visible `构思`, `我先想想`, `haruki已理解` planning scaffolds from reaching the user unless explicitly allowed by the card/preset.

## Verification artifacts

- ST request trace: `/tmp/sillytavern-lab-requests.ndjson`
- Dream request trace: `/tmp/dreamministage-requests.ndjson`
- ST screenshots: `/tmp/st-multicard/*.png`
- Dream screenshots: `/tmp/dream-multicard/*.png`
- Dream clean dev URL verified in the in-app browser: `http://localhost:3304/story-agent-import`

Useful trace summary command:

```bash
node - <<'NODE'
const fs = require('fs');
for (const [label, path] of [['st', '/tmp/sillytavern-lab-requests.ndjson'], ['dream', '/tmp/dreamministage-requests.ndjson']]) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse);
  console.log(label, lines.map((x) => ({
    model: x.model,
    stream: x.stream,
    max_tokens: x.max_tokens,
    messages: x.messages.length,
  })));
}
NODE
```
