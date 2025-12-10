# Requirements Document

## Introduction

This feature continues the slash command migration plan by wiring the new parser/executor into UI and iframe triggers, rendering role-specific outputs correctly, and adding P2 math/string/array commands. The goal is to keep behavior consistent with the established kernel while enabling script authors and chat users to see accurate effects end to end with solid test coverage.

## Requirements

### Requirement 1 — UI/iframe execution parity

**User Story:** As a chat user, I want slash scripts triggered from the UI or iframe to execute with the new kernel and preserve state, so that control-flow and closures behave identically to core expectations.

#### Acceptance Criteria

1. WHEN `triggerSlash` (or equivalent bridge) receives scripts containing closures or control flow THEN the system SHALL execute them through the new kernel and propagate variable mutations to the session store without loss.
2. WHEN command handlers return `onSend`/`onTrigger`/`onSendAs`/`onSendSystem`/`onImpersonate`/`onContinue`/`onSwipe` payloads THEN the system SHALL dispatch them to the chat pipeline and persist messages with correct role metadata.
3. WHEN a script emits `return`/`break`/`abort` signals or parse/handler errors THEN the system SHALL surface structured statuses to the UI and avoid partial or duplicated message emissions.

### Requirement 2 — Role-based rendering and swipe interactions

**User Story:** As a chat participant, I want system, narrator/impersonated, and swipe outputs rendered distinctly, so that script-generated messages remain legible and recoverable in history.

#### Acceptance Criteria

1. WHEN handlers emit system/narrator/impersonated roles THEN the UI SHALL render distinct styles and the conversation store SHALL persist role metadata for replay and restore.
2. WHEN `/swipe` is invoked and no specialized callback is provided THEN the system SHALL fall back to the existing generation/swipe path and expose candidate selection/restore in the UI.
3. WHEN continuing or resuming after a swipe selection THEN the UI SHALL replace or append messages consistently and SHALL prevent duplicate token streams.

### Requirement 3 — P2 operator commands

**User Story:** As a script author, I want basic math/string/array slash commands available, so that I can manipulate values inline without leaving scripts.

#### Acceptance Criteria

1. WHEN `/add` or `/sub` receives numeric literals or piped numeric values THEN the system SHALL compute arithmetic results and SHALL raise type errors for non-numeric inputs.
2. WHEN `/len` or `/trim` is applied to strings (or arrays for `/len`) THEN the system SHALL return the expected length/trimmed value and SHALL reject unsupported types with structured errors.
3. WHEN `/push` (and related append/pop semantics) operates on arrays THEN the system SHALL mutate or return updated arrays deterministically and SHALL preserve pipeline state on arity/type violations.
4. WHEN new P2 commands are registered THEN unit/property tests SHALL cover success and failure cases, ensuring no regressions to existing P0/P1 command behaviors.

### Requirement 4 — Regression guardrails

**User Story:** As a maintainer, I want automated coverage for kernel, handlers, and UI bridges, so that future changes do not break slash command behavior.

#### Acceptance Criteria

1. WHEN new features are added THEN Vitest suites (unit/property/snapshot) SHALL cover P2 commands, UI dispatch, and pipeline integration paths.
2. WHEN running `pnpm test` (targeted suites acceptable) THEN all existing kernel/property/P1 message tests plus the new cases SHALL pass.
3. IF errors are detected in the new paths THEN the system SHALL fail the test run with actionable diagnostics instead of masking regressions.

