# Phase 5 JS-Slash-Runner Host Design

## Background

Phase 1 to Phase 3 closed the highest-risk product-semantic gaps:

- model runtime parameters now flow through the real request path
- prompt behavior now has a unified state source and visible product surface
- `/session` is now the real host for chat orchestration features instead of a thin slash callback shell

That leaves the next highest-priority gap exactly where the roadmap says it is: `JS-Slash-Runner` host completeness.

The current repository already has strong bridge coverage:

- `hooks/script-bridge/capability-matrix.ts` defines the shim/handler/slash surface
- `hooks/useScriptBridge.ts` wires a large `ApiCallContext`
- `/session` already provides a subset of default host behavior

But the product still lacks a single answer to these questions:

- which `JS-Slash-Runner` capabilities are truly supported in DreamMiniStage
- which ones work only when the host injects extra callbacks
- which ones intentionally fail fast
- how a user or developer can observe that state in the UI

Right now the codebase is strong at "API exists" and weak at "host responsibility is explicit".

## Goal

Make `JS-Slash-Runner` host support explainable, observable, and testable.

Phase 5 batch 1 should produce four concrete outcomes:

1. a host capability matrix for `JS-Slash-Runner`
2. a matching fail-fast matrix
3. a stronger `Script Debugger` that shows real host state, not only script success/failure
4. end-to-end validation for a small, high-value capability slice

## Non-Goals

This batch does not try to finish all `JS-Slash-Runner` features.

Specifically out of scope:

- broad slash-command expansion for its own sake
- new compatibility fallbacks or silent legacy branches
- a full IDE-like script debugger
- `MagVarUpdate` product work
- `Phase 4` migration workflow work

## Design Principles

### 1. Host truth must be separate from API existence

`SCRIPT_BRIDGE_API_MATRIX` is useful, but it answers the wrong question for Phase 5. It tells us that a symbol exists in the bridge surface. It does not tell us whether the current product host actually supports it.

So the design introduces a second single source of truth:

- bridge matrix: "the API surface exists"
- host matrix: "the product host supports this capability in this mode"

This removes the need to guess from scattered handlers.

### 2. Fail-fast is a first-class product contract

Unsupported behavior must not look like partial success.

For each tracked capability, the host matrix should describe one of these modes:

- `default` — works in `/session` with no extra host injection
- `conditional` — works only when an explicit host callback or external provider exists
- `fail-fast` — intentionally errors with a documented reason
- `unsupported` — not implemented and not promised

This keeps the system honest and removes special-case ambiguity.

### 3. The debugger must show host semantics

`components/ScriptDebugPanel.tsx` currently shows only:

- script name
- status
- timestamp
- error message

That is too shallow for host debugging. The debugger should become the product window into host behavior.

The first version should show:

- host capability status
- recent API calls and their resolved host path
- tool registration / event listener state
- whether external host overrides are active

### 4. Scope stays narrow and deliberate

Batch 1 should only cover a small capability slice:

- tool registration
- extension state
- clipboard
- audio

These four are enough to exercise all important host modes without turning Phase 5 into another sprawling command sweep.

## Proposed Architecture

### A. New host capability source

Add a new host-focused module that defines capability metadata separate from the bridge matrix.

Suggested shape:

```ts
type HostSupportLevel = "default" | "conditional" | "fail-fast" | "unsupported";

interface ScriptHostCapability {
  id: string;
  area: "tool-registration" | "extension-state" | "clipboard" | "audio";
  support: HostSupportLevel;
  hostSource: "session-default" | "api-context" | "bridge-only";
  hasProductEntry: boolean;
  visibleInDebugger: boolean;
  failFastReason?: string;
}
```

This module should be data-only. The product should derive behavior from it instead of re-describing the same support status in multiple places.

### B. Host resolution helpers

Add a thin helper layer that resolves runtime status for the debugger:

- whether `/session` has a default implementation
- whether the current page injected an override
- whether the capability is bridge-only
- which fail-fast reason applies

This logic must stay out of `page.tsx` and out of individual bridge handlers as much as possible.

### C. Lightweight debug state

Add a small debug store or state helper for recent host observations:

- last N API calls
- resolved host path
- success or fail-fast outcome
- tool registration count
- event listener count
- external override presence

This is not a general telemetry system. It is a local developer-facing state slice for `Script Debugger`.

### D. Script Debugger upgrade

Extend `ScriptDebugPanel` from a passive status list into a structured host debugger.

Recommended sections:

1. `Host Capability`
   - grouped by `tool registration`, `extension state`, `clipboard`, `audio`
   - shows support level badge and source

2. `Recent API Calls`
   - method name
   - resolved host path
   - outcome
   - timestamp

3. `Runtime State`
   - registered function tool count
   - active event listener count
   - external host override detected or not

4. `Script Status`
   - preserve the existing execution list so current behavior is not lost

## Batch 1 Capability Scope

### Tool Registration

Questions this batch must answer:

- can scripts register function tools
- where do registrations live
- are callbacks wired and observable
- how does cleanup look in debugger state

### Extension State

Questions this batch must answer:

- which extension reads are supported
- which writes are fail-fast
- how does debugger distinguish them

### Clipboard

Questions this batch must answer:

- is clipboard available by default in `/session`
- if not, is it conditional or fail-fast
- does the debugger show which path is active

### Audio

Questions this batch must answer:

- which audio controls are real host capabilities
- which depend on injected callbacks
- which error paths are intentional

## Validation Strategy

Batch 1 verification should cover three layers.

### 1. Matrix and resolver unit tests

Prove that:

- each tracked capability has a declared support level
- fail-fast capabilities expose a stable reason
- runtime resolver maps host/default/injected states correctly

### 2. Debugger component tests

Prove that:

- support level badges render correctly
- recent API call rows show resolved path and outcome
- runtime state counters render correctly

### 3. Bridge/session integration tests

Prove that:

- API calls for the selected capability slice write debug observations
- default and conditional host paths are distinguished
- intentional fail-fast behavior is visible instead of silently swallowed

## Risks

### Risk 1: Duplicating truth between matrices

If the host matrix drifts away from the bridge matrix, we create a new source of confusion.

Mitigation:

- keep bridge surface and host support in separate files with separate responsibilities
- add tests that ensure every batch-1 tracked host capability maps to known bridge APIs

### Risk 2: Overbuilding the debugger

The debugger can easily turn into a large side project.

Mitigation:

- batch 1 only adds visibility for the selected four capability areas
- no generic tracing framework
- no remote persistence

### Risk 3: `page.tsx` becomes larger again

The host-debug path could tempt us to add more inline glue in the session page.

Mitigation:

- keep capability resolution and debug recording in dedicated helpers
- wire only the minimal state into the page/component surface

## Success Criteria

Phase 5 batch 1 is successful when:

- the repository has a documented `JS-Slash-Runner` host capability matrix
- fail-fast behavior is explicit and test-backed for the selected capability slice
- `Script Debugger` shows host support state, recent API resolution, and runtime counters
- targeted tests and `pnpm verify:stage` pass

## Recommended Next Step

Translate this design into an implementation plan that executes in this order:

1. host matrix and resolver tests first
2. minimal runtime/debug state wiring
3. `Script Debugger` UI enhancement
4. capability-slice integration coverage
5. full verification
