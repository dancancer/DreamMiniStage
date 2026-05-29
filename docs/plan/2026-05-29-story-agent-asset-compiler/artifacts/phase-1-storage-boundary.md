# SAC-Phase 1 Storage Boundary Decision

## Decision

Use `asset-library-plus-blueprint`.

This means:

- ST-derived assets may be stored as import/library material.
- `/session` must read only compiled `SessionBlueprint` plus `StorySession` state after the hard-replace cutover.
- Existing preset, worldbook and regex stores are not runtime compatibility stores.
- There is no migration path for old local data and no legacy runtime fallback.

## Store Roles

| Store | New role |
| --- | --- |
| `PRESET_FILE` | Asset library/import source only until replaced by blueprint authoring storage |
| `WORLD_BOOK_FILE` | Asset library/import source only until `WorldModule` compilation replaces runtime reads |
| `REGEX_SCRIPTS_FILE` | Asset library/import source only until transform/render rules are compiled into blueprint |
| `MEMORY_ENTRIES_FILE` | Not part of SessionBlueprint; Phase 6b decides whether to replace it with `StorySession` memory stores |
| Vector-memory store | Not part of Phase 1; Phase 6b decides final ownership |
| New blueprint store | Required before `/session` cutover; exact key/path deferred to Phase 3/6a implementation |

## Runtime Invariant

After `SAC-Phase 6a`, `/session` cannot read raw ST asset stores for prompt, worldbook or regex behavior. Any such read is a cutover bug, not a compatibility path.

## Rationale

The project is still in development, so preserving old local data is not required. Keeping assets as a library source is still useful for import UX, but it must not leak into runtime semantics.

## Verification Hook

`SAC-Phase 6a` replacement report must grep for runtime reads of:

```bash
rg -n "PRESET_FILE|WORLD_BOOK_FILE|REGEX_SCRIPTS_FILE|MEMORY_ENTRIES_FILE|MEMORY_EMBEDDINGS_FILE" app lib function
```

Each runtime hit must be classified as blueprint/session state, asset-library UI, or cutover bug.
