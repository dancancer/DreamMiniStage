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

interface StatusFallbackData {
  date: string;
  time: string;
  location: string;
}

export function applyStatusPanelFallback(input: StatusPanelFallbackInput): string {
  const intent = input.intents.find((item) => item.kind === "status-panel");
  if (!intent || hasStatusSource(input.text, input.intents)) return input.text;

  return [input.text.trim(), buildStatusSourceTag({
    tag: statusTag(intent.sourcePattern),
    characterName: input.characterName,
    data: resolveStatusData(input.text, input.now),
  })].filter(Boolean).join("\n\n");
}

function hasStatusSource(text: string, intents: RenderIntent[]): boolean {
  return extractRenderIntentMatches(text, intents).some((match) => match.intent.kind === "status-panel");
}

function buildStatusSourceTag(input: {
  tag: string;
  characterName: string;
  data: StatusFallbackData;
}): string {
  const data = {
    mode: input.tag.toLowerCase(),
    date: input.data.date,
    time: input.data.time,
    location: input.data.location,
    characters: [{
      name: input.characterName,
      status: "剧情推进中",
      relation: "",
      pose: "",
      clothing: "",
      location: input.data.location === "未知" ? "" : input.data.location,
      avatar: null,
      portrait: null,
      thought: "",
    }],
  };
  return `<${input.tag}>${JSON.stringify(data)}</${input.tag}>`;
}

function resolveStatusData(text: string, now: string): StatusFallbackData {
  return extractTimelineBar(text) ??
    extractLabeledStatus(text) ??
    extractSceneLocation(text, now) ??
    fallbackStatusData(now);
}

function extractTimelineBar(text: string): StatusFallbackData | undefined {
  return text
    .split(/\n/)
    .slice(0, 12)
    .map(parseTimelineLine)
    .find(Boolean);
}

function extractLabeledStatus(text: string): StatusFallbackData | undefined {
  const date = readLabel(text, "日期");
  const time = readLabel(text, "时间");
  const location = readLabel(text, "地点");
  if (!date && !time && !location) return undefined;
  return {
    date: date || "",
    time: time || "",
    location: location || "未知",
  };
}

function extractSceneLocation(text: string, now: string): StatusFallbackData | undefined {
  const location = text.match(/在([^，。；\n]{2,48}(?:里|中|内|外|前|旁|边|处|店|超市|公寓|房间|客厅|教室|走廊|街|站|学校))/)?.[1];
  if (!location) return undefined;
  return {
    ...fallbackStatusData(now),
    location: cleanField(location) || "未知",
  };
}

function parseTimelineLine(line: string): StatusFallbackData | undefined {
  const parts = cleanTimelineLine(line)
    .split(/[·|｜]/)
    .map(cleanField)
    .filter(Boolean);
  const dateIndex = parts.findIndex((part) => /^\d{4}年\d{1,2}月\d{1,2}日$/.test(part));
  if (dateIndex <= 0) return undefined;
  const time = parts.find((part) => /^\d{1,2}:\d{2}$/.test(part)) ?? "";
  if (!time) return undefined;
  return {
    location: parts.slice(0, dateIndex).join(" ") || "未知",
    date: parts[dateIndex] ?? "",
    time,
  };
}

function readLabel(text: string, label: string): string {
  return cleanField(text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n\\r]+)`))?.[1]);
}

function fallbackStatusData(now: string): StatusFallbackData {
  return {
    date: now.slice(0, 10),
    time: now.slice(11, 16),
    location: "未知",
  };
}

function cleanField(value: string | undefined): string {
  return (value ?? "")
    .replace(/^[`"'“”‘’\[\]【】（）()]+|[`"'“”‘’\[\]【】（）()]+$/g, "")
    .trim();
}

function cleanTimelineLine(line: string): string {
  return cleanField(line.replace(/^[-*>\s]+/, ""));
}

function statusTag(pattern: string | undefined): string {
  return pattern?.match(/<([a-z][a-z0-9_-]*)>/i)?.[1] ?? "SFW";
}
