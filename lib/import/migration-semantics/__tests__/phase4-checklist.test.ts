import { describe, expect, it } from "vitest";
import { PHASE4_MIGRATION_CHECKLIST } from "@/lib/import/migration-semantics/phase4-checklist";
import { summarizeImportSemantics } from "@/lib/import/migration-semantics/report";

describe("phase4 migration semantics", () => {
  it("declares worldbook field outcomes explicitly", () => {
    expect(
      PHASE4_MIGRATION_CHECKLIST.worldbook.fields.useProbability.status,
    ).toBe("retained");
    expect(
      PHASE4_MIGRATION_CHECKLIST.worldbook.fields.groupWeight.status,
    ).toBe("retained");
  });

  it("builds retained/ignored/downgraded buckets", () => {
    const summary = summarizeImportSemantics("worldbook", [
      "useProbability",
      "groupWeight",
      "personaBindings",
    ]);

    expect(summary.retained).toContain("useProbability");
    expect(summary.retained).toContain("groupWeight");
    expect(summary.manualReview).toContain("personaBindings");
  });
});
