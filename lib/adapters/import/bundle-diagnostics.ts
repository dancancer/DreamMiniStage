import type {
  ImportedAssetBundle,
  ImportedCharacterProfile,
  ImportedPreset,
  ImportedRegexScript,
  ImportedWorldBook,
  ImportedWorldBookEntry,
  ImportDiagnostic,
} from "./bundle-types";

export type ImportDiagnosticCode =
  | "character.missing_description"
  | "character.missing_first_message"
  | "extension.unsupported"
  | "preset.empty_enabled_prompt"
  | "preset.empty_prompt_set"
  | "regex.invalid_pattern"
  | "regex.ui_html_unsupported"
  | "worldbook.empty_content"
  | "worldbook.missing_primary_keys"
  | "worldbook.selective_missing_secondary_keys"
  | "worldbook.stateful_activation_required";

export interface DiagnosticSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  codes: Record<string, number>;
}

export function diagnoseImportedAssetBundle(bundle: ImportedAssetBundle): ImportDiagnostic[] {
  return [
    ...withPrefix("character", bundle.character.diagnostics),
    ...diagnoseCharacter(bundle.character),
    ...bundle.worldBooks.flatMap(diagnoseWorldBook),
    ...diagnosePreset(bundle.preset),
    ...bundle.regexScripts.flatMap(diagnoseRegexScript),
    ...bundle.extensionArtifacts.flatMap((artifact) =>
      withPrefix(`extensionArtifacts.${artifact.id}`, artifact.diagnostics),
    ),
    ...withPrefix("bundle", bundle.diagnostics),
  ].sort(compareDiagnostics);
}

export function summarizeDiagnostics(diagnostics: ImportDiagnostic[]): DiagnosticSummary {
  const summary: DiagnosticSummary = {
    total: diagnostics.length,
    errors: 0,
    warnings: 0,
    info: 0,
    codes: {},
  };

  for (const diagnostic of diagnostics) {
    summary.codes[diagnostic.code] = (summary.codes[diagnostic.code] ?? 0) + 1;
    if (diagnostic.severity === "error") summary.errors += 1;
    if (diagnostic.severity === "warning") summary.warnings += 1;
    if (diagnostic.severity === "info") summary.info += 1;
  }

  return summary;
}

function diagnoseCharacter(character: ImportedCharacterProfile): ImportDiagnostic[] {
  return compact([
    emptyText(character.description) && warning(
      "character.missing_description",
      "Character description is empty.",
      "character.description",
      "data.description",
    ),
    emptyText(character.firstMessage) && warning(
      "character.missing_first_message",
      "Character first message is empty.",
      "character.firstMessage",
      "data.first_mes",
    ),
  ]);
}

function diagnoseWorldBook(book: ImportedWorldBook): ImportDiagnostic[] {
  return [
    ...withPrefix(`worldBooks.${book.id}`, book.diagnostics),
    ...book.entries.flatMap((entry) => diagnoseWorldBookEntry(book.id, entry)),
  ];
}

function diagnoseWorldBookEntry(
  bookId: string,
  entry: ImportedWorldBookEntry,
): ImportDiagnostic[] {
  const item = entry.normalized;
  const path = `worldBooks.${bookId}.entries.${entry.id}.normalized`;

  return compact([
    emptyText(item.content) && warning(
      "worldbook.empty_content",
      "World book entry content is empty.",
      `${path}.content`,
      "content",
    ),
    item.keys.length === 0 && !item.constant && warning(
      "worldbook.missing_primary_keys",
      "World book entry has no primary keys and is not constant.",
      `${path}.keys`,
      "key",
    ),
    item.selective && item.secondary_keys.length === 0 && warning(
      "worldbook.selective_missing_secondary_keys",
      "Selective world book entry has no secondary keys.",
      `${path}.secondary_keys`,
      "keysecondary",
    ),
    hasStatefulActivation(item) && info(
      "worldbook.stateful_activation_required",
      "World book entry uses sticky, cooldown, or delay runtime activation state.",
      path,
      "sticky|cooldown|delay",
    ),
  ]);
}

function diagnosePreset(preset: ImportedPreset | undefined): ImportDiagnostic[] {
  if (!preset) return [];
  const prompts = preset.normalized.prompts;

  return [
    ...withPrefix(`preset.${preset.id}`, preset.diagnostics),
    ...compact([
      prompts.length === 0 && warning(
        "preset.empty_prompt_set",
        "Preset has no prompts.",
        `preset.${preset.id}.normalized.prompts`,
        "prompts",
      ),
    ]),
    ...prompts.flatMap((prompt, index) =>
      prompt.enabled !== false && emptyText(prompt.content)
        ? [
          warning(
            "preset.empty_enabled_prompt",
            "Enabled preset prompt has empty content.",
            `preset.${preset.id}.normalized.prompts.${index}.content`,
            `prompts.${index}.content`,
          ),
        ]
        : [],
    ),
  ];
}

function diagnoseRegexScript(script: ImportedRegexScript): ImportDiagnostic[] {
  const basePath = `regexScripts.${script.id}.raw`;

  return [
    ...withPrefix(`regexScripts.${script.id}`, script.diagnostics),
    ...compact([
      invalidRegex(script.raw.findRegex) && warning(
        "regex.invalid_pattern",
        "Regex script pattern cannot be compiled.",
        `${basePath}.findRegex`,
        "findRegex",
      ),
      containsHtmlDocument(script.raw.replaceString) && warning(
        "regex.ui_html_unsupported",
        "Regex script emits HTML UI and must be converted to RenderIntent or marked unsupported.",
        `${basePath}.replaceString`,
        "replaceString",
      ),
    ]),
  ];
}

function withPrefix(prefix: string, diagnostics: ImportDiagnostic[]): ImportDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    targetPath: diagnostic.targetPath ?? prefix,
  }));
}

function warning(
  code: ImportDiagnosticCode,
  message: string,
  targetPath: string,
  sourceField: string,
): ImportDiagnostic {
  return { code, severity: "warning", message, targetPath, sourceField };
}

function info(
  code: ImportDiagnosticCode,
  message: string,
  targetPath: string,
  sourceField: string,
): ImportDiagnostic {
  return { code, severity: "info", message, targetPath, sourceField };
}

function emptyText(value: string | undefined | null): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function invalidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return false;
  } catch {
    return true;
  }
}

function containsHtmlDocument(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<!doctype html|<html[\s>]|<style[\s>]|<script[\s>]/i.test(value);
}

function hasStatefulActivation(value: {
  sticky?: number;
  cooldown?: number;
  delay?: number;
}): boolean {
  return Boolean(value.sticky || value.cooldown || value.delay);
}

function compact<T>(values: Array<T | false | undefined>): T[] {
  return values.filter((value): value is T => Boolean(value));
}

function compareDiagnostics(left: ImportDiagnostic, right: ImportDiagnostic): number {
  return [
    left.severity.localeCompare(right.severity),
    left.code.localeCompare(right.code),
    (left.targetPath ?? "").localeCompare(right.targetPath ?? ""),
  ].find((value) => value !== 0) ?? 0;
}
