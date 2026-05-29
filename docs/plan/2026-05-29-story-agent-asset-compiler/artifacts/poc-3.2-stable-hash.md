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

The hash intentionally excludes future `RenderIntent` and long-term memory implementation details because those contracts are deferred.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `compileSessionBlueprint()` and `compiler.test.ts`
