/**
 * @input  function/dialogue/chat-streaming, function/dialogue/story-turn-lifecycle
 * @output runStoryDialogueTurn
 * @pos    Dialogue Turn 生命周期入口 - prepare 后交给 response transport
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { handlePreparedDialogueResponse } from "@/function/dialogue/chat-streaming";
import {
  prepareStoryDialogueTurn,
  type StoryTurnLifecycleInput,
} from "@/function/dialogue/story-turn-lifecycle";

export type { StoryTurnLifecycleInput };

export async function runStoryDialogueTurn(
  input: StoryTurnLifecycleInput,
): Promise<Response> {
  const turn = await prepareStoryDialogueTurn(input);

  return handlePreparedDialogueResponse({
    dialogueId: turn.dialogueId,
    originalMessage: turn.originalMessage,
    nodeId: turn.nodeId,
    preparedExecution: turn.preparedExecution,
    streaming: turn.responseStreaming,
  });
}
