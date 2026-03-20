import type {
  ParsedMvuAppliedPath,
  ParsedMvuStrategy,
  ParsedMvuTrace,
} from "@/lib/models/parsed-response";

export function buildMvuTrace(input: {
  selectedStrategy: ParsedMvuStrategy;
  fullResponse: string;
  baseApplied: boolean;
  extraApplied: boolean;
}): ParsedMvuTrace {
  const { selectedStrategy, fullResponse, baseApplied, extraApplied } = input;
  const hasUpdateProtocol = fullResponse.includes("<UpdateVariable>");

  let appliedPath: ParsedMvuAppliedPath = "none";
  if (extraApplied) {
    appliedPath = "extra-model";
  } else if (baseApplied && selectedStrategy === "function-calling" && hasUpdateProtocol) {
    appliedPath = "function-calling";
  } else if (baseApplied) {
    appliedPath = "text-delta";
  }

  return {
    selectedStrategy,
    appliedPath,
    applied: appliedPath !== "none",
    hasUpdateProtocol,
  };
}
