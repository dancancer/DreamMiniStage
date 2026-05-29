import { z } from "zod";
import type { ImportDiagnostic } from "./bundle-types";

export const repairRiskSchema = z.enum(["low", "medium", "high"]);
export const repairOperationSchema = z.enum(["add", "replace", "remove"]);

export const importDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  targetPath: z.string().optional(),
  sourceField: z.string().optional(),
}) satisfies z.ZodType<ImportDiagnostic>;

export const llmQaInputSchema = z.object({
  bundleId: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  diagnostics: z.array(importDiagnosticSchema),
  repairablePaths: z.array(z.string().min(1)),
});

export const repairPatchSchema = z.object({
  id: z.string().min(1),
  operation: repairOperationSchema,
  targetPath: z.string().min(1).refine((path) => path.startsWith("/"), {
    message: "targetPath must be a JSON Pointer",
  }),
  value: z.unknown().optional(),
  reason: z.string().min(1),
  diagnosticCode: z.string().min(1).optional(),
  claimedRisk: repairRiskSchema.optional(),
});

export const llmQaOutputSchema = z.object({
  patches: z.array(repairPatchSchema),
});

export type RepairRisk = z.infer<typeof repairRiskSchema>;
export type RepairOperation = z.infer<typeof repairOperationSchema>;
export type RepairPatch = z.infer<typeof repairPatchSchema>;
export type LlmQaInput = z.infer<typeof llmQaInputSchema>;
export type LlmQaOutput = z.infer<typeof llmQaOutputSchema>;

export interface RepairRiskRule {
  pattern: string;
  risk: RepairRisk;
  reason: string;
}

export interface ValidatedRepairPatch {
  patch: RepairPatch;
  computedRisk: RepairRisk;
  autoApply: boolean;
  requiresUserConfirmation: boolean;
}

export class RepairPatchValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RepairPatchValidationError";
  }
}

export const REPAIR_RISK_RULES: RepairRiskRule[] = [
  high("/character/description", "Character identity and premise."),
  high("/character/personality", "Character personality."),
  high("/character/scenario", "Story scenario."),
  high("/character/firstMessage", "Opening message."),
  high("/character/exampleMessages", "Example dialogue."),
  high("/character/promptFragments/*/content", "Compiled character prompt fragment."),
  high("/preset/normalized/prompts/*/content", "Preset prompt content."),
  high("/preset/normalized/sysprompt/content", "System prompt content."),
  high("/preset/normalized/sysprompt/post_history", "Post-history system prompt content."),
  high("/worldBooks/*/entries/*/normalized/content", "World book content."),
  high("/worldBooks/*/entries/*/normalized/keys", "World book primary trigger keys."),
  high("/worldBooks/*/entries/*/normalized/secondary_keys", "World book secondary trigger keys."),
  high("/worldBooks/*/entries/*/normalized/selectiveLogic", "World book trigger logic."),
  high("/regexScripts/*/raw/findRegex", "Regex matching logic."),
  high("/regexScripts/*/raw/replaceString", "Regex replacement or UI output."),
  medium("/extensionArtifacts/*/kind", "Unsupported extension classification."),
  low("/character/creator", "Character metadata."),
  low("/character/version", "Character metadata."),
  low("/preset/name", "Preset display name."),
  low("/worldBooks/*/name", "World book display name."),
  low("/regexScripts/*/raw/scriptName", "Regex script display name."),
  low("/extensionArtifacts/*/summary", "Unsupported extension summary."),
];

export const HIGH_RISK_PATHS = REPAIR_RISK_RULES
  .filter((rule) => rule.risk === "high")
  .map((rule) => rule.pattern);

export function computeRepairRisk(
  targetPath: string,
  operation: RepairOperation,
): RepairRisk {
  const rule = REPAIR_RISK_RULES.find((item) => matchesPointer(item.pattern, targetPath));
  if (!rule) {
    throw new RepairPatchValidationError(
      "repair.unsupported_target_path",
      `Unsupported repair target path: ${targetPath}`,
    );
  }

  if (operation !== "remove") return rule.risk;
  if (rule.risk === "low") return "medium";
  return "high";
}

export function validateRepairPatch(input: unknown): ValidatedRepairPatch {
  const patch = repairPatchSchema.parse(input);
  assertOperationValue(patch);

  const computedRisk = computeRepairRisk(patch.targetPath, patch.operation);
  if (patch.claimedRisk && patch.claimedRisk !== computedRisk) {
    throw new RepairPatchValidationError(
      "repair.risk_mismatch",
      `Patch claimed ${patch.claimedRisk} risk, computed ${computedRisk}.`,
    );
  }

  return {
    patch,
    computedRisk,
    autoApply: computedRisk === "low",
    requiresUserConfirmation: computedRisk !== "low",
  };
}

export function validateRepairOutput(input: unknown): ValidatedRepairPatch[] {
  const output = llmQaOutputSchema.parse(input);
  return output.patches.map(validateRepairPatch);
}

export function applyAutoRepairPatch<T>(target: T, repair: ValidatedRepairPatch): T {
  if (!repair.autoApply) {
    throw new RepairPatchValidationError(
      "repair.manual_confirmation_required",
      "Only low-risk validated repairs can be auto-applied.",
    );
  }

  const draft = cloneJson(target);
  writePointer(draft, repair.patch);
  return draft;
}

function assertOperationValue(patch: RepairPatch): void {
  if (patch.operation === "remove") return;
  if (patch.value === undefined) {
    throw new RepairPatchValidationError(
      "repair.missing_value",
      `${patch.operation} repair requires value.`,
    );
  }
}

function writePointer(target: unknown, patch: RepairPatch): void {
  const parts = parsePointer(patch.targetPath);
  const key = parts.at(-1);
  const parent = resolveParent(target, parts);

  if (key === undefined) {
    throw new RepairPatchValidationError("repair.empty_path", "Cannot patch document root.");
  }

  if (patch.operation === "remove") {
    removeValue(parent, key);
    return;
  }

  setValue(parent, key, patch.value);
}

function resolveParent(target: unknown, parts: string[]): unknown {
  return parts.slice(0, -1).reduce((current, part) => {
    if (!isObjectLike(current)) {
      throw new RepairPatchValidationError(
        "repair.invalid_parent",
        `Cannot traverse through non-object path segment: ${part}`,
      );
    }
    return readValue(current, part);
  }, target);
}

function readValue(target: Record<string, unknown> | unknown[], key: string): unknown {
  return Array.isArray(target) ? target[toIndex(key)] : target[key];
}

function setValue(target: unknown, key: string, value: unknown): void {
  if (!isObjectLike(target)) {
    throw new RepairPatchValidationError("repair.invalid_parent", "Patch parent is not writable.");
  }
  if (Array.isArray(target)) target[toIndex(key)] = value;
  else target[key] = value;
}

function removeValue(target: unknown, key: string): void {
  if (!isObjectLike(target)) {
    throw new RepairPatchValidationError("repair.invalid_parent", "Patch parent is not writable.");
  }
  if (Array.isArray(target)) target.splice(toIndex(key), 1);
  else delete target[key];
}

function matchesPointer(pattern: string, targetPath: string): boolean {
  const patternParts = parsePointer(pattern);
  const targetParts = parsePointer(targetPath);
  return patternParts.length === targetParts.length &&
    patternParts.every((part, index) => part === "*" || part === targetParts[index]);
}

function parsePointer(pointer: string): string[] {
  if (!pointer.startsWith("/")) {
    throw new RepairPatchValidationError(
      "repair.invalid_json_pointer",
      `Invalid JSON Pointer: ${pointer}`,
    );
  }
  return pointer.split("/").slice(1).map(unescapePointer);
}

function unescapePointer(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~");
}

function toIndex(value: string): number {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) {
    throw new RepairPatchValidationError("repair.invalid_array_index", `Invalid array index: ${value}`);
  }
  return index;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function high(pattern: string, reason: string): RepairRiskRule {
  return { pattern, risk: "high", reason };
}

function medium(pattern: string, reason: string): RepairRiskRule {
  return { pattern, risk: "medium", reason };
}

function low(pattern: string, reason: string): RepairRiskRule {
  return { pattern, risk: "low", reason };
}
