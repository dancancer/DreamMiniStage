import { beforeEach, describe, expect, it } from "vitest";

import { resetMvuConfigStore, useMvuConfigStore } from "@/lib/store/mvu-config-store";

describe("mvu-config-store", () => {
  beforeEach(() => {
    resetMvuConfigStore();
  });

  it("defaults to text-delta and allows switching strategies explicitly", () => {
    expect(useMvuConfigStore.getState().strategy).toBe("text-delta");

    useMvuConfigStore.getState().setStrategy("function-calling");
    expect(useMvuConfigStore.getState().strategy).toBe("function-calling");

    useMvuConfigStore.getState().setStrategy("extra-model");
    expect(useMvuConfigStore.getState().strategy).toBe("extra-model");
  });
});
