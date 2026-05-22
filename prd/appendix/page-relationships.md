# Page Relationships

## 1. Route Graph

```text
/
├─ open session card ───────────────> /session?id={sessionId}
└─ New Session ─────────────────────> /character-cards?mode=create-session

/character-cards
├─ import/edit/delete/move-to-top
└─ mode=create-session + select card -> create session -> /session?id={sessionId}

/personas
└─ manage persona state used by prompt runtime

/session?id={sessionId}
├─ chat view
├─ worldbook view
├─ preset view
├─ regex view
└─ right panel entries

/test-script-runner
└─ internal P4 scenario diagnostics
```

## 2. Shared Layout

`app/layout.tsx` wraps all routes with:

- `ThemeProvider`
- `SoundProvider`
- `LanguageProvider`
- `MainShell`
- `ToastProvider`
- analytics

`MainShell` owns the persistent app shell. `RightPanel` can be opened from global navigation or session tools.

## 3. Session Dependencies

`/session?id={sessionId}` depends on:

1. `sessions_record` to resolve `characterId`.
2. `characters_record` to load role card.
3. `character_dialogues` to load dialogue tree.
4. `model-config-storage` and model localStorage keys for generation.
5. prompt config store for preset/context/sysprompt/instruct.
6. world book / regex / persona stores for context assembly.

If any required identity link is missing, page must show explicit empty/error state.

## 4. Right Panel Relationships

| Panel | Can open without session | Session-aware behavior |
|-------|--------------------------|------------------------|
| `characters` | yes | links to `/character-cards` and `/` |
| `worldbook` | yes | with session: character/dialogue; without session: global library |
| `regex` | yes | with session: scoped tab allowed; without session: global workspace |
| `presets` | yes | shows current role hint when session exists |
| `sessionTools` | partial | hides prompt viewer if no `dialogueId` |
| `modelSettings` | yes | global model config |
| `plugins` | yes | depends on browser plugin registry |
| `data` | yes | global import/export |
| `settingsHub` | yes | links to other panels |

## 5. Data Ownership

| Domain | Owner |
|--------|-------|
| Session list | `useSessionStore` + `SessionOperations` |
| Dialogue messages | `useDialogueStore` + `LocalCharacterDialogueOperations` |
| Character cards | `LocalCharacterRecordOperations` |
| Persona | `usePersonaStore` |
| Model config | `useModelStore` |
| Prompt behavior | `usePromptConfigStore` |
| Right panel state | `UiLayoutProvider` |
| Script/slash state | `session-slash-executor`, `script-bridge` |

## 6. Internal Pages

`/test-script-runner` must stay documented because it is a real route, but it should be treated as an internal QA page. It should not be used to define ordinary user navigation or product onboarding.
