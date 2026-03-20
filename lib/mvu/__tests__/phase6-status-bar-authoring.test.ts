import { describe, expect, it } from "vitest";

import fixture from "./fixtures/phase6/status-bar-authoring-workflow.json";
import { buildStatusBarEntries } from "@/lib/mvu/debugger/status-bar";

describe("phase6 status bar authoring baseline", () => {
  it("replays a committed author-facing fixture for status bar rendering semantics", () => {
    expect(buildStatusBarEntries(fixture.variables)).toEqual(fixture.expectedEntries);
  });
});
