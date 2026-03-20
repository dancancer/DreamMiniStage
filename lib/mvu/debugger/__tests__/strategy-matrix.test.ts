import { describe, expect, it } from "vitest";

import {
  getDefaultMvuStrategy,
  getRecommendedMvuStrategy,
  MVU_STRATEGY_MATRIX,
} from "@/lib/mvu/debugger/strategy-matrix";

describe("mvu strategy matrix", () => {
  it("declares stable phase6 strategy entries", () => {
    expect(MVU_STRATEGY_MATRIX.map((entry) => entry.id)).toEqual([
      "text-delta",
      "function-calling",
      "extra-model",
    ]);
  });

  it("keeps text delta as the only default product path for now", () => {
    expect(getDefaultMvuStrategy().id).toBe("text-delta");
    expect(getDefaultMvuStrategy().support).toBe("default");
  });

  it("does not recommend extra-model without explicit marker evidence", () => {
    const recommendation = getRecommendedMvuStrategy({ hasUpdateMarker: false });

    expect(recommendation.primary.id).toBe("text-delta");
    expect(recommendation.secondary).toBeNull();
  });

  it("surfaces extra-model as a conditional follow-up when update markers exist", () => {
    const recommendation = getRecommendedMvuStrategy({ hasUpdateMarker: true });

    expect(recommendation.primary.id).toBe("text-delta");
    expect(recommendation.secondary?.id).toBe("extra-model");
  });
});
