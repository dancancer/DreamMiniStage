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

    expect(source).toMatch(/builtin:\s*\{/);
    expect(source).toMatch(/addOneMessage:\s*function\(mes\)/);
    expect(source).toMatch(/parseRegexFromString:\s*parseRegexFromString/);
    expect(source).toMatch(/renderMarkdown:\s*renderMarkdownFallback/);
    expect(source).toMatch(/uuidv4:\s*createUuidLike/);
    expect(source).toMatch(/iframe_events:\s*IFRAME_EVENTS/);
    expect(source).toMatch(/tavern_events:\s*TAVERN_EVENTS/);
    expect(source).toMatch(/builtin_prompt_default_order:\s*BUILTIN_PROMPT_DEFAULT_ORDER/);
    expect(source).toMatch(/setChatMessage:\s*api\("setChatMessage"\)/);
    expect(source).toMatch(/rotateChatMessages:\s*api\("rotateChatMessages"\)/);

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
    expect(source).toMatch(/injectPrompts:\s*function\(prompts,\s*options\)/);
    expect(source).toMatch(/return callApi\("injectPrompts", \[prompts, options\]\)/);
    expect(source).toMatch(/uninjectPrompts:\s*function\(ids\)/);
    expect(source).toMatch(/return callApi\("uninjectPrompts", \[ids\]\)/);
    expect(source).toMatch(/getCurrentCharacterName:\s*api\("getCurrentCharacterName"\)/);
    expect(source).toMatch(/createCharacter:\s*api\("createCharacter"\)/);
    expect(source).toMatch(/createOrReplaceCharacter:\s*function\(characterName,\s*character,\s*options\)/);
    expect(source).toMatch(/deleteCharacter:\s*api\("deleteCharacter"\)/);
    expect(source).toMatch(/replaceCharacter:\s*api\("replaceCharacter"\)/);
    expect(source).toMatch(/updateCharacterWith:\s*function\(characterName,\s*updater,\s*options\)/);
    expect(source).toMatch(/refreshOneMessage:\s*api\("refreshOneMessage"\)/);
    expect(source).toMatch(/replaceTavernRegexes:\s*api\("replaceTavernRegexes"\)/);
    expect(source).toMatch(/updateTavernRegexesWith:\s*function\(updater,\s*option\)/);
    expect(source).toMatch(/updateTavernRegexesWith 的 updater 必须返回数组/);
    expect(source).toMatch(/getScriptTrees:\s*api\("getScriptTrees"\)/);
    expect(source).toMatch(/replaceScriptTrees:\s*api\("replaceScriptTrees"\)/);
    expect(source).toMatch(/updateScriptTreesWith:\s*function\(updater,\s*option\)/);
    expect(source).toMatch(/updateScriptTreesWith 的 updater 必须返回数组/);
  });

  it("exposes _bind/_th_impl and deprecated audio helper aliases", () => {
    const source = readShimSource();

    expect(source).toMatch(/_th_impl:\s*\{/);
    expect(source).toMatch(/writeExtensionField:\s*unsupportedAsync\("writeExtensionField"\)/);
    expect(source).toMatch(/_bind:\s*\{/);
    expect(source).toMatch(/_initializeGlobal:\s*function\(globalName,\s*value\)/);
    expect(source).toMatch(/_waitGlobalInitialized:\s*function\(globalName\)/);
    expect(source).toMatch(/_registerMacroLike:\s*function\(regex,\s*replaceFn\)/);
    expect(source).toMatch(/_reloadIframe:\s*function\(\)/);
    expect(source).toMatch(/_getIframeName:\s*function\(\)/);
    expect(source).toMatch(/_getScriptId:\s*function\(\)/);
    expect(source).toMatch(/_getCurrentMessageId:\s*function\(\)/);

    expect(source).toMatch(/audioEnable:\s*function\(args\)/);
    expect(source).toMatch(/audioImport:\s*function\(args,\s*url\)/);
    expect(source).toMatch(/audioMode:\s*function\(args\)/);
    expect(source).toMatch(/audioPlay:\s*function\(args\)/);
    expect(source).toMatch(/audioSelect:\s*function\(args,\s*url\)/);
  });

  it("exposes preset helper constants and prompt type guards", () => {
    const source = readShimSource();

    expect(source).toMatch(/isPresetNormalPrompt:\s*isPresetNormalPrompt/);
    expect(source).toMatch(/isPresetSystemPrompt:\s*isPresetSystemPrompt/);
    expect(source).toMatch(/isPresetPlaceholderPrompt:\s*isPresetPlaceholderPrompt/);
    expect(source).toMatch(/default_preset:\s*defaultPreset/);
    expect(source).toMatch(/var DEFAULT_PRESET_TEMPLATE = \{/);
    expect(source).toMatch(/function isPresetNormalPrompt\(prompt\)/);
    expect(source).toMatch(/function isPresetSystemPrompt\(prompt\)/);
    expect(source).toMatch(/function isPresetPlaceholderPrompt\(prompt\)/);
  });
});
