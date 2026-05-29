# SAC-Phase 3 Deferred Contract Upgrade Strategy

## Decision

`renderRules` and `memoryPolicy` started as explicit deferred contracts in Phase 3.

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
| `renderRules` | `SAC-Phase 5` | Graduated in schema version `2` after `RenderIntent` schema, whitelist renderer and unsupported UI fallback POCs passed. |
| `memoryPolicy` | `SAC-Phase 6b` | Long-session memory extraction/consolidation POCs pass. |

## SAC-Phase 5 Graduation

`renderRules` is now a stable `RenderIntent[]` in `SessionBlueprint`. The graduation changed the Phase 3 rules as follows:

1. `SESSION_BLUEPRINT_SCHEMA_VERSION` is now `2`.
2. `renderRules` replaces its deferred marker with compiled `RenderIntent` objects.
3. `renderRules` is included in the stable `sourceHash` input.
4. `memoryPolicy` remains deferred after Phase 5.

## SAC-Phase 6b Graduation

`memoryPolicy` is now a stable `MemoryPolicy` in `SessionBlueprint`. The graduation changed the Phase 5 rules as follows:

1. `SESSION_BLUEPRINT_SCHEMA_VERSION` is now `3`.
2. `memoryPolicy` replaces its deferred marker with an active policy.
3. `memoryPolicy` is included in the stable `sourceHash` input.
4. `StorySession.memory` owns running summary, episodic memory, facts and relationship state.
5. There are no deferred fields left in the current `SessionBlueprint` contract.

## Non-Goals

- Do not add placeholder `RenderIntent` fields in Phase 3.
- Do not add placeholder long-term memory strategy fields in Phase 3.
- Do not keep old ST runtime fields as a fallback while waiting for deferred contracts.
