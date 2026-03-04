import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SHIM_PATH = path.resolve(process.cwd(), "public/iframe-libs/slash-runner-shim.js");

function readShimSource(): string {
  return readFileSync(SHIM_PATH, "utf8");
}

describe("slash-runner shim contract", () => {
  it("exposes only namespace entry points", () => {
    const source = readShimSource();

    expect(source).toMatch(/window\.TavernHelper\s*=\s*\{/);
    expect(source).toMatch(/window\.SillyTavern\s*=\s*\{/);

    expect(source).not.toMatch(/window\.getChatMessages\s*=/);
    expect(source).not.toMatch(/window\.setChatMessages\s*=/);
    expect(source).not.toMatch(/window\.triggerSlash\s*=/);
    expect(source).not.toMatch(/window\.triggerSlashWithResult\s*=/);
    expect(source).not.toMatch(/window\.getVariables\s*=/);
    expect(source).not.toMatch(/window\.replaceVariables\s*=/);
    expect(source).not.toMatch(/window\.eventOn\s*=/);
    expect(source).not.toMatch(/window\.eventEmit\s*=/);
  });

  it("fails fast for unsupported group apis instead of silent fallback", () => {
    const source = readShimSource();

    expect(source).toMatch(/getGroupMembers:\s*unsupportedAsync\(\"getGroupMembers\"\)/);
    expect(source).toMatch(/isGroupChat:\s*unsupportedSync\(\"isGroupChat\"\)/);

    expect(source).not.toMatch(/createStub\(/);
    expect(source).not.toMatch(/createAsyncStub\(/);
    expect(source).not.toMatch(/warnUnimplemented\(/);
  });

  it("exposes lorebook/global long-tail compatibility aliases", () => {
    const source = readShimSource();

    expect(source).toMatch(/initializeGlobal:\s*function\(globalName,\s*value\)/);
    expect(source).toMatch(/waitGlobalInitialized:\s*function\(globalName\)/);
    expect(source).toMatch(/setLorebookSettings:\s*function\(settings\)/);
    expect(source).toMatch(/getLorebooks:\s*api\(\"getWorldbookNames\"\)/);
    expect(source).toMatch(/createLorebook:\s*function\(lorebookName\)/);
    expect(source).toMatch(/deleteLorebook:\s*function\(lorebookName\)/);
    expect(source).toMatch(/getCharLorebooks:\s*function\(options\)/);
    expect(source).toMatch(/setCurrentCharLorebooks:\s*function\(lorebooks\)/);
    expect(source).toMatch(/getCurrentCharPrimaryLorebook:\s*function\(\)/);
    expect(source).toMatch(/getChatLorebook:\s*function\(\)/);
    expect(source).toMatch(/setChatLorebook:\s*function\(lorebookName\)/);
    expect(source).toMatch(/getOrCreateChatLorebook:\s*function\(lorebookName\)/);
    expect(source).toMatch(/getWorldbook:\s*function\(worldbookName\)/);
    expect(source).toMatch(
      /only selected_global_lorebooks is supported in host mode/,
    );
  });

  it("exposes low-frequency compat APIs with deterministic semantics", () => {
    const source = readShimSource();

    expect(source).toMatch(/getCharData:\s*function\(name,\s*allowAvatar\)/);
    expect(source).toMatch(/getCharAvatarPath:\s*function\(name,\s*allowAvatar\)/);
    expect(source).toMatch(/getChatHistoryBrief:\s*function\(name,\s*allowAvatar\)/);
    expect(source).toMatch(/getChatHistoryDetail:\s*function\(data,\s*isGroupChat\)/);
    expect(source).toMatch(/Character:\s*RawCharacter/);
    expect(source).toMatch(/RawCharacter:\s*RawCharacter/);
    expect(source).toMatch(/function RawCharacter\(characterData\)/);
    expect(source).toMatch(/RawCharacter\.prototype\.getAvatarId/);
    expect(source).toMatch(/registerMacroLike:\s*function\(regex,\s*replaceFn\)/);
    expect(source).toMatch(/unregisterMacroLike:\s*function\(regex\)/);
    expect(source).toMatch(/injectPrompts:\s*unsupportedAsync\("injectPrompts"\)/);
    expect(source).toMatch(/uninjectPrompts:\s*unsupportedAsync\("uninjectPrompts"\)/);
    expect(source).toMatch(/replaceTavernRegexes:\s*api\("replaceTavernRegexes"\)/);
    expect(source).toMatch(/updateTavernRegexesWith:\s*function\(updater,\s*option\)/);
    expect(source).toMatch(/updateTavernRegexesWith 的 updater 必须返回数组/);
  });
});
