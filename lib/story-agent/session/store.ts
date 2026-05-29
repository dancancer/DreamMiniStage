import {
  getRecordByKey,
  putRecord,
  STORY_BLUEPRINTS_FILE,
  STORY_SESSIONS_FILE,
} from "@/lib/data/local-storage";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import type { StorySessionState } from "@/lib/story-agent/runtime/story-session";

export interface StoryBlueprintRecord {
  id: string;
  blueprint: SessionBlueprint;
  createdAt: string;
  updatedAt: string;
}

export interface StoryRuntimeBinding {
  blueprint: SessionBlueprint;
  session: StorySessionState;
}

export async function saveStoryBlueprint(
  blueprint: SessionBlueprint,
  now = new Date().toISOString(),
): Promise<void> {
  await putRecord<StoryBlueprintRecord>(STORY_BLUEPRINTS_FILE, blueprint.id, {
    id: blueprint.id,
    blueprint,
    createdAt: blueprint.createdAt,
    updatedAt: now,
  });
}

export async function getStoryBlueprint(id: string): Promise<SessionBlueprint | null> {
  const record = await getRecordByKey<StoryBlueprintRecord>(STORY_BLUEPRINTS_FILE, id);
  return record?.blueprint ?? null;
}

export async function saveStorySession(session: StorySessionState): Promise<void> {
  await putRecord<StorySessionState>(STORY_SESSIONS_FILE, session.id, session);
}

export async function getStorySession(dialogueId: string): Promise<StorySessionState | null> {
  return getRecordByKey<StorySessionState>(STORY_SESSIONS_FILE, dialogueId);
}

export async function loadStoryRuntimeBinding(dialogueId: string): Promise<StoryRuntimeBinding> {
  const session = await getStorySession(dialogueId);
  if (!session) {
    throw new Error(`StorySession is not initialized for dialogue: ${dialogueId}`);
  }

  const blueprint = await getStoryBlueprint(session.blueprintId);
  if (!blueprint) {
    throw new Error(`SessionBlueprint not found for dialogue: ${dialogueId}`);
  }

  return { blueprint, session };
}

