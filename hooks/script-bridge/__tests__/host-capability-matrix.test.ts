import { describe, expect, it } from "vitest";

const BATCH_ONE_AREAS = [
  "tool-registration",
  "extension-state",
  "clipboard",
  "audio",
] as const;

describe("script host capability matrix", () => {
  it("declares the phase 5 batch-1 host capability areas", async () => {
    const matrixModule = await import("../host-capability-matrix");
    const areas = new Set(
      matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX.map((capability) => capability.area),
    );

    expect(areas).toEqual(new Set(BATCH_ONE_AREAS));
  });

  it("uses a stable support level for each capability", async () => {
    const matrixModule = await import("../host-capability-matrix");

    expect(matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX).not.toHaveLength(0);

    for (const capability of matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX) {
      expect([
        "default",
        "conditional",
        "fail-fast",
        "unsupported",
      ]).toContain(capability.support);
    }
  });

  it("requires a fail-fast reason whenever a capability is declared fail-fast", async () => {
    const matrixModule = await import("../host-capability-matrix");

    for (const capability of matrixModule.SCRIPT_HOST_CAPABILITY_MATRIX) {
      if (capability.support !== "fail-fast") {
        continue;
      }

      expect(capability.failFastReason?.trim()).toBeTruthy();
    }
  });
});
