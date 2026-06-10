import { getStorySession } from "./store";

export type StoryBranchOperation = "regenerate" | "swipe" | "branch-switch";

const OPERATION_LABEL: Record<StoryBranchOperation, string> = {
  regenerate: "regenerate",
  swipe: "swipe",
  "branch-switch": "branch switching",
};

export function getStoryBranchOperationUnsupportedMessage(
  operation: StoryBranchOperation,
): string {
  return `Story Agent ${OPERATION_LABEL[operation]} is disabled until StoryState branch replay is implemented.`;
}

export async function getStoryBranchOperationUnsupportedReason(
  dialogueId: string,
  operation: StoryBranchOperation,
): Promise<string | null> {
  const session = await getStorySession(dialogueId);
  if (!session) return null;

  return getStoryBranchOperationUnsupportedMessage(operation);
}

export async function assertStoryBranchOperationSupported(
  dialogueId: string,
  operation: StoryBranchOperation,
): Promise<void> {
  const message = await getStoryBranchOperationUnsupportedReason(dialogueId, operation);
  if (!message) return;

  throw new Error(message);
}
