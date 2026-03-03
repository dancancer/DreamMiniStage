/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                     Fuzzy Command Handlers                                ║
 * ║                                                                           ║
 * ║  模糊匹配命令 - fuzzy                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import { pickText } from "../utils/helpers";

type FuzzyMode = "first" | "best";

const DEFAULT_THRESHOLD = 0.4;

/**
 * /fuzzy list=["a","b"] [threshold=0.4] [mode=first|best] [text]
 * - list 必须是 JSON 数组
 * - threshold 必须位于 [0, 1]
 * - mode 仅支持 first / best
 */
export const handleFuzzy: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  const searchText = pickText(args, pipe).trim();
  if (!searchText) {
    throw new Error("/fuzzy requires search text");
  }

  const list = parseList(namedArgs.list);
  if (list.length === 0) {
    return "";
  }

  const threshold = parseThreshold(namedArgs.threshold);
  const mode = parseMode(namedArgs.mode);

  if (mode === "first") {
    return findFirstMatch(list, searchText, threshold);
  }

  return findBestMatch(list, searchText, threshold);
};

function parseList(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") {
    throw new Error("/fuzzy requires list argument");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("/fuzzy list must be a valid JSON array");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("/fuzzy list must be a JSON array");
  }

  return parsed.map((item) => String(item));
}

function parseThreshold(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_THRESHOLD;
  }

  const threshold = Number(raw);
  if (Number.isNaN(threshold)) {
    throw new Error("/fuzzy threshold must be a number");
  }
  if (threshold < 0 || threshold > 1) {
    throw new Error("/fuzzy threshold must be between 0 and 1");
  }

  return threshold;
}

function parseMode(raw: string | undefined): FuzzyMode {
  const normalized = (raw ?? "first").trim().toLowerCase();
  if (normalized === "first" || normalized === "best") {
    return normalized;
  }
  throw new Error(`/fuzzy unsupported mode: ${raw ?? ""}`);
}

function findFirstMatch(list: string[], searchText: string, threshold: number): string {
  for (const candidate of list) {
    if (scoreCandidate(candidate, searchText) <= threshold) {
      return candidate;
    }
  }
  return "";
}

function findBestMatch(list: string[], searchText: string, threshold: number): string {
  let bestItem = "";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of list) {
    const score = scoreCandidate(candidate, searchText);
    if (score < bestScore) {
      bestScore = score;
      bestItem = candidate;
    }
  }

  return bestScore <= threshold ? bestItem : "";
}

function scoreCandidate(candidate: string, searchText: string): number {
  const left = normalizeText(candidate);
  const right = normalizeText(searchText);

  if (!left && !right) {
    return 0;
  }

  // 先走包含关系，尽量贴近上游 fuzzy 在短词命中时的行为
  if (left.includes(right) || right.includes(left)) {
    return 0;
  }

  const distance = levenshtein(left, right);
  const denominator = Math.max(left.length, right.length, 1);
  return distance / denominator;
}

function normalizeText(input: string): string {
  return input.trim().toLowerCase();
}

function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const row = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      const replaceCost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + replaceCost,
      );
      previous = current;
    }
  }

  return row[right.length];
}
