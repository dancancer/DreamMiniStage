# POC-2.2 Typed Repair Patch Validator

## Purpose

Verify that LLM-style repair output must pass typed schema validation and deterministic risk validation before it can affect imported assets.

## Inputs

| Input | Source path | Why this fixture |
| --- | --- | --- |
| Synthetic patch output | `lib/adapters/import/__tests__/repair-patch.test.ts` | Models the exact JSON shape expected from LLM QA |

## Commands

```bash
pnpm vitest run lib/adapters/import/__tests__/repair-patch.test.ts
```

## Expected Output

The validator must reject:

- `replace` / `add` patches without `value`
- patches whose `targetPath` is outside the risk map
- patches whose `claimedRisk` disagrees with computed risk

## Result

- Status: `pass`
- Date: `2026-05-29`
- Evidence: `lib/adapters/import/repair-patch.ts`, `lib/adapters/import/__tests__/repair-patch.test.ts`

## Decision

Treat external LLM output as untrusted JSON. The POC does not need a successful network model call to prove the safety invariant; the invariant is enforced entirely by local schema and validator code.

## Note

Claude CLI was attempted from an isolated worktree for an external typed-patch payload, but the API connection closed unexpectedly. This is not a stage blocker because Phase 2 validates the local trust boundary around any LLM-shaped output, not model patch quality.
