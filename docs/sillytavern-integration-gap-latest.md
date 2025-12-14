# SillyTavern Integration Gap (Code Audit, 2025-02)

Scope: SillyTavern core + JS-Slash-Runner + MagVarUpdate. Source of truth is current code under `lib/`, `function/`, `hooks/`, `public/iframe-libs/`, and the upstream plugin sources in `sillytavern-plugins/`.

## Quick Snapshot (what already exists)
- Prompt pipeline mirrors SillyTavern preset ordering and post-processing: `STPromptManager` builds ordered prompts and applies merge/semi/strict/single modes with name-prefix normalization and tool stripping/prefill (`lib/core/prompt/manager.ts`, `lib/core/prompt/post-processor.ts`).
- Slash command kernel supports recursion blocks and control signals; registry covers core `/send|/trigger|/setvar|/regex|/preset|/worldbook|/audio` commands (`lib/slash-command/core/parser.ts`, `lib/slash-command/registry.ts`).
- Vector memory exists with OpenAI/local providers, async ingest on dialogue save, and retrieval injected into prompts as system text (`lib/vector-memory/manager.ts`, `function/dialogue/chat.ts`).
- MVU core (MagVarUpdate) is ported: schema generation, JSON patch, command parser, extra-model pipeline, and function-call scaffolding are present (`lib/mvu/**/*.ts`).
- Script runner iframe + shim are in place to expose TavernHelper/SillyTavern-style globals (`public/iframe-libs/script-runner.html`, `public/iframe-libs/slash-runner-shim.js`).

## Gaps vs SillyTavern Core
- TavernHelper API is stubbed in the sandbox: `ScriptExecutor` only replies to `getChatMessages/getCurrentMessageId/eventEmit` with empty/null placeholders and ignores the rest of the API map, so iframe scripts cannot read/write messages, variables, presets, or worldbooks (`lib/script-runner/executor.ts:105-120`). The shim advertises many endpoints but most are unimplemented stubs (`public/iframe-libs/slash-runner-shim.js:394-460`).
- No support for registering function tools or slash commands from scripts: `window.SillyTavern.registerFunctionTool/registerSlashCommand` are hard stubs, blocking MagVarUpdate’s tool registration path and third-party slash extensions (`public/iframe-libs/slash-runner-shim.js:447-456`).
- Quick Reply/character/group APIs are declared but stubbed, so commands depending on quick-reply/autocomplete/parsing context cannot work (`public/iframe-libs/slash-runner-shim.js:340-376`).
- Group chat name handling is incomplete: `postProcessMessages` only prefixes `example_assistant/example_user` and ignores `PromptNames.groupNames`, so models that drop `name` fields lose speaker identity in group chats (`lib/core/prompt/post-processor.ts:195-206`).

## Gaps vs JS-Slash-Runner Plugin
- JS-Slash-Runner’s bundled slash commands (`/event-emit`, `/audioenable|audioplay|audioimport|audioselect|audiomode`) are absent from the project registry; only a generic `/audio` handler exists with a different signature (`lib/slash-command/registry.ts` vs `sillytavern-plugins/JS-Slash-Runner/src/slash_command/event.ts:1-62` and `.../audio.ts:1-339`).
- Parser/runtime parity gaps: the kernel parser lacks SillyTavern’s typed argument metadata, autocomplete, aliases, parser flags, breakpoint/debug controls, and `SlashCommandScope` variable bubbling. `SlashCommandParser.js` in SillyTavern exposes these features; our executor only resolves name → handler (`lib/slash-command/core/parser.ts`, `lib/slash-command/executor.ts`).
- Panel/UI from JS-Slash-Runner (Vue + Pinia under `src/panel`) is not mounted anywhere; no bridge to expose script buttons, audio toggles, or macro registration UX.

## Gaps vs MagVarUpdate Plugin
- Variable scopes are collapsed: script bridge only exposes global + character scopes, missing MagVarUpdate’s chat/preset/message/script/extension layers (`hooks/script-bridge/variable-handlers.ts:33-114`). This breaks commands that target message-scoped variables or extension storage.
- MVU function-calling path is unused: `FunctionCallManager`/`buildFunctionCallRequest` exist but are never wired into LLM requests or tool-call responses, so function-call-based variable updates never execute (`lib/mvu/function-call.ts` with no callers).
- Script-side tool registration is stubbed (see TavernHelper gap above), so `registerFunctionTool(mvu_VariableUpdate)` cannot be advertised to the model; `<UpdateVariable>` text parsing is the only active path, limiting parity with MagVarUpdate’s tool-calling mode.
- Schema registration per scope is missing: MagVarUpdate’s `registerVariableSchema` is absent; the current MVU store keeps snapshots but does not enforce or reconcile per-scope schemas against incoming updates (`lib/mvu/data/store.ts` vs `sillytavern-plugins/MagVarUpdate/src/function.ts`/`schema.ts`).

## Action Plan (ordered)
1) **Fix TavernHelper bridge**: route `API_CALL` to real stores (messages, variables incl. per-scope, worldbooks, presets), and implement `registerFunctionTool/registerSlashCommand` so iframe scripts can publish tools/commands.
2) **Port JS-Slash-Runner commands**: add `/event-emit` and audio commands with compatible signatures; expose audio store controls in `ExecutionContext` and mirror JS-Slash-Runner enum defaults/help where feasible.
3) **Wire MVU function-calling**: inject `getMvuTool()` into LLM requests when enabled; parse tool-call responses through `FunctionCallManager.processToolCalls` and persist to MVU store; add per-scope schema registration and validation hooks.
4) **Restore parser/runtime parity**: extend slash parser to honor typed args, aliases, parser flags, and scope chaining; emit execution telemetry/errors similar to `SlashCommandParser.js` for compatibility with upstream autocomplete/debug flows.
5) **Group chat + speaker fidelity**: include `groupNames` in name-prefix normalization and align with SillyTavern’s prompt-converter behavior for multi-speaker prompts.
6) **Surface plugin UI affordances**: decide whether to embed JS-Slash-Runner panel or replicate minimal controls (script list, audio panel, macro registration) using existing component system; ensure iframe height updates remain functional.

These items unblock parity with SillyTavern core behaviors and the two target plugins while keeping changes localized to the script-runner bridge, slash subsystem, and MVU integration points.
