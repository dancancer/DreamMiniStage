import type {
  ImportedAssetBundle,
  ImportDiagnostic,
} from "@/lib/adapters/import";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

interface ContractSource {
  content: string;
  targetPath: string;
  sourceField: string;
}

export function diagnoseUnsupportedRenderContracts(
  bundle: ImportedAssetBundle,
  renderRules: RenderIntent[],
): ImportDiagnostic[] {
  const supportedTags = supportedSourceTags(renderRules);
  return contractSources(bundle)
    .flatMap((source) => diagnoseContractSource(source, supportedTags))
    .sort(compareDiagnostics);
}

function diagnoseContractSource(
  source: ContractSource,
  supportedTags: Set<string>,
): ImportDiagnostic[] {
  return unsupportedStatusTags(source.content, supportedTags).map((tag) => ({
    code: "render.status_contract_unsupported",
    severity: "warning",
    message: `Status-like source tag <${tag}> contains JSON but has no compiled RenderIntent.`,
    targetPath: source.targetPath,
    sourceField: source.sourceField,
  }));
}

function contractSources(bundle: ImportedAssetBundle): ContractSource[] {
  return [
    source(bundle.character.firstMessage, "profile.firstMessage", "data.first_mes"),
    ...bundle.character.alternateGreetings.map((content, index) =>
      source(content, `profile.openings.${index + 1}`, `data.alternate_greetings.${index}`),
    ),
    ...bundle.character.promptFragments.map((fragment) =>
      source(fragment.content, `profile.promptFragments.${fragment.id}`, fragment.sourceField),
    ),
    ...bundle.worldBooks.flatMap((book) => book.entries.map((entry) =>
      source(
        entry.normalized.content,
        `worldModules.${book.id}.entries.${entry.id}.content`,
        entry.provenance[0]?.sourceField ?? "entries",
      ),
    )),
    ...(bundle.preset?.normalized.prompts ?? []).map((prompt, index) =>
      source(prompt.content ?? "", `promptStack.preset.${prompt.identifier}`, `prompts.${index}.content`),
    ),
  ].filter((item) => item.content.trim().length > 0);
}

function source(
  content: string | undefined,
  targetPath: string,
  sourceField: string,
): ContractSource {
  return {
    content: content ?? "",
    targetPath,
    sourceField,
  };
}

function unsupportedStatusTags(content: string, supportedTags: Set<string>): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(statusTagBlockPattern())) {
    const tag = match[1] ?? "";
    if (!tag || supportedTags.has(tag.toLowerCase())) continue;
    if (isStatusContractBody(match[2] ?? "")) tags.add(tag);
  }
  return [...tags].sort();
}

function supportedSourceTags(renderRules: RenderIntent[]): Set<string> {
  return new Set(renderRules.flatMap(sourcePatternTags).map((tag) => tag.toLowerCase()));
}

function sourcePatternTags(intent: RenderIntent): string[] {
  const sourcePattern = "sourcePattern" in intent ? intent.sourcePattern : undefined;
  if (!sourcePattern) return [];
  return [...sourcePattern.matchAll(/<\\?\/?([a-z][a-z0-9_-]*|SFW|NSFW)/gi)]
    .map((match) => match[1] ?? "")
    .filter(isStatusLikeTag);
}

function statusTagBlockPattern(): RegExp {
  return /<((?:[a-z][a-z0-9_-]*(?:status|state|dashboard|variables?)[a-z0-9_-]*)|status|state|dashboard|variables?|SFW|NSFW)>([\s\S]*?)<\/\1>/gi;
}

function isStatusContractBody(body: string): boolean {
  const text = body.trim();
  return text.startsWith("{") ||
    text.startsWith("[") ||
    /"[^"]+"\s*:/.test(text) ||
    /\bJSON\b/i.test(text);
}

function isStatusLikeTag(tag: string): boolean {
  return /status|state|dashboard|variables?|^SFW$|^NSFW$/i.test(tag);
}

function compareDiagnostics(left: ImportDiagnostic, right: ImportDiagnostic): number {
  return (left.targetPath ?? "").localeCompare(right.targetPath ?? "") ||
    (left.sourceField ?? "").localeCompare(right.sourceField ?? "") ||
    left.message.localeCompare(right.message);
}
