/**
 * @input  lib/adapters/import
 * @output compileProfileOpenings, diagnoseProfileOpenings, orderPlayableOpenings
 * @pos    Story Agent 开场策略 - 在编译期剥离说明/指令型首屏，产出可游玩开场
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       Story Agent Opening Policy                          ║
 * ║  编译期决定“什么能作为首屏开场”，让 /session 不再理解上游资产特殊格式。        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ImportDiagnostic } from "@/lib/adapters/import";

export interface SourceOpening {
  id: string;
  content: string;
  sourceField: string;
}

interface ProfileOpeningInput {
  name: string;
  firstMessage?: string;
  alternateGreetings: readonly string[];
}

export function compileProfileOpenings(input: ProfileOpeningInput): SourceOpening[] {
  const sourceOpenings = sourceProfileOpenings(input);
  const ordered = orderPlayableOpenings(sourceOpenings);
  if (ordered.some((opening) => isPlayableOpening(opening.content))) return ordered;
  if (sourceOpenings.length === 0) return [];
  return [neutralOpening(input.name)];
}

export function diagnoseProfileOpenings(input: ProfileOpeningInput): ImportDiagnostic[] {
  const sourceOpenings = sourceProfileOpenings(input);
  if (sourceOpenings.length === 0 || sourceOpenings.some((opening) => isPlayableOpening(opening.content))) {
    return [];
  }
  return [{
    code: "character.instruction_only_opening",
    severity: "warning",
    message: "Character openings are instruction-only; Story Agent generated a neutral playable opening.",
    targetPath: "profile.openings",
    sourceField: sourceOpenings.map((opening) => opening.sourceField).join("|"),
  }];
}

export function orderPlayableOpenings<T extends { content: string }>(openings: readonly T[]): T[] {
  const firstPlayableIndex = openings.findIndex((opening) => isPlayableOpening(opening.content));
  if (firstPlayableIndex <= 0) return [...openings];
  const firstPlayable = openings[firstPlayableIndex];
  if (!firstPlayable) return [...openings];
  return [
    firstPlayable,
    ...openings.slice(0, firstPlayableIndex),
    ...openings.slice(firstPlayableIndex + 1),
  ];
}

export function isPlayableOpening(content: string): boolean {
  const text = content.trim();
  if (!text) return false;
  if (isInstructionOnlyOpening(text)) return false;
  return !isDocumentationOpening(text);
}

function sourceProfileOpenings(input: ProfileOpeningInput): SourceOpening[] {
  const first = input.firstMessage ? [{
    id: "opening:first_mes",
    content: input.firstMessage,
    sourceField: "data.first_mes",
  }] : [];
  const alternates = input.alternateGreetings.map((content, index) => ({
    id: `opening:alternate:${index}`,
    content,
    sourceField: `data.alternate_greetings.${index}`,
  }));
  return [...first, ...alternates];
}

function neutralOpening(characterName: string): SourceOpening {
  return {
    id: "opening:synthetic:neutral",
    content: [
      "你在一片沉静中停下脚步。",
      `${characterName}的故事正在你面前展开，周围的环境逐渐清晰。`,
      "你可以先观察现场、询问眼前的人，或直接采取行动。",
    ].join("\n"),
    sourceField: "story-agent.synthetic_opening",
  };
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
