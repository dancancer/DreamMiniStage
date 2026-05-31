/**
 * @input  lib/story-agent/session, lib/story-agent/runtime/render/status-fallback
 * @output OpeningPayload, prepareOpeningGreeting
 * @pos    开场白准备 - 从 SessionBlueprint 读取并整理可展示开场
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { loadStoryRuntimeBinding } from "@/lib/story-agent/session";
import { orderPlayableOpenings } from "@/lib/story-agent/blueprint/profile/openings";
import { applyStatusPanelFallback } from "@/lib/story-agent/runtime/render/status-fallback";
import type { OpeningPayload } from "@/types/character-dialogue";

export type { OpeningPayload } from "@/types/character-dialogue";

export async function prepareOpeningGreetings(params: {
  dialogueId: string;
  characterId: string;
  language?: "zh" | "en";
  username?: string;
}): Promise<OpeningPayload[]> {
  const { dialogueId, username } = params;
  const { blueprint } = await loadStoryRuntimeBinding(dialogueId);
  const openings = blueprint.profile.openings.length > 0
    ? blueprint.profile.openings
    : [{
      id: "opening:fallback",
      content: blueprint.profile.firstMessage || `你好，我是${blueprint.profile.name}。`,
    }];

  return orderPlayableOpenings(openings).map((opening, index) => {
    const fullContent = renderOpeningMacros(opening.content, {
      charName: blueprint.profile.name,
      username: username || "user",
    });
    const content = applyStatusPanelFallback({
      text: fullContent,
      intents: blueprint.renderRules,
      characterName: blueprint.profile.name,
      now: new Date().toISOString(),
    });

    return {
      id: `${dialogueId}-opening-${index}`,
      content,
      fullContent,
    };
  });
}

export async function prepareOpeningGreeting(params: {
  dialogueId: string;
  characterId: string;
  language?: "zh" | "en";
  username?: string;
}): Promise<OpeningPayload> {
  const [opening] = await prepareOpeningGreetings(params);
  if (!opening) {
    throw new Error("SessionBlueprint did not produce an opening message");
  }
  return opening;
}

function renderOpeningMacros(
  content: string,
  names: { charName: string; username: string },
): string {
  return content
    .replace(/\{\{char\}\}/gi, names.charName)
    .replace(/\{\{user\}\}/gi, names.username)
    .replace(/<char>/gi, names.charName)
    .replace(/<user>/gi, names.username);
}
