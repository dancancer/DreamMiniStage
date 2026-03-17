import type { DialogueData, DialogueMessage } from "../types";
import { mergeDialogueData, replaceDialogueMessages } from "./generation-event-state";

interface ReplaceDialogueSnapshotInput {
  dialogue: DialogueData;
  messages: DialogueMessage[];
  suggestedInputs: string[];
  patch?: Partial<DialogueData>;
}

export function replaceDialogueSnapshot(
  input: ReplaceDialogueSnapshotInput,
): DialogueData {
  const { dialogue, messages, suggestedInputs, patch } = input;

  return mergeDialogueData(
    dialogue,
    {
      ...replaceDialogueMessages(messages, suggestedInputs),
      ...patch,
    },
  );
}
