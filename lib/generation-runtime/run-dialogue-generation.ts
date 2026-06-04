import {
  runPreparedDialogueTurn,
  type DialogueTurnSink,
  type RunPreparedDialogueTurnInput,
} from "@/lib/generation-runtime/dialogue-turn";

export type DialogueGenerationSink = DialogueTurnSink;
type RunDialogueGenerationInput = RunPreparedDialogueTurnInput;

export async function runDialogueGeneration(
  input: RunDialogueGenerationInput,
  sink: DialogueGenerationSink,
): Promise<void> {
  await runPreparedDialogueTurn(input, sink);
}
