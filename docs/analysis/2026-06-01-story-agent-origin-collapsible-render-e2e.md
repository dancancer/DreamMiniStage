# Story Agent origin collapsible render E2E

Date: 2026-06-01

## Scope

This probe verifies the `本源计划：废土机娘养成` card imported from:

```text
test-baseline-assets/character-card/2.png
```

The target behavior is Story Agent's own structured render contract:

- compile card-defined regex UI blocks into `RenderIntent`;
- strip the source tags from narrative prose;
- render each supported block as a safe collapsible panel;
- avoid leaking nested source tags from parent panel bodies.

## Environment

| Item | Value |
| --- | --- |
| App | `http://localhost:3313` |
| Session | `/session?id=7e0a016a-55ac-4dbb-abd0-bc0a0f2b6c14` |
| Asset | `test-baseline-assets/character-card/2.png` |
| Imported role | `本源计划：废土机娘养成` |

## Evidence

Artifacts:

- Browser summary JSON: `docs/analysis/artifacts/2026-06-01-story-agent-origin-collapsible-render-summary.json`
- Browser screenshot: `docs/analysis/artifacts/2026-06-01-story-agent-origin-collapsible-render.png`

Observed panels:

| Panel | Rendered | Body present | Raw source tag visible |
| --- | --- | --- | --- |
| `📂 UNIT STATUS / 展开数据` | yes | yes | no |
| `UI-状态栏容器` | yes | yes | no |
| `💠 MISSION PROTOCOL` | yes | yes | no |

The machine-readable summary recorded:

```json
{
  "roleTitleVisible": true,
  "openingSwitcherVisible": true,
  "collapsiblePanels": [
    "📂 UNIT STATUS / 展开数据",
    "UI-状态栏容器",
    "💠 MISSION PROTOCOL",
    "💠 MISSION PROTOCOL",
    "💠 MISSION PROTOCOL"
  ],
  "containsRawStatusDashboard": false,
  "containsRawUnitCard": false,
  "containsRawMissionProtocol": false,
  "containsUnitBody": true,
  "containsDashboardBody": true,
  "containsMissionBody": true
}
```

## Result

Pass.

The opening renders structured collapsible UI for the card's `StatusDashboard`, `UnitCard`, and `MissionProtocol` blocks. The original source tags are removed from visible prose, and nested blocks are not duplicated inside the parent dashboard panel.
