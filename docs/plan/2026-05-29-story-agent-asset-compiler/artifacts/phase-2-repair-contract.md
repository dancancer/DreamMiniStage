# SAC-Phase 2 Repair Contract

## Decision

LLM QA can propose typed patches, but code owns validation, risk classification and auto-apply eligibility.

Implementation:

- `lib/adapters/import/repair-patch.ts`
- `llmQaInputSchema`
- `llmQaOutputSchema`
- `repairPatchSchema`
- `validateRepairPatch(input)`
- `validateRepairOutput(input)`
- `applyAutoRepairPatch(target, validatedPatch)`

## Patch Shape

```ts
interface RepairPatch {
  id: string;
  operation: "add" | "replace" | "remove";
  targetPath: string; // JSON Pointer
  value?: unknown;
  reason: string;
  diagnosticCode?: string;
  claimedRisk?: "low" | "medium" | "high"; // untrusted, checked if present
}
```

`targetPath` is a JSON Pointer, for example `/character/version`. This avoids ambiguous dot paths when imported asset ids contain dots.

## Risk Rule

Risk is computed from `targetPath` and `operation`.

- LLM output cannot assign risk.
- If `claimedRisk` is present and differs from computed risk, validation fails fast with `repair.risk_mismatch`.
- Only computed `low` risk patches can be auto-applied.
- `remove` upgrades low-risk paths to `medium`.

## High-Risk Path Map

| Pattern | Reason |
| --- | --- |
| `/character/description` | Character identity and premise |
| `/character/personality` | Character personality |
| `/character/scenario` | Story scenario |
| `/character/firstMessage` | Opening message |
| `/character/exampleMessages` | Example dialogue |
| `/character/promptFragments/*/content` | Compiled character prompt fragment |
| `/preset/normalized/prompts/*/content` | Preset prompt content |
| `/preset/normalized/sysprompt/content` | System prompt content |
| `/preset/normalized/sysprompt/post_history` | Post-history system prompt content |
| `/worldBooks/*/entries/*/normalized/content` | Worldbook content |
| `/worldBooks/*/entries/*/normalized/keys` | Worldbook primary trigger keys |
| `/worldBooks/*/entries/*/normalized/secondary_keys` | Worldbook secondary trigger keys |
| `/worldBooks/*/entries/*/normalized/selectiveLogic` | Worldbook trigger logic |
| `/regexScripts/*/raw/findRegex` | Regex matching logic |
| `/regexScripts/*/raw/replaceString` | Regex replacement or UI output |

## Auto-Repair Boundary

Current low-risk paths are display or provenance metadata only:

- `/character/creator`
- `/character/version`
- `/preset/name`
- `/worldBooks/*/name`
- `/regexScripts/*/raw/scriptName`
- `/extensionArtifacts/*/summary`

Any unsupported path is rejected instead of guessed.

## Verification

```bash
pnpm vitest run lib/adapters/import/__tests__/repair-patch.test.ts
```
