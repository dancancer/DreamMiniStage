import { describe, expect, it } from "vitest";
import { extractFirstJsonObject } from "../extract-json";

describe("extractFirstJsonObject", () => {
  it("returns a bare JSON object unchanged", () => {
    expect(extractFirstJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("extracts a nested object embedded in surrounding prose", () => {
    expect(extractFirstJsonObject('prefix {"a":{"b":2}} suffix')).toBe('{"a":{"b":2}}');
  });

  it("ignores braces inside strings", () => {
    expect(extractFirstJsonObject('{"s":"}"}')).toBe('{"s":"}"}');
  });

  it("returns undefined when there is no object", () => {
    expect(extractFirstJsonObject("no json here")).toBeUndefined();
  });

  it("handles strings ending in an escaped backslash", () => {
    // actual JSON: {"a":"\\"} — the value is a single backslash; the closing
    // quote must not be misread as escaped.
    expect(extractFirstJsonObject('{"a":"\\\\"}')).toBe('{"a":"\\\\"}');
  });
});
