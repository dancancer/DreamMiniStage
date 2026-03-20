import { buildStatusBarEntries } from "@/lib/mvu/debugger/status-bar";
import type { MvuData } from "@/lib/mvu/types";

const STATUS_BAR_PLACEHOLDER = /\{\{\s*status_bar\.([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function buildDefaultStatusBarTemplate(
  variables: Pick<MvuData, "stat_data" | "display_data"> | null | undefined,
): string {
  const entries = buildStatusBarEntries(variables);
  return entries
    .map((entry) => `${entry.label}: {{status_bar.${entry.key}}}`)
    .join(" | ");
}

export function renderStatusBarTemplate(
  template: string,
  variables: Pick<MvuData, "stat_data" | "display_data"> | null | undefined,
): string {
  if (!template) {
    return "";
  }

  const entryMap = new Map(
    buildStatusBarEntries(variables).map((entry) => [entry.key, entry.displayValue] as const),
  );

  return template.replace(STATUS_BAR_PLACEHOLDER, (fullMatch, key: string) => {
    return entryMap.get(key) ?? fullMatch;
  });
}
