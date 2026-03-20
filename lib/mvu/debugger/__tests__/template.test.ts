import { describe, expect, it } from "vitest";

import { renderStatusBarTemplate } from "@/lib/mvu/debugger/template";

describe("renderStatusBarTemplate", () => {
  it("renders status_bar placeholders using display values first", () => {
    expect(renderStatusBarTemplate(
      "生命 {{status_bar.hp}} / 楼层 {{status_bar.floor}}",
      {
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
      },
    )).toBe("生命 9->12 / 楼层 3");
  });

  it("keeps unknown placeholders visible so authors can notice invalid keys", () => {
    expect(renderStatusBarTemplate(
      "未知 {{status_bar.unknown}}",
      {
        stat_data: {
          status_bar: {
            hp: [12, "生命值"],
          },
        },
        display_data: {},
        delta_data: {},
      },
    )).toBe("未知 {{status_bar.unknown}}");
  });
});
