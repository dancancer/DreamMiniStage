# SAC-Phase 1 Import Entry Audit

## Current Entry Points

| Entry point | Current behavior | Status |
| --- | --- | --- |
| `function/character/import.ts` | Parses PNG, builds `ImportedAssetBundle`, persists normalized embedded worldbook and regex assets from the bundle | Bundle-backed |
| `function/worldbook/import.ts` | Uses `importWorldBookEntries` adapter before writing worldbook store | Adapter-backed |
| `components/ImportWorldBookModal.tsx` | Calls `importWorldBookFromJson` | Adapter-backed through function layer |
| `components/ImportRegexScriptModal.tsx` | Calls regex import function | Adapter-backed through function layer |
| `function/preset/import.ts` | Calls `PresetOperations.importPreset`, which normalizes through `lib/adapters/import/preset-import` | Adapter-backed |

## Closed Gap

`function/character/import.ts` no longer writes `characterJson.data.character_book.entries` directly. It uses `createImportedAssetBundle()` and persists `bundle.worldBooks[].entries[].normalized`.

## New Target

`lib/adapters/import/bundle-builder.ts` now provides `createImportedAssetBundle()`:

- embedded `character_book` goes through `importWorldBookEntries`,
- embedded `regex_scripts` goes through `importRegexScripts`,
- external worldbooks, presets and regex scripts enter the same bundle shape,
- unsupported extensions become `extensionArtifacts`.

## Remaining Gap

Standalone worldbook and regex imports are adapter-backed but not yet bundle-backed. Phase 1 can either route them through `ImportedAssetBundle` wrappers or leave them as asset-library import paths that are later compiled into blueprint.

Current decision: standalone asset-library imports may remain adapter-backed. Character-card imports use bundle because they combine character, embedded worldbook, embedded regex and unsupported extensions.

## Verification

Direct character-card worldbook bypass check:

```bash
rg -n "updateWorldBook\([^\n]*characterJson|characterJson\.data\?\.character_book|character_book\.entries" \
  function/character lib/adapters/import
```

Expected result: no matches.

Adapter-backed import check:

```bash
rg -n "updateWorldBook\(|updateRegexScripts\(|importWorldBookEntries|importRegexScripts|importPreset\(" \
  function lib/adapters/import components
```

Expected result: every import write path is preceded by adapter or bundle construction. Non-import edit/global-management operations are not part of this check.
