/**
 * @input  lib/story-agent/session, lib/story-agent/runtime/render/status-fallback
 * @output OpeningPayload, prepareOpeningGreeting
 * @pos    开场白准备 - 从 SessionBlueprint 读取并整理可展示开场
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { loadStoryRuntimeBinding } from "@/lib/story-agent/session";
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

  return orderOpeningsForFirstDisplay(openings).map((opening, index) => {
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

function orderOpeningsForFirstDisplay<T extends { content: string }>(openings: T[]): T[] {
  const firstPlayableIndex = openings.findIndex(isPlayableOpening);
  if (firstPlayableIndex <= 0) return openings;
  const firstPlayable = openings[firstPlayableIndex];
  if (!firstPlayable) return openings;
  return [
    firstPlayable,
    ...openings.slice(0, firstPlayableIndex),
    ...openings.slice(firstPlayableIndex + 1),
  ];
}

function isPlayableOpening(opening: { content: string }): boolean {
  const text = opening.content.trim();
  if (!text) return false;
  if (isInstructionOnlyOpening(text)) return false;
  return !isDocumentationOpening(text);
}

function isInstructionOnlyOpening(text: string): boolean {
  return /^<开局>[\s\S]*<\/开局>$/i.test(text) && /按下面要求处理|follow the instructions/i.test(text);
}

function isDocumentationOpening(text: string): boolean {
  const hints = [
    /游玩前|使用前|说明/,
    /插件|MagVarUpdate|TavernHelper/i,
    /状态栏|状态表/,
    /开场白|开场/,
    /变量|user人设|人设/,
  ];
  const hitCount = hints.filter((hint) => hint.test(text)).length;
  return text.length > 700 && hitCount >= 3;
}
