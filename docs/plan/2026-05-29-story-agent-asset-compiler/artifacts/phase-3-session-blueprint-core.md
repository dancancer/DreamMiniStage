# SAC-Phase 3 SessionBlueprint Core Contract

## Decision

`SessionBlueprint` core is now a serializable compiler output. It is generated from `ImportedAssetBundle` and is the only shape Phase 4 prompt/worldbook POCs should consume.

Implementation:

- `lib/story-agent/blueprint/types.ts`
- `lib/story-agent/blueprint/compiler.ts`
- `lib/story-agent/blueprint/assembler.ts`

## Core Fields

| Field | Status | Notes |
| --- | --- | --- |
| `profile` | stable core | Compiled from `ImportedCharacterProfile`. |
| `promptStack` | stable core | Compiled from character prompt fragments and normalized preset prompts. |
| `worldModules` | stable core | Compiled from normalized worldbook entries. |
| `inputTransforms` | stable core | Compiled regex input transforms; no runtime `placement` branch remains in blueprint. |
| `outputTransforms` | stable core | Compiled regex output transforms. |
| `promptTransforms` | stable core | Compiled regex prompt transforms. |
| `contentRules` | stable core | Captures markdown-only and unsupported HTML UI regex semantics. |
| `renderRules` | deferred | `SAC-Phase 5` owns `RenderIntent`. |
| `memoryPolicy` | deferred | `SAC-Phase 6b` owns long-term memory policy. |
| `diagnostics` | stable core | Deterministic Phase 2 diagnostics. |
| `repairReport` | stable core | Tracks applied/manual/rejected repair patch ids. |
| `provenance` | stable core | Tracks compiled fields back to imported asset sources. |

## Runtime-Clean Shape

The compiled blueprint does not preserve ST runtime control fields as executable fields:

- no `prompt_order`
- no `keysecondary`
- no `placement`

Source diagnostics and provenance may still mention original source fields as strings, because they are audit metadata, not runtime dispatch logic.

## Verification

```bash
pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts
```
