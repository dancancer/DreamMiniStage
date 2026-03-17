export type MigrationMaterialKind = "persona" | "worldbook" | "regex";

export type MigrationFieldStatus =
  | "retained"
  | "ignored"
  | "downgraded"
  | "manual-review";

export interface MigrationFieldRule {
  status: MigrationFieldStatus;
  runtimeNote: string;
  userNote: string;
}

export interface MigrationMaterialChecklist {
  label: string;
  fields: Record<string, MigrationFieldRule>;
  notes?: string[];
}

export type MigrationChecklist = Record<
  MigrationMaterialKind,
  MigrationMaterialChecklist
>;

export interface ImportSemanticsSummary {
  retained: string[];
  ignored: string[];
  downgraded: string[];
  manualReview: string[];
  notes: string[];
}
