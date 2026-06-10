import { describe, expect, it } from "vitest";
import { isSfwStatusSourcePattern, isStatusJsonSourcePattern } from "../status-pattern";

describe("isStatusJsonSourcePattern", () => {
  it("matches a status-like tag carrying an escaped JSON brace", () => {
    expect(isStatusJsonSourcePattern("<StatusDashboard>\\{")).toBe(true);
    expect(isStatusJsonSourcePattern("<SFW>\\{")).toBe(true);
  });

  it("rejects a non-status tag even with an escaped brace", () => {
    expect(isStatusJsonSourcePattern("<div>\\{")).toBe(false);
  });

  it("rejects a status tag without an escaped JSON brace", () => {
    expect(isStatusJsonSourcePattern("<status>")).toBe(false);
  });
});

describe("isSfwStatusSourcePattern", () => {
  it("matches SFW/NSFW tags case-insensitively", () => {
    expect(isSfwStatusSourcePattern("prefix<SFW>suffix")).toBe(true);
    expect(isSfwStatusSourcePattern("<nsfw>")).toBe(true);
  });

  it("rejects unrelated tags", () => {
    expect(isSfwStatusSourcePattern("<div>")).toBe(false);
  });
});
