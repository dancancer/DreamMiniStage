import { describe, expect, it } from "vitest";

import workflowFixture from "./fixtures/phase6/status-bar-workflow.json";
import { replayFloors } from "@/lib/mvu/floor-replay";
import { applyPatch, patchToMvuCommands } from "@/lib/mvu/json-patch";
import { applyTemplate } from "@/lib/mvu/data/template";

describe("phase6 mvu workflow baseline", () => {
  it("covers floor replay, array template, and json patch style updates in one reproducible sample", async () => {
    const replayResult = await replayFloors(
      workflowFixture.messages,
      structuredClone(workflowFixture.initialVariables),
      {
        startFloorId: "opening",
        endFloorId: "climb",
      },
    );

    expect(replayResult.success).toBe(true);
    expect(replayResult.variables.stat_data.status_bar.hp).toEqual([9, "生命值"]);
    expect(replayResult.variables.stat_data.status_bar.floor).toEqual([2, "当前楼层"]);
    expect(replayResult.variables.delta_data?.status_bar).toMatchObject({
      floor: "1->2 (stair climb)",
    });

    const templatedInventory = applyTemplate(
      ["rope"],
      [["empty-slot", "默认物品说明"]],
      { concatArray: true },
    );
    expect(templatedInventory).toEqual([
      "rope",
      ["empty-slot", "默认物品说明"],
    ]);

    const patchResult = applyPatch(
      replayResult.variables.stat_data,
      workflowFixture.patch,
    );
    expect(patchResult.success).toBe(true);
    expect(patchResult.document.status_bar.floor).toEqual([3, "当前楼层"]);
    expect(patchResult.document.status_bar.location).toEqual(["塔顶", "当前位置"]);

    const commands = patchToMvuCommands(workflowFixture.patch);
    expect(commands).toEqual([
      expect.objectContaining({
        type: "set",
        path: "status_bar.floor.0",
        reason: "json_patch",
        newValue: 3,
      }),
      expect.objectContaining({
        type: "insert",
        path: "status_bar",
        reason: "json_patch",
        newValue: ["塔顶", "当前位置"],
      }),
    ]);
  });
});
