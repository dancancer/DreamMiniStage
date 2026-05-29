import type {
  RegexClassification,
  RenderIntentConversion,
} from "./types";

export interface RegexClassificationReport {
  total: number;
  uiTotal: number;
  renderIntentConvertible: number;
  renderIntentCoverage: number;
  byKind: Record<string, number>;
  unsupportedReasons: Record<string, number>;
}

export function buildRegexClassificationReport(
  conversions: RenderIntentConversion[],
): RegexClassificationReport {
  const classifications = conversions.map((item) => item.classification);
  const uiTotal = classifications.filter(isUiClassification).length;
  const renderIntentConvertible = classifications.filter((item) => item.canExtractRenderIntent).length;

  return {
    total: classifications.length,
    uiTotal,
    renderIntentConvertible,
    renderIntentCoverage: uiTotal === 0 ? 0 : renderIntentConvertible / uiTotal,
    byKind: countBy(classifications, (item) => item.kind),
    unsupportedReasons: countBy(
      classifications.filter((item) => item.unsupportedReason),
      (item) => item.unsupportedReason ?? "unknown",
    ),
  };
}

function isUiClassification(classification: RegexClassification): boolean {
  return classification.canExtractRenderIntent ||
    classification.reasons.includes("html replacement");
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
