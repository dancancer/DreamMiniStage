# SAC POC Record Template

Copy this template for each POC. POC records should live beside the phase artifact that depends on them.

## POC-ID: `SAC-Phase X / POC-X.Y`

### Purpose

- What risky assumption is being tested?
- Which plan decision depends on this result?

### Inputs

| Asset | Source path | Hash | Why this fixture |
| --- | --- | --- | --- |
|  |  |  |  |

### Semantic Checklist Items

Reference exact items from `asset-semantics-checklist.md`.

- `section.item`:
- `section.item`:

### Commands

```bash
# command used to generate or verify output
```

### Expected Output

- Required file:
- Required schema:
- Required diagnostics:
- Required snapshot:

### Pass / Fail Criteria

- Pass:
- Fail:
- Required bug fixes before next phase:

### Result

- Status: `pass` / `fail` / `blocked`
- Date:
- Commit:
- Output artifacts:

### Diff Classification

| Difference | Classification | Rationale | Follow-up |
| --- | --- | --- | --- |
|  | `bug` / `intentional` / `unsupported` |  |  |

### Decision

- Adopt:
- Reject:
- Defer:

### Notes

- Keep this section factual. Do not turn unsupported behavior into silent compatibility logic.
