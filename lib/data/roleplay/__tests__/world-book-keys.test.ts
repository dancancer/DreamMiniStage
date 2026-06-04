import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCharacterWorldBookRecordKey,
  createDialogueWorldBookRecordKey,
  createGlobalWorldBookRecordKey,
  createUniqueGlobalWorldBookRecordKey,
  createWorldBookSettingsRecordKey,
  isGlobalWorldBookRecordKey,
  isWorldBookSettingsRecordKey,
} from "@/lib/data/roleplay/world-book-keys";

describe("world-book-keys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates explicit scoped record keys", () => {
    expect(createCharacterWorldBookRecordKey("char-1")).toBe("character:char-1");
    expect(createDialogueWorldBookRecordKey("dlg-1")).toBe("dialogue:dlg-1");
    expect(createGlobalWorldBookRecordKey("shared-1")).toBe("global:shared-1");
  });

  it("rejects already-prefixed ids", () => {
    expect(() => createCharacterWorldBookRecordKey("character:char-1")).toThrow(
      "must not include a record prefix",
    );
  });

  it("derives settings keys only from content keys", () => {
    expect(createWorldBookSettingsRecordKey("global:shared-1")).toBe("global:shared-1_settings");
    expect(isWorldBookSettingsRecordKey("global:shared-1_settings")).toBe(true);
    expect(() => createWorldBookSettingsRecordKey("global:shared-1_settings")).toThrow(
      "settings key must be derived",
    );
  });

  it("recognizes only content records as global world books", () => {
    expect(isGlobalWorldBookRecordKey("global:shared-1")).toBe(true);
    expect(isGlobalWorldBookRecordKey("global:shared-1_settings")).toBe(false);
    expect(isGlobalWorldBookRecordKey("character:char-1")).toBe(false);
  });

  it("creates unique global keys from current time and random token", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(createUniqueGlobalWorldBookRecordKey()).toBe("global:123_i");
  });
});
