import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "dreamministage.vector-runtime-settings";

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

describe("vector runtime settings", () => {
  it("支持持久化 chats/files/query/maxEntries/threshold", async () => {
    const settings = await import("../settings");

    expect(settings.getVectorThresholdSetting()).toBe(0.25);
    expect(settings.getVectorQuerySetting()).toBe(2);
    expect(settings.getVectorMaxEntriesSetting()).toBe(5);
    expect(settings.getVectorChatsState()).toBe(false);
    expect(settings.getVectorFilesState()).toBe(false);

    expect(settings.setVectorThresholdSetting(0)).toBe(0);
    expect(settings.setVectorQuerySetting(4)).toBe(4);
    expect(settings.setVectorMaxEntriesSetting(8)).toBe(8);
    expect(settings.setVectorChatsState(true)).toBe(true);
    expect(settings.setVectorFilesState(true)).toBe(true);

    expect(settings.getVectorThresholdSetting()).toBe(0);
    expect(settings.getVectorQuerySetting()).toBe(4);
    expect(settings.getVectorMaxEntriesSetting()).toBe(8);
    expect(settings.getVectorChatsState()).toBe(true);
    expect(settings.getVectorFilesState()).toBe(true);
  });

  it("对损坏或越界配置回退到默认值", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabledChats: "bad",
      enabledFiles: true,
      query: 0,
      scoreThreshold: 9,
      maxEntries: -1,
    }));

    const settings = await import("../settings");

    expect(settings.getVectorChatsState()).toBe(false);
    expect(settings.getVectorFilesState()).toBe(true);
    expect(settings.getVectorQuerySetting()).toBe(2);
    expect(settings.getVectorThresholdSetting()).toBe(0.25);
    expect(settings.getVectorMaxEntriesSetting()).toBe(5);
  });
});
