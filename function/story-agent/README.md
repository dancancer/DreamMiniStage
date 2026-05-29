# Story Agent Functions

`function/story-agent` exposes user-facing import actions for the Story Agent Asset Compiler route.

- `import.ts` reads character, preset, worldbook and regex files, compiles a `SessionBlueprint`, and commits a blueprint-backed `StorySession`.
- The flow does not write imported worldbooks, presets or regex scripts into legacy runtime stores.
