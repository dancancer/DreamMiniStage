import {
  extractRenderIntentMatches,
  type RenderIntent,
} from "@/lib/story-agent/render-intent";

export interface StatusPanelFallbackInput {
  text: string;
  intents: RenderIntent[];
  characterName: string;
  now: string;
}

export function applyStatusPanelFallback(input: StatusPanelFallbackInput): string {
  const intent = input.intents.find((item) => item.kind === "status-panel");
  if (!intent || hasStatusSource(input.text, input.intents)) return input.text;

  return [input.text.trim(), buildStatusSourceTag({
    tag: statusTag(intent.sourcePattern),
    characterName: input.characterName,
    now: input.now,
  })].filter(Boolean).join("\n\n");
}

function hasStatusSource(text: string, intents: RenderIntent[]): boolean {
  return extractRenderIntentMatches(text, intents).some((match) => match.intent.kind === "status-panel");
}

function buildStatusSourceTag(input: {
  tag: string;
  characterName: string;
  now: string;
}): string {
  const data = {
    mode: input.tag.toLowerCase(),
    date: input.now.slice(0, 10),
    time: input.now.slice(11, 16),
    location: "未知",
    characters: [{
      name: input.characterName,
      status: "待更新",
      relation: "",
      pose: "",
      clothing: "",
      location: "",
      avatar: null,
      portrait: null,
      thought: "",
    }],
  };
  return `<${input.tag}>${JSON.stringify(data)}</${input.tag}>`;
}

function statusTag(pattern: string | undefined): string {
  return pattern?.match(/<([a-z][a-z0-9_-]*)>/i)?.[1] ?? "SFW";
}
