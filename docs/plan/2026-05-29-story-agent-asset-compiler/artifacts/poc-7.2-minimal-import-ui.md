# POC-7.2 Minimal Import UI

## Purpose

Verify that the product has a minimal graphical flow for selecting assets, previewing the compiled agent and creating the session.

## Inputs

The UI accepts:

- one character file: `.png` or `.json`
- optional preset JSON
- optional worldbook JSON files
- optional regex JSON files

## Artifact

- route: `app/story-agent-import/page.tsx`
- component: `components/story-agent/import-wizard/StoryAgentImportWizard.tsx`

## Pass / Fail Criteria

- Pass: the page exposes upload controls for all four asset classes.
- Pass: preview calls `previewStoryAgentFromFiles()` and shows blueprint summary counts.
- Pass: create calls `commitStoryAgentFromPreview()` and exposes an enter-session action.
- Pass: high-risk confirmation state is visible and blocks commit when present.
- Fail: the UI adds a legacy/shadow runtime switch.

## Result

- Status: `pass`
- Date: `2026-05-29`
- Verification: `pnpm typecheck`, `pnpm lint`

## Decision

Adopt this as the first product import surface. It can be polished later, but it is already wired to the blueprint-only runtime path.
