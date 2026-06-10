import type { RenderIntent } from "@/lib/story-agent/render-intent";
import { storyActionsSourcePattern } from "../action/options";

export function renderContractMessages(intents: RenderIntent[]): string[] {
  const statusContracts = statusTags(intents).map(statusRenderContract);
  return hasActionOptionsIntent(intents)
    ? [...statusContracts, actionOptionsRenderContract()]
    : statusContracts;
}

export function hasStatePanelIntent(intents: RenderIntent[]): boolean {
  return intents.some((intent) => intent.kind === "state-panel");
}

export function hasActionOptionsIntent(intents: RenderIntent[]): boolean {
  const pattern = storyActionsSourcePattern();
  return intents.some((intent) => intent.kind === "choice-list" && intent.sourcePattern === pattern);
}

function statusTags(intents: RenderIntent[]): string[] {
  return [...new Set(intents.flatMap((intent) =>
    intent.kind === "status-panel" && intent.sourcePattern
      ? [statusTag(intent.sourcePattern)]
      : [],
  ))];
}

function statusTag(pattern: string): string {
  return pattern.match(/<([a-z][a-z0-9_-]*)>/i)?.[1] ?? "SFW";
}

function statusRenderContract(tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const mode = tag.toLowerCase();
  return [
    "Story UI render contract:",
    `After every assistant story reply, include exactly one ${open}...${close} status block after narrative content.`,
    "The block is consumed by the UI renderer; do not wrap it in Markdown.",
    `Use this raw JSON shape: ${open}{"mode":"${mode}","date":"...","time":"...","location":"...","characters":[{"name":"...","status":"...","relation":"...","pose":"...","clothing":"...","location":"...","avatar":null,"portrait":null,"thought":"(...)"}],"sections":[{"title":"...","fields":[{"label":"...","value":"..."}]}],"meters":[{"label":"...","value":0,"max":100,"unit":"%","description":"..."}]}${close}`,
    "Include only active non-user characters. Put custom dashboard fields in sections and numeric gauges in meters. Use null for unknown avatar or portrait file names.",
  ].join("\n");
}

function actionOptionsRenderContract(): string {
  return [
    "Story action UI contract:",
    "If the current character or preset asks for action options, include one <action>...</action> block after narrative content.",
    "Write one concise player action per line. The block is consumed by the UI renderer; do not wrap it in Markdown.",
  ].join("\n");
}
