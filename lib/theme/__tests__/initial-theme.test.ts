import { describe, expect, it } from "vitest";
import { createThemeInitScript, resolveThemeMode } from "@/lib/theme/initial-theme";

describe("resolveThemeMode", () => {
  it("prefers an explicit document preset when present", () => {
    expect(resolveThemeMode("dark", "light", false)).toBe("dark");
    expect(resolveThemeMode("light", "dark", true)).toBe("light");
  });

  it("falls back to stored preference before system preference", () => {
    expect(resolveThemeMode(null, "dark", false)).toBe("dark");
    expect(resolveThemeMode(undefined, "light", true)).toBe("light");
  });

  it("uses system preference when no preset or stored value exists", () => {
    expect(resolveThemeMode(null, null, true)).toBe("dark");
    expect(resolveThemeMode(undefined, undefined, false)).toBe("light");
  });
});

describe("createThemeInitScript", () => {
  it("generates a boot script that reads localStorage and writes the root dataset", () => {
    const script = createThemeInitScript("DreamMiniStage-theme");

    expect(script).toContain("localStorage.getItem");
    expect(script).toContain("root.dataset.theme = mode");
    expect(script).toContain("DreamMiniStage-theme");
  });
});
