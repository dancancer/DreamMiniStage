# SAC-Phase 3 Deferred Contract Upgrade Strategy

## Decision

`renderRules` and `memoryPolicy` stay as explicit deferred contracts in Phase 3.

```ts
type DeferredContract = {
  status: "deferred";
  phase: "SAC-Phase 5" | "SAC-Phase 6b";
  reason: string;
};
```

## Hash Rule

Phase 3 `sourceHash` covers only the core contract. It does not hash future `RenderIntent` or long-term memory policy semantics because those schemas do not exist yet.

When either deferred contract graduates:

1. Bump `SESSION_BLUEPRINT_SCHEMA_VERSION`.
2. Replace the matching `DeferredContract` with the stable schema.
3. Add the new stable field to the hash input.
4. Update snapshot tests and POC docs in the phase that owns the schema.

## Ownership

| Deferred field | Owning phase | Required proof before graduation |
| --- | --- | --- |
| `renderRules` | `SAC-Phase 5` | `RenderIntent` schema, whitelist renderer and unsupported UI fallback POCs pass. |
| `memoryPolicy` | `SAC-Phase 6b` | Long-session memory extraction/consolidation POCs pass. |

## Non-Goals

- Do not add placeholder `RenderIntent` fields in Phase 3.
- Do not add placeholder long-term memory strategy fields in Phase 3.
- Do not keep old ST runtime fields as a fallback while waiting for deferred contracts.
