# POC-6a.3 No ST Runtime Fields

## Goal

Verify that the product generation path no longer depends on ST-shaped runtime fields or runtime branches.

## Grep Command

```bash
rg -n "STPromptManager|PresetNodeTools|DialogueWorkflow|RegexProcessor|regex-processor|world-book-advanced|executeSlashCommandScript|processMessageVariables|initMvuVariablesFromWorldBooks|vector-memory|prompt_order|\"placement\"" app/session components/CharacterChatPanel.tsx hooks/useScriptBridge.ts function/dialogue lib/generation-runtime lib/story-agent/runtime lib/story-agent/session -g '*.ts' -g '*.tsx'
```

## Grep Result

Only invariant tests mention the forbidden ST field names:

```text
lib/story-agent/runtime/__tests__/story-session.test.ts
lib/generation-runtime/__tests__/prepare-dialogue-execution.test.ts
```

There are no product-path hits for:

- `STPromptManager`
- `PresetNodeTools`
- `DialogueWorkflow`
- `RegexProcessor`
- `world-book-advanced`
- `executeSlashCommandScript`
- MVU response processing
- vector-memory ingest

## Runtime Assertions

`lib/story-agent/runtime/__tests__/story-session.test.ts` and `lib/generation-runtime/__tests__/prepare-dialogue-execution.test.ts` assert serialized prepared requests do not contain exact `"prompt_order"` or `"placement"` fields.

## Result

Passed in the targeted Phase 6a test set.
