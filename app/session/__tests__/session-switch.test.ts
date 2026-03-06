import { describe, expect, it } from "vitest";
import { buildSwitchedSessionName, buildTemporarySessionName } from "../session-switch";

describe("buildSwitchedSessionName", () => {
  it("builds switch name with source character", () => {
    const now = new Date(2026, 2, 2, 23, 16, 0);
    const name = buildSwitchedSessionName("Bob", "Alice", now);

    expect(name).toBe("Bob - 03/02 23:16 [from Alice]");
  });

  it("falls back to default style when source is missing or same character", () => {
    const now = new Date(2026, 2, 2, 23, 16, 0);

    expect(buildSwitchedSessionName("Bob", undefined, now)).toBe("Bob - 03/02 23:16");
    expect(buildSwitchedSessionName("Bob", " bob ", now)).toBe("Bob - 03/02 23:16");
  });
});

describe("buildTemporarySessionName", () => {
  it("marks temporary sessions with temp suffix", () => {
    const now = new Date(2026, 2, 2, 23, 16, 0);
    const name = buildTemporarySessionName("Bob", now);

    expect(name).toBe("Bob - 03/02 23:16 [temp]");
  });

  it("falls back to unknown when character name is empty", () => {
    const now = new Date(2026, 2, 2, 23, 16, 0);

    expect(buildTemporarySessionName("  ", now)).toBe("unknown - 03/02 23:16 [temp]");
  });
});
