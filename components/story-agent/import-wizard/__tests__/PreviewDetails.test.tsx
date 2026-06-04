import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  PreviewDetails,
  previewDetailLabels,
} from "../PreviewDetails";
import type { StoryAgentImportPreview } from "@/lib/story-agent/import";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPreview {
  container: HTMLDivElement;
  root: Root;
}

let rendered: RenderedPreview | null = null;

afterEach(() => {
  if (!rendered) return;
  act(() => rendered?.root.unmount());
  rendered.container.remove();
  rendered = null;
});

describe("PreviewDetails", () => {
  it("surfaces generated opening and feature-loss diagnostics", () => {
    rendered = renderPreview({
      blueprint: {
        profile: {
          openings: [{
            id: "opening:synthetic:neutral",
            content: "你在一片沉静中停下脚步。",
            sourceField: "story-agent.synthetic_opening",
          }],
        },
      },
      diagnostics: [
        {
          code: "character.instruction_only_opening",
          severity: "warning",
          message: "Character openings are instruction-only; Story Agent generated a neutral playable opening.",
          targetPath: "profile.openings",
          sourceField: "data.first_mes",
        },
        {
          code: "regex.ui_html_unsupported",
          severity: "warning",
          message: "Regex script emits HTML UI and must be converted to RenderIntent or marked unsupported.",
          targetPath: "regexScripts.1.raw.replaceString",
          sourceField: "replaceString",
        },
        {
          code: "render.status_contract_unsupported",
          severity: "warning",
          message: "Status-like source tag <status> contains JSON but has no compiled RenderIntent.",
          targetPath: "profile.promptFragments.character.description",
          sourceField: "data.description",
        },
      ],
    });

    const text = rendered.container.textContent ?? "";
    expect(text).toContain("First Opening Preview");
    expect(text).toContain("你在一片沉静中停下脚步。");
    expect(text).toContain("character.instruction_only_opening");
    expect(text).toContain("profile.openings");
    expect(text).toContain("data.first_mes");
    expect(text).toContain("regex.ui_html_unsupported");
    expect(text).toContain("render.status_contract_unsupported");
    expect(text).toContain("Showing 3/3");
  });
});

function renderPreview(preview: unknown): RenderedPreview {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <PreviewDetails
        preview={preview as StoryAgentImportPreview}
        copy={previewDetailLabels("en")}
      />,
    );
  });

  return { container, root };
}
