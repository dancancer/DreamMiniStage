import { PHASE4_MIGRATION_CHECKLIST } from "./phase4-checklist";
import type {
  ImportSemanticsSummary,
  MigrationFieldRule,
  MigrationMaterialKind,
} from "./types";

function createEmptySummary(): ImportSemanticsSummary {
  return {
    retained: [],
    ignored: [],
    downgraded: [],
    manualReview: [],
    notes: [],
  };
}

function appendField(
  summary: ImportSemanticsSummary,
  field: string,
  rule: MigrationFieldRule,
): void {
  if (rule.status === "retained") {
    summary.retained.push(field);
  } else if (rule.status === "ignored") {
    summary.ignored.push(field);
  } else if (rule.status === "downgraded") {
    summary.downgraded.push(field);
  } else {
    summary.manualReview.push(field);
  }

  if (!summary.notes.includes(rule.userNote)) {
    summary.notes.push(rule.userNote);
  }
}

export function summarizeImportSemantics(
  kind: MigrationMaterialKind,
  importedFields: string[],
): ImportSemanticsSummary {
  const summary = createEmptySummary();
  const checklist = PHASE4_MIGRATION_CHECKLIST[kind];

  for (const field of importedFields) {
    const rule = checklist.fields[field];
    if (!rule) {
      summary.manualReview.push(field);
      continue;
    }
    appendField(summary, field, rule);
  }

  for (const note of checklist.notes ?? []) {
    if (!summary.notes.includes(note)) {
      summary.notes.push(note);
    }
  }

  return summary;
}

export function summarizeChecklistSemantics(
  kind: MigrationMaterialKind,
): ImportSemanticsSummary {
  return summarizeImportSemantics(
    kind,
    Object.keys(PHASE4_MIGRATION_CHECKLIST[kind].fields),
  );
}

export function mergeImportSemanticsSummaries(
  summaries: Array<ImportSemanticsSummary | undefined>,
): ImportSemanticsSummary | undefined {
  const merged = createEmptySummary();

  for (const summary of summaries) {
    if (!summary) {
      continue;
    }

    for (const field of summary.retained) {
      if (!merged.retained.includes(field)) {
        merged.retained.push(field);
      }
    }

    for (const field of summary.ignored) {
      if (!merged.ignored.includes(field)) {
        merged.ignored.push(field);
      }
    }

    for (const field of summary.downgraded) {
      if (!merged.downgraded.includes(field)) {
        merged.downgraded.push(field);
      }
    }

    for (const field of summary.manualReview) {
      if (!merged.manualReview.includes(field)) {
        merged.manualReview.push(field);
      }
    }

    for (const note of summary.notes) {
      if (!merged.notes.includes(note)) {
        merged.notes.push(note);
      }
    }
  }

  if (
    merged.retained.length === 0 &&
    merged.ignored.length === 0 &&
    merged.downgraded.length === 0 &&
    merged.manualReview.length === 0 &&
    merged.notes.length === 0
  ) {
    return undefined;
  }

  return merged;
}
