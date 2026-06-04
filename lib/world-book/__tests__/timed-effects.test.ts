import { describe, expect, it } from "vitest";
import {
  normalizeWorldBookTimedEffectState,
  readWorldBookTimedEffectValue,
  resolveNextWorldBookTimedEffectValue,
  writeWorldBookTimedEffectValue,
} from "../timed-effects";

describe("World Book timed effects", () => {
  it("normalizes only positive finite sticky/cooldown/delay values", () => {
    expect(normalizeWorldBookTimedEffectState({
      "book-1": {
        "uid-1": {
          sticky: 2.8,
          cooldown: -1,
          delay: Number.POSITIVE_INFINITY,
          ignored: 9,
        },
        "uid-2": {
          sticky: 0,
        },
      },
    })).toEqual({
      "book-1": {
        "uid-1": {
          sticky: 2,
        },
      },
    });
  });

  it("writes and prunes empty timed effect branches", () => {
    const withValue = writeWorldBookTimedEffectValue({}, "book-1", "uid-1", "delay", 3);
    expect(readWorldBookTimedEffectValue(withValue, "book-1", "uid-1", "delay")).toBe(3);

    expect(writeWorldBookTimedEffectValue(withValue, "book-1", "uid-1", "delay", 0)).toEqual({});
  });

  it("resolves on/off/toggle from configured World Book entry values", () => {
    expect(resolveNextWorldBookTimedEffectValue({
      currentValue: 0,
      configuredValue: 4,
      effect: "sticky",
      state: "on",
    })).toBe(4);
    expect(resolveNextWorldBookTimedEffectValue({
      currentValue: 4,
      configuredValue: 4,
      effect: "sticky",
      state: "toggle",
    })).toBe(0);
    expect(resolveNextWorldBookTimedEffectValue({
      currentValue: 0,
      configuredValue: 4,
      effect: "sticky",
      state: "off",
    })).toBe(0);
  });

  it("fails fast when the World Book entry does not configure the requested effect", () => {
    expect(() => resolveNextWorldBookTimedEffectValue({
      currentValue: 0,
      configuredValue: 0,
      effect: "cooldown",
      state: "on",
    })).toThrow("/wi-set-timed-effect effect is not configured on World Book entry: cooldown");
  });
});
