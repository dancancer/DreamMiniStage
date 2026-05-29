# POC-3.2 Stable Blueprint Hash

## Purpose

Verify that compiling the same assets produces the same `sourceHash`, and changing asset content changes the hash.

## Commands

```bash
pnpm vitest run lib/story-agent/blueprint/__tests__/compiler.test.ts
```

## Expected Output

The test compiles the same `ImportedAssetBundle` twice and asserts:

- `first.sourceHash === second.sourceHash`
- `first.id === second.id`

Then it mutates the character card `first_mes` content before bundle creation and asserts:

- `changed.sourceHash !== first.sourceHash`

## Hash Scope

The hash covers Phase 3 core fields:

- `schemaVersion`
- `profile`
- `promptStack`
- `worldModules`
- `inputTransforms`
- `outputTransforms`
- `promptTransforms`
- `contentRules`
- `diagnostics`
- `repairReport`
- `provenance`

Phase 3 hash intentionally excluded future `RenderIntent` and long-term memory details because those contracts were deferred then. Current schema v3 includes both `renderRules` and `memoryPolicy` in the stable hash input.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `compileSessionBlueprint()` and `compiler.test.ts`
