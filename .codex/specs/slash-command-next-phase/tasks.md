# Implementation Plan

- [ ] 1. Bridge UI/iframe to new kernel execution  
  - Wire `triggerSlash` (or equivalent entry) to `executeSlashCommandScript`, normalizing script/context and returning structured `{ status, messages?, variables?, error? }`.  
  - Mock pipeline callbacks (`onSend`, `onTrigger`, `onSendAs`, `onSendSystem`, `onImpersonate`, `onContinue`, `onSwipe`) in tests to assert dispatch order and role metadata.  
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Roleful message dispatch & persistence  
  - Ensure bridge → chat store appends messages with role metadata (system/narrator/impersonate) and marks source `slash-command`.  
  - Add snapshot/integration tests verifying distinct rendering styles and persisted role metadata for replay/restore.  
  - _Requirements: 2.1, 2.3_

- [ ] 3. Swipe fallback and continuation guards  
  - Implement `/swipe` fallback to existing generation/swipe path when specialized callback absent; expose selection/restore hooks.  
  - Add guard to prevent duplicate token streams on continue/restore; cover with integration tests.  
  - _Requirements: 2.2, 2.3, 1.3_

- [ ] 4. P2 command registration and semantics  
  - Add `/add`, `/sub`, `/len`, `/trim`, `/push` descriptors with strict type/arity checks and structured errors (`type_error`, `arity_error`).  
  - Return numeric results for add/sub; lengths for string/array; trimmed strings; array append behavior deterministic.  
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. P2 command tests (unit/property)  
  - Write happy-path and failure tests for each P2 command, including piped inputs; assert errors do not emit partial outputs.  
  - Ensure no regressions to P0/P1 by reusing/expanding property suites.  
  - _Requirements: 3.4, 4.1, 4.3_

- [ ] 6. Bridge/kernel integration tests  
  - Cover parse errors, control signals (`return|break|abort`), and handler errors surfacing as structured statuses without duplicate emissions.  
  - Assert variable mutations persist through closures and bubble to session store.  
  - _Requirements: 1.1, 1.3, 4.1_

- [ ] 7. UI snapshot tests for roles and swipe flows  
  - Snapshot role-specific renders (system/narrator/impersonate) and swipe selection/restore behavior.  
  - Verify no duplicate messages on continue and that swipe fallback paths remain styled consistently.  
  - _Requirements: 2.1, 2.2, 2.3, 4.1_

- [ ] 8. CI gate and commands  
  - Ensure targeted `pnpm vitest` suites run for kernel/property/P1 plus new P2/bridge/UI snapshots.  
  - Document the targeted command in repo scripts or docs if not present; ensure failures surface actionable diagnostics.  
  - _Requirements: 4.1, 4.2, 4.3_
