import type { SecondaryKeyLogic } from "@/lib/models/world-book-model";

const ST_SELECTIVE_LOGIC: Record<number, SecondaryKeyLogic> = {
  0: "AND_ANY",
  1: "NOT_ALL",
  2: "NOT_ANY",
  3: "AND_ALL",
};

const SUPPORTED_SELECTIVE_LOGIC = new Set<SecondaryKeyLogic>([
  "AND",
  "OR",
  "NOT",
  "AND_ANY",
  "AND_ALL",
  "NOT_ANY",
  "NOT_ALL",
]);

export function normalizeSelectiveLogic(value: unknown): SecondaryKeyLogic | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    const logic = ST_SELECTIVE_LOGIC[value];
    if (logic) return logic;
  }

  if (typeof value === "string") {
    const upper = value.toUpperCase() as SecondaryKeyLogic;
    if (SUPPORTED_SELECTIVE_LOGIC.has(upper)) return upper;
  }

  throw new Error(`Unsupported worldbook selectiveLogic: ${String(value)}`);
}
