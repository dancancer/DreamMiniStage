import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  ImportResultDisplay,
  type ImportResult,
} from "@/components/import-modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedDisplay {
  container: HTMLDivElement;
  root: Root;
}

function renderDisplay(result: ImportResult): RenderedDisplay {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ImportResultDisplay
        result={result}
        title="Import summary"
        importedLabel="Imported {count}"
        skippedLabel="Skipped {count}"
        errorsLabel="Errors"
        serifFontClass=""
      />,
    );
  });

  return { container, root };
}

function unmountDisplay(rendered: RenderedDisplay): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("ImportResultDisplay", () => {
  let rendered: RenderedDisplay | null = null;

  afterEach(() => {
    if (rendered) {
      unmountDisplay(rendered);
      rendered = null;
    }
  });

  it("renders structured semantics buckets from import results", () => {
    rendered = renderDisplay({
      success: true,
      message: "ok",
      importedCount: 1,
      skippedCount: 0,
      semantics: {
        retained: ["useProbability", "groupWeight"],
        ignored: ["legacyFlag"],
        downgraded: ["personaBindings"],
        manualReview: ["upstreamHook"],
        notes: ["Regex placement differs from upstream script hooks."],
      },
    });

    expect(rendered.container.textContent).toContain("Retained");
    expect(rendered.container.textContent).toContain("Ignored");
    expect(rendered.container.textContent).toContain("Downgraded");
    expect(rendered.container.textContent).toContain("Manual review");
    expect(rendered.container.textContent).toContain("useProbability");
    expect(rendered.container.textContent).toContain("legacyFlag");
    expect(rendered.container.textContent).toContain("personaBindings");
    expect(rendered.container.textContent).toContain("upstreamHook");
    expect(rendered.container.textContent).toContain(
      "Regex placement differs from upstream script hooks.",
    );
  });
});
