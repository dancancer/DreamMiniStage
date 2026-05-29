# POC-6a.2 World Activation State

## Goal

Verify that sticky, cooldown and delay counters are stored in `StorySession.worldbookActivationState` and not written back into static `WorldModule` entries.

## Fixture

`lib/story-agent/runtime/__tests__/story-session.test.ts` creates three compiled world entries:

| Entry | Key | Activation |
| --- | --- | --- |
| `sticky` | `alpha` | `sticky: 2` |
| `cooldown` | `beta` | `cooldown: 2` |
| `delayed` | `later` | `delay: 1` |

The test advances multiple turns through `prepareStoryTurn()` and `finalizeStoryTurn()`.

## Assertions

- Turn 2 hits `sticky:sticky` without matching the primary key again.
- Turn 2 hits `delayed:delayed` after the delay counter expires.
- Turn 3 does not hit `cooldown` while the cooldown counter remains active.
- Static compiled content for the `sticky` entry remains `Alpha lore`.

## Command

```bash
pnpm vitest run lib/story-agent/runtime/__tests__/story-session.test.ts
```

## Result

Passed in the targeted Phase 6a test set.
