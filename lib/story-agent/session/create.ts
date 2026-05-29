import { LocalCharacterRecordOperations, type CharacterRecord } from "@/lib/data/roleplay/character-record-operation";
import { SessionOperations } from "@/lib/data/roleplay/session-operation";
import type { RawCharacterData } from "@/lib/models/rawdata-model";
import { createStorySession } from "@/lib/story-agent/runtime/story-session";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import { generateDefaultSessionName, type Session } from "@/types/session";
import { getStoryBlueprint, saveStorySession } from "./store";

const STORY_BLUEPRINT_ID_KEY = "storyBlueprintId";

export interface CreateStorySessionForCharacterOptions {
  name?: string;
}

export async function createStorySessionForCharacter(
  characterId: string,
  options: CreateStorySessionForCharacterOptions = {},
): Promise<Session> {
  const record = await LocalCharacterRecordOperations.getCharacterById(characterId);
  if (!record) {
    throw new Error(`Character not found: ${characterId}`);
  }

  const blueprintId = readStoryBlueprintId(record);
  const blueprint = await getStoryBlueprint(blueprintId);
  if (!blueprint) {
    throw new Error(`SessionBlueprint not found for character: ${characterId}`);
  }

  const session = await SessionOperations.createSession(
    characterId,
    options.name || generateDefaultSessionName(blueprint.profile.name),
  );
  await saveStorySession(createStorySession({
    dialogueId: session.id,
    blueprint,
  }));

  return session;
}

export function createStoryAgentCharacterData(blueprint: SessionBlueprint): RawCharacterData {
  const { profile } = blueprint;
  const data = {
    name: profile.name,
    description: profile.description || "",
    personality: profile.personality || "",
    first_mes: profile.firstMessage || "",
    scenario: profile.scenario || "",
    mes_example: profile.exampleMessages || "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    tags: ["story-agent"],
    creator: "",
    character_version: `story-blueprint-v${blueprint.schemaVersion}`,
    alternate_greetings: profile.openings.slice(1).map((opening) => opening.content),
    character_book: { entries: [] },
    extensions: {
      [STORY_BLUEPRINT_ID_KEY]: blueprint.id,
      storyBlueprintHash: blueprint.sourceHash,
      storyBlueprintSchemaVersion: blueprint.schemaVersion,
      storyRenderIntents: blueprint.renderRules,
    },
  };

  return {
    id: profile.id,
    name: profile.name,
    description: data.description,
    personality: data.personality,
    first_mes: data.first_mes,
    scenario: data.scenario,
    mes_example: data.mes_example,
    creatorcomment: "",
    avatar: "",
    sample_status: "",
    data,
  };
}

export function readStoryBlueprintId(record: CharacterRecord): string {
  const id = record.data.data?.extensions?.[STORY_BLUEPRINT_ID_KEY];
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error(`Character is not a compiled Story Agent: ${record.id}`);
  }
  return id;
}
