# SAC-Phase 1 Data Contract Candidates

> 本文件是 Phase 1 的输入。当前权威 TypeScript contract 位于 `lib/adapters/import/bundle-types.ts`，并由 `lib/adapters/import/__tests__/bundle-types.test.ts` 用真实 fixture 组合验证。

## 1. Contract Principles

- ST 资产格式只出现在 import adapter 和 provenance。
- Runtime consumes only DreamMiniStage-native contracts.
- No legacy fallback, no dual runtime, no shadow compatibility flag.
- Existing `lib/adapters/import` types are reused where they already express normalized import semantics.
- Missing normalized types are defined explicitly instead of pretending they exist.

## 2. ImportedAssetBundle Candidate

Implemented in `ImportedAssetBundle`:

```ts
export interface ImportedAssetBundle {
  schemaVersion: 1;
  bundleId: string;
  sourceHash: string;
  createdAt: string;
  character: ImportedCharacterProfile;
  worldBooks: ImportedWorldBook[];
  preset?: ImportedPreset;
  regexScripts: ImportedRegexScript[];
  extensionArtifacts: ImportedExtensionArtifact[];
  diagnostics: ImportDiagnostic[];
}
```

## 3. Character

`ImportedCharacterProfile` is a new contract. There is no existing authoritative `NormalizedCharacter` in the current import layer.

```ts
export interface ImportedCharacterProfile {
  id: string;
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleMessages?: string;
  creator?: string;
  version?: string;
  source: AssetSource;
  promptFragments: ImportedPromptFragment[];
  diagnostics: ImportDiagnostic[];
}
```

## 4. World Books

Existing `NormalizedWorldBookEntry` is the starting point, but Phase 1 preserves book-level grouping through `ImportedWorldBook`. A flat entry array is not enough for diagnostics like “worldbook A has three over-broad keys”.

```ts
export interface ImportedWorldBook {
  id: string;
  name: string;
  source: AssetSource;
  entries: ImportedWorldBookEntry[];
  diagnostics: ImportDiagnostic[];
}

export interface ImportedWorldBookEntry {
  id: string;
  sourceBookId: string;
  normalized: NormalizedWorldBookEntry;
  provenance: FieldProvenance[];
  unsupported: UnsupportedArtifact[];
}
```

Decision: `sourceBookId` is carried by `ImportedWorldBookEntry`, not embedded into `NormalizedWorldBookEntry`. The normalized entry stays focused on worldbook semantics; the wrapper owns source grouping and provenance.

The ST numeric mapping for `selectiveLogic` is already defined at the import boundary:

| ST value | Normalized value |
| ---: | --- |
| `0` | `AND_ANY` |
| `1` | `NOT_ALL` |
| `2` | `NOT_ANY` |
| `3` | `AND_ALL` |

`ImportedWorldBookEntry.normalized.selectiveLogic` must use the local `SecondaryKeyLogic` enum and never expose ST numeric values.

## 5. Preset

Existing `NormalizedPreset` and `NormalizedPresetPrompt` are the starting point.

```ts
export interface ImportedPreset {
  id: string;
  name: string;
  normalized: NormalizedPreset;
  source: AssetSource;
  diagnostics: ImportDiagnostic[];
}
```

`prompt_order` remains import evidence only. Runtime prompt ordering must come from the normalized prompt order contract.

## 6. Regex Scripts

Current `importRegexScripts` returns `RegexScript[]`; there is no existing authoritative `NormalizedRegexScript`. Phase 1 has two acceptable directions:

- Keep `RegexScript[]` inside `ImportedRegexScript.raw` and classify in Phase 5.
- Define `NormalizedRegexScript` in Phase 1 if import-time normalization is needed.

```ts
export interface ImportedRegexScript {
  id: string;
  source: AssetSource;
  raw: RegexScript;
  provenance: FieldProvenance[];
  diagnostics: ImportDiagnostic[];
}
```

## 7. Extensions

```ts
export interface ImportedExtensionArtifact {
  id: string;
  source: AssetSource;
  extensionKey: string;
  kind: "prompt-convention" | "variable-convention" | "script" | "unknown";
  payloadHash: string;
  summary: string;
  supported: false;
  diagnostics: ImportDiagnostic[];
}
```

Scripts are unsupported by default. A later phase may compile prompt or variable conventions into `PromptStack`, but execution stays out of runtime.

## 8. Shared Support Types

```ts
export interface AssetSource {
  sourcePath: string;
  sourceKind: "png-character" | "json-character" | "preset" | "worldbook" | "regex" | "script" | "manual";
  detectedFormat: string;
  sourceHash: string;
}

export interface FieldProvenance {
  targetPath: string;
  sourcePath: string;
  sourceField: string;
}

export interface ImportDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  targetPath?: string;
  sourceField?: string;
}

export interface UnsupportedArtifact {
  code: string;
  reason: string;
  sourceField: string;
}
```

## 9. Store Decision Candidates

Phase 1 still must choose one storage boundary before implementation:

| Candidate | Meaning | Consequence |
| --- | --- | --- |
| `blueprint-only-session` | `/session` reads only compiled blueprint and session state | Cleanest hard-replace path |
| `asset-library-plus-blueprint` | old-like stores remain only as asset library inputs; `/session` still reads blueprint only | Useful if asset management UI needs raw imports |
| `replace-local-storage` | introduce dedicated blueprint/session stores and remove old roleplay stores from product paths | Most aggressive cleanup |

Rejected option: runtime reads both old asset stores and blueprint. That is a dual runtime and violates the route.

## 10. Phase 1 Exit Criteria

- One bundle schema is selected and committed.
- Character, worldbook, preset and regex imports enter the same bundle surface.
- `function/character/import.ts` no longer has one path that writes `character_book` directly while regex goes through adapters.
- Bundle fixture proves `Sgw3.png` + preset + worldbook + regex can be represented with counts and provenance intact.
