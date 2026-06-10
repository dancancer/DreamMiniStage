# Story Agent Functions

`function/story-agent` exposes user-facing import actions for the Story Agent Asset Compiler route.

- `import.ts` reads character, preset, worldbook and regex files, compiles a `SessionBlueprint`, and commits a blueprint-backed `StorySession`.
- `enrichStoryAgentPreview` is the optional import-time LLM pass (wizard "AI 增强"): it runs QA-repair and Render Intent Synthesis on an existing preview using the active session model. It is client-side (the model `apiKey` lives in `useModelStore`) and never executes card scripts (INV-3/INV-6).
- The flow does not write imported worldbooks, presets or regex scripts into legacy runtime stores.
