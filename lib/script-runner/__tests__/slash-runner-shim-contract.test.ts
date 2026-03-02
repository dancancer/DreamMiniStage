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
});
