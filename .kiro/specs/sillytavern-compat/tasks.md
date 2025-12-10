# Implementation Plan

## SillyTavern Compatibility Layer

- [x] 1. Set up Slash Command core infrastructure
  - [x] 1.1 Create `lib/slash-command/` directory structure
    - Create parser.ts, executor.ts, registry.ts, types.ts
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Implement Slash Command parser
    - Parse command name, positional args, named args
    - Handle pipe operator `|` for command chaining
    - _Requirements: 1.1, 1.2_
  - [ ] 1.3 Write property test for parser round-trip
    - **Property 1: Slash Command Parse-Execute Round-Trip**
    - **Validates: Requirements 1.1, 1.4**
  - [x] 1.4 Implement command registry with core commands
    - Register `/send`, `/trigger`, `/setvar`, `/getvar`, `/delvar`
    - Use Map-based registry (no switch/case)
    - _Requirements: 1.1, 8.3_
  - [x] 1.5 Write property test for pipe propagation
    - **Property 2: Pipe Propagation in Command Sequences**
    - **Validates: Requirements 1.2**
  - [x] 1.6 Implement Slash Command executor
    - Execute parsed commands sequentially
    - Pass pipe values between commands
    - Handle errors gracefully
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 1.7 Write property test for error handling
    - **Property 3: Error Handling for Invalid Commands**
    - **Validates: Requirements 1.3, 1.5**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrate Slash Commands with Script Bridge
  - [x] 3.1 Create `hooks/script-bridge/slash-handlers.ts`
    - Implement `triggerSlash` handler
    - Wire up to parser and executor
    - _Requirements: 1.1, 8.1_
  - [x] 3.2 Update `hooks/script-bridge/index.ts`
    - Import and register slash handlers
    - _Requirements: 1.1_
  - [x] 3.3 Update `public/iframe-libs/slash-runner-shim.js`
    - Add `triggerSlash` to TavernHelper API
    - Add `triggerSlashWithResult` alias
    - _Requirements: 9.1, 9.3_
  - [x] 3.4 Write integration test for triggerSlash
    - Test `/send text|/trigger` flow
    - _Requirements: 8.1, 8.2_

- [x] 4. Enhance Event System
  - [x] 4.1 Create `hooks/script-bridge/event-handlers.ts`
    - Implement iframe-scoped event listener registry
    - Support `eventOn`, `eventOnce`, `eventEmit`, `eventRemoveListener`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Implement iframe cleanup on destroy
    - Auto-remove all listeners when iframe is destroyed
    - _Requirements: 3.5_
  - [ ]* 4.3 Write property test for event subscription lifecycle
    - **Property 5: Event Subscription Lifecycle**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  - [x] 4.4 Update slash-runner-shim.js with event API
    - Add event methods to TavernHelper
    - _Requirements: 9.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Enhance Variable Handlers
  - [x] 6.1 Review and update `hooks/script-bridge/variable-handlers.ts`
    - Ensure `getVariables`, `replaceVariables`, `insertOrAssignVariables`, `deleteVariable` are complete
    - Add localStorage persistence
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 6.2 Write property test for variable CRUD round-trip
    - **Property 4: Variable CRUD Round-Trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 7. Enhance Message Handlers
  - [x] 7.1 Review and update `hooks/script-bridge/message-handlers.ts`
    - Ensure `getChatMessages`, `setChatMessages`, `createChatMessages`, `deleteChatMessages` are complete
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 7.2 Write property test for message CRUD round-trip
    - **Property 6: Message CRUD Round-Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 8. Enhance Lorebook Handlers
  - [x] 8.1 Review and update `hooks/script-bridge/lorebook-handlers.ts`
    - Ensure `getLorebookEntries`, `createLorebookEntry`, `deleteLorebookEntry`, `updateLorebookEntriesWith` are complete
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 8.2 Write property test for lorebook entry CRUD round-trip
    - **Property 7: Lorebook Entry CRUD Round-Trip**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 9. Enhance Preset Handlers
  - [x] 9.1 Review and update `hooks/script-bridge/preset-handlers.ts`
    - Ensure `getPresetNames`, `getPreset`, `loadPreset`, `createPreset`, `deletePreset` are complete
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 9.2 Write property test for preset CRUD round-trip
    - **Property 8: Preset CRUD Round-Trip**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Finalize TavernHelper Compatibility Layer
  - [x] 11.1 Audit `public/iframe-libs/slash-runner-shim.js` for API completeness
    - Verify all TavernHelper methods are implemented or stubbed
    - Add warning logs for unimplemented methods
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 11.2 Ensure shim injection order
    - Verify shim loads before user scripts
    - _Requirements: 9.5_
  - [ ]* 11.3 Write property test for TavernHelper API completeness
    - **Property 9: TavernHelper API Completeness**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

- [ ] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
