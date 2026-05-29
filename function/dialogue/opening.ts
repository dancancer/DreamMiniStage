/**
 * @input  lib/story-agent/session
 * @output OpeningPayload, prepareOpeningGreeting
 * @pos    开场白准备 - 从 SessionBlueprint 读取首条消息
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { loadStoryRuntimeBinding } from "@/lib/story-agent/session";

export interface OpeningPayload {
  id: string;
  content: string;
  fullContent: string;
}

export async function prepareOpeningGreeting(params: {
  dialogueId: string;
  characterId: string;
  language?: "zh" | "en";
  username?: string;
}): Promise<OpeningPayload> {
  const { dialogueId, username } = params;
  const { blueprint } = await loadStoryRuntimeBinding(dialogueId);
  const seedGreeting = blueprint.profile.firstMessage || `你好，我是${blueprint.profile.name}。`;
  const content = renderOpeningMacros(seedGreeting, {
    charName: blueprint.profile.name,
    username: username || "user",
  });

  return {
    id: `${dialogueId}-opening`,
    content,
    fullContent: content,
  };
}

function renderOpeningMacros(
  content: string,
  names: { charName: string; username: string },
): string {
  return content
    .replace(/\{\{char\}\}/gi, names.charName)
    .replace(/\{\{user\}\}/gi, names.username);
}
