import { describe, expect, it } from "vitest";

import { buildStatusBarEntries } from "@/lib/mvu/debugger/status-bar";

describe("buildStatusBarEntries", () => {
  it("prefers display_data when available while keeping raw stat values and descriptions", () => {
    const entries = buildStatusBarEntries({
      stat_data: {
        status_bar: {
          hp: [12, "生命值"],
          floor: [3, "当前楼层"],
        },
      },
      display_data: {
        status_bar: {
          hp: "9->12",
        },
      },
      delta_data: {},
    });

    expect(entries).toEqual([
      {
        key: "hp",
        label: "生命值",
        rawValue: 12,
        displayValue: "9->12",
      },
      {
        key: "floor",
        label: "当前楼层",
        rawValue: 3,
        displayValue: "3",
      },
    ]);
  });

  it("returns an empty list when no status_bar object exists", () => {
    expect(buildStatusBarEntries({
      stat_data: {
        profile: {
          hp: [1, "not status bar"],
        },
      },
      display_data: {},
      delta_data: {},
    })).toEqual([]);
  });
});
