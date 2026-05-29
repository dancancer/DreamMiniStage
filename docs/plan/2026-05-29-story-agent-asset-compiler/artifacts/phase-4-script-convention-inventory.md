# SAC-Phase 4 Script Convention Inventory

## Purpose

Decide whether MVU, slash script and TavernHelper assets contain prompt conventions that must be compiled into `PromptStack`.

## Inputs Read

| Asset | Source path | Finding |
| --- | --- | --- |
| MVU variable replay | `test-baseline-assets/mvu-examples/variable-chain.json` | Variable state update semantics only. |
| Slash control flow replay | `test-baseline-assets/slash-scripts/control-flow-replay.json` | `/setvar`, `/while`, `/incvar`, `/if`, `/echo` execution semantics. |
| Character `depth_prompt` extension | `test-baseline-assets/character-card/Sgw3.card.json` | Prompt convention candidate, but `prompt` is empty. |
| Character `TavernHelper_scripts` extension | `test-baseline-assets/character-card/Sgw3.card.json` | Remote script import and UI buttons; unsupported execution semantics. |
| Character `tavern_helper` extension | `test-baseline-assets/character-card/Sgw3.card.json` | Remote script import plus variables object; unsupported execution semantics. |

## Decision

Do not execute MVU, slash scripts or TavernHelper in story runtime.

Compile only prompt-convention data when it is static prompt text. In the current fixtures:

- `depth_prompt.prompt` is empty, so it produces no `PromptStack` unit.
- MVU replay data is state mutation, not prompt text.
- Slash replay data is control flow, not prompt text.
- TavernHelper assets are remote script execution, not prompt text.

## Unsupported Classification

| Source | Classification | Product behavior |
| --- | --- | --- |
| MVU variable replay | `unsupported` | Preserve as extension artifact or diagnostic; do not execute. |
| Slash control flow | `unsupported` | Preserve as extension artifact or diagnostic; do not execute. |
| TavernHelper remote scripts | `unsupported` | Preserve as extension artifact and report script execution loss. |
| Empty `depth_prompt` | `intentional` | No prompt unit emitted because content is empty. |

## Follow-Up

If a future imported asset contains non-empty static prompt convention text, the compiler may add it to `PromptStack` with provenance. That must remain text-only; control flow and side effects stay unsupported.
