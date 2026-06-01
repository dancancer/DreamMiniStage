import type { StoryInitialState } from "@/lib/story-agent/blueprint";
import {
  createEmptyStoryState,
  type StoryStateData,
} from "./update";

export function createInitialStoryState(
  initialState: StoryInitialState,
  now: string,
): StoryStateData {
  return {
    ...createEmptyStoryState(now),
    variables: cloneJson(initialState.variables),
    errors: initialState.errors.slice(-16),
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
