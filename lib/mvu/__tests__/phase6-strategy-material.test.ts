import { describe, expect, it } from "vitest";

import round34Fixture from "@/hooks/script-bridge/__tests__/fixtures/round34-migration-material.json";
import worldbookFixture from "@/lib/core/__tests__/fixtures/phase4/worldbook-import.json";
import { getRecommendedMvuStrategy } from "@/lib/mvu/debugger/strategy-matrix";

describe("phase6 strategy material baseline", () => {
  it("uses committed repo materials to keep text-delta as the current authoring default", () => {
    const worldBookEntries = Object.values(worldbookFixture.entries).map((entry) => ({
      uid: String(entry.key?.[0] ?? "unknown"),
      comment: entry.comment ?? "",
      content: entry.content,
      keys: entry.key,
      enabled: entry.enabled,
    }));

    const recommendation = getRecommendedMvuStrategy({
      hasUpdateMarker: worldBookEntries.some((entry) => entry.comment.includes("[mvu_update]")),
    });

    expect(round34Fixture.scriptTreeSeed.character.map((entry) => entry.id)).toContain("mvu_init_check");
    expect(recommendation.primary.id).toBe("text-delta");
    expect(recommendation.secondary).toBeNull();
  });
});
