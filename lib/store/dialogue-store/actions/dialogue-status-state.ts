import type { DialogueData } from "../types";

export function markDialogueSending(
  dialogue: DialogueData,
): DialogueData {
  return {
    ...dialogue,
    isSending: true,
    suggestedInputs: [],
  };
}

export function clearDialogueSending(
  dialogue: DialogueData,
): DialogueData {
  return {
    ...dialogue,
    isSending: false,
  };
}
