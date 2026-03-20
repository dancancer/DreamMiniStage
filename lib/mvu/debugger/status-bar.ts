import { getVWDDescription, getVWDValue, isValueWithDescription } from "@/lib/mvu/types";
import type { MvuData } from "@/lib/mvu/types";

export interface StatusBarEntry {
  key: string;
  label: string;
  rawValue: unknown;
  displayValue: string;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function isStatusBarValueWithDescription(value: unknown): boolean {
  if (isValueWithDescription(value)) {
    return true;
  }

  return Array.isArray(value) && value.length === 2 && typeof value[1] === "string";
}

export function buildStatusBarEntries(
  variables: Pick<MvuData, "stat_data" | "display_data"> | null | undefined,
): StatusBarEntry[] {
  const statBar = toRecord(variables?.stat_data?.status_bar);
  if (!statBar) {
    return [];
  }

  const displayBar = toRecord(variables?.display_data?.status_bar);

  return Object.entries(statBar).map(([key, value]) => {
    const rawValue = isStatusBarValueWithDescription(value) ? getVWDValue(value as [unknown, string]) : value;
    const label = isStatusBarValueWithDescription(value) ? getVWDDescription(value as [unknown, string]) : key;
    const displayValue = formatDisplayValue(displayBar?.[key] ?? rawValue);

    return {
      key,
      label,
      rawValue,
      displayValue,
    };
  });
}
