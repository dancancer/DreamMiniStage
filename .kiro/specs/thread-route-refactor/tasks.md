# Implementation Plan

- [x] 1. Create new session route
  - [x] 1.1 Create app/session/page.tsx
    - Move content from app/character/page.tsx
    - Update to use `id` parameter as sessionId
    - Remove legacy `characterId` parameter handling
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Handle old character route
  - [x] 2.1 Clear app/character/page.tsx content
    - Remove current chat functionality
    - Add placeholder for future "character detail" feature
    - Redirect to home page temporarily
    - _Requirements: 2.1, 2.2_

- [x] 3. Update internal navigation
  - [x] 3.1 Update HomeContent.tsx navigation
    - Change `/character?id=...&sessionId=...` to `/session?id=...`
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 Update character-cards/page.tsx navigation
    - Change `/character?id=...&sessionId=...` to `/session?id=...`
    - _Requirements: 3.3_
  - [x] 3.3 Update CharacterCardCarousel.tsx navigation
    - Remove direct `/character?id=...` links
    - Add session creation before navigation
    - _Requirements: 3.3_
  - [x] 3.4 Update CharacterCardGrid.tsx navigation
    - Remove direct `/character?id=...` links
    - Add session creation before navigation
    - _Requirements: 3.3_
  - [x] 3.5 Update panels/AdvancedSettingsPanel.tsx navigation
    - Change `/character?id=...` to `/session?id=...`
    - _Requirements: 3.3_


- [x] 4. Update sidebar active state detection
  - [x] 4.1 Update Sidebar.tsx active state logic
    - Change `pathname.startsWith("/character")` to include `/session`
    - _Requirements: 3.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Final cleanup
  - [x] 6.1 Verify no remaining `/character` navigation in codebase
    - Search for `/character?` patterns
    - Ensure only redirect handler remains
    - _Requirements: 4.2_
