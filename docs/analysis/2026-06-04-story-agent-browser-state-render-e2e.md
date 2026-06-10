# Story Agent browser state/render E2E verification

Date: 2026-06-04

## Scope

This check verifies the browser-level path for long-session Story Agent state and
status rendering:

- multi-turn `StorySession.storyState` continuity in real model requests;
- `<SFW>` status panels rendered by the Story Agent renderer;
- safe custom `<StatusDashboard>` JSON rendered as structured sections and
  meters;
- source tags and legacy `stat_data` echoes staying out of visible UI and prompt
  payloads.

The run uses mocked model responses only to remove provider variance. The app
still performs the real import flow, session creation, message send path, prompt
assembly, state update, and browser rendering.

## Fixture

- App: `http://localhost:3303`
- Import page: `http://localhost:3303/story-agent-import`
- Source card: `test-baseline-assets/character-card/Sgw3.png`
- Preset: `test-baseline-assets/preset/明月秋青v3.94.json`
- Regex assets:
  - `test-baseline-assets/regex-scripts/sgw3-sample.json`
  - `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-dashboard-regex.json`
- Model config: OpenAI-compatible `deepseek-v4-pro`
- Captured endpoint: `**/api/model-gateway/chat-completions`

The custom regex fixture intentionally compiles
`<StatusDashboard>{...}</StatusDashboard>` into a safe `status-panel` render
intent. It does not execute upstream HTML or script.

## Flow

1. Open `/story-agent-import`.
2. Upload the Sgw card, preset, baseline regex, and custom dashboard regex.
3. Run `检查资产`.
4. Create the Story Agent and enter the generated session.
5. Send three user turns.
6. Capture each real POST body sent to `/api/model-gateway/chat-completions`.
7. Assert the final UI contains rendered SFW status, custom sections, meters, and
   no raw source tags.

## Assertions

The generated summary is:

```json
{
  "requestCount": 3,
  "requestSummaries": [
    {
      "messageCount": 3,
      "stateBlockCount": 1,
      "soyoAffinity": 0,
      "currentInputIsLastUserMessage": true,
      "renderContractMentionsSfw": true,
      "renderContractMentionsCustomDashboard": true,
      "rawLegacyStatEcho": false
    },
    {
      "messageCount": 5,
      "stateBlockCount": 1,
      "soyoAffinity": 3,
      "currentInputIsLastUserMessage": true,
      "renderContractMentionsSfw": true,
      "renderContractMentionsCustomDashboard": true,
      "rawLegacyStatEcho": false
    },
    {
      "messageCount": 7,
      "stateBlockCount": 1,
      "soyoAffinity": 5,
      "currentInputIsLastUserMessage": true,
      "renderContractMentionsSfw": true,
      "renderContractMentionsCustomDashboard": true,
      "rawLegacyStatEcho": false
    }
  ],
  "ui": {
    "statusPanelCount": 7,
    "sfwCharacterVisible": true,
    "customSectionsVisible": true,
    "metersVisible": true,
    "rawTagsVisible": false,
    "stateTupleVisible": true,
    "rawStateJsonVisible": false,
    "finalMarkerVisible": true
  },
  "failures": []
}
```

Key result:

- Each prompt carries exactly one `<status_current_variables>` block.
- Soyo affinity advances across requests as `0 -> 3 -> 5`.
- The third response applies another `_.add`, so the final UI state snapshot shows
  `长崎素世.好感度` as `[6, description]`.
- The browser request body does not include provider `apiKey` or `baseUrl`.
- The render contract mentions both `<SFW>` and `<StatusDashboard>` with
  `sections` / `meters`.
- Visible UI shows structured panels and does not expose `<SFW>`,
  `<StatusDashboard>`, or `<UpdateVariable>` source tags.
- The final `Story State` snapshot renders tuple variables as readable
  `角色.字段` rows and does not expose raw `{"$meta": ...}` JSON.

## Artifacts

- Script: `scripts/story-agent-browser-state-render-e2e.mjs`
- Initial screenshot:
  `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-initial.png`
- Final screenshot:
  `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-final.png`
- Summary:
  `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-summary.json`
- Request bodies:
  - `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-1.json`
  - `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-2.json`
  - `docs/analysis/artifacts/2026-06-04-story-agent-browser-state-render-request-3.json`

## Command

```bash
APP_URL=http://localhost:3303 node scripts/story-agent-browser-state-render-e2e.mjs
```

## Verdict

The tested Sgw Story Agent path now crosses the browser-level boundary:
imported state -> prompt state memory -> multi-turn `UpdateVariable` application
-> Story Agent render mode -> structured status UI.

The remaining work is not basic state/render continuity. It is broader MVU
mutation semantics and, later, branch replay/rebase support for regenerate,
swipe, and branch switch.
