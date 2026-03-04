import { describe, expect, it } from "vitest";
import { parseKernelScript } from "../core/parser";

describe("parser flags — nested block escaping + macro replacement", () => {
  it("applies REPLACE_GETVAR inside nested strict blocks with quoted block delimiters", () => {
    const parsed = parseKernelScript(
      String.raw`/parser-flag REPLACE_GETVAR on|/parser-flag STRICT_ESCAPING on|/if outer {: /if inner {: /echo value="{{getvar::foo}} :} {{getglobalvar::bar}}"|/echo '{{getvar::foo}} {: {{getglobalvar::bar}}' :} :}|/echo tail`,
    );

    expect(parsed.isError).toBe(false);
    expect(parsed.script).toHaveLength(2);

    const outerIf = parsed.script[0];
    if (outerIf.type !== "if") throw new Error("expected outer if node");
    expect(outerIf.thenBlock).toHaveLength(1);

    const innerIf = outerIf.thenBlock[0];
    if (innerIf.type !== "if") throw new Error("expected inner if node");
    expect(innerIf.thenBlock).toHaveLength(2);

    const namedEcho = innerIf.thenBlock[0];
    if (namedEcho.type !== "command") throw new Error("expected named echo command");
    expect(namedEcho.parserFlags).toEqual({ STRICT_ESCAPING: true, REPLACE_GETVAR: true });
    expect(namedEcho.namedArgumentList).toEqual([
      expect.objectContaining({ name: "value", value: "{{var::foo}} :} {{globalvar::bar}}", wasQuoted: true }),
    ]);

    const unnamedEcho = innerIf.thenBlock[1];
    if (unnamedEcho.type !== "command") throw new Error("expected unnamed echo command");
    expect(unnamedEcho.unnamedArgumentList).toEqual([
      expect.objectContaining({ value: "{{var::foo}} {: {{globalvar::bar}}", wasQuoted: true }),
    ]);
  });

  it("fails fast on even-backslash escaped quote chain in nested strict block with REPLACE_GETVAR", () => {
    const parsed = parseKernelScript(
      String.raw`/parser-flag REPLACE_GETVAR on|/parser-flag STRICT_ESCAPING on|/if outer {: /if inner {: /echo value="{{getvar::foo}}\\"broken :} {{getglobalvar::bar}}" :} :}|/echo tail`,
    );

    expect(parsed.isError).toBe(true);
    expect(parsed.errorMessage).toContain("Unclosed quote under STRICT_ESCAPING");
  });
});
