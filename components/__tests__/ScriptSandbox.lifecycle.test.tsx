/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  ScriptSandbox 生命周期回归测试                             ║
 * ║                                                                           ║
 * ║  目标：确保 iframe 销毁/重建时，事件监听器使用内部 iframeId 正确清理          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ScriptSandbox } from "../ScriptSandbox";
import {
  clearIframeListeners,
  emitEvent,
  getListenerStats,
  registerListener,
} from "@/hooks/script-bridge/event-handlers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface RenderedSandbox {
  root: Root;
  container: HTMLDivElement;
  iframe: HTMLIFrameElement;
}

function renderSandbox(segmentId: string): RenderedSandbox {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  act(() => {
    root.render(
      <ScriptSandbox
        id={segmentId}
        html="<html><body><p>lifecycle test</p></body></html>"
      />,
    );
  });

  const iframe = container.querySelector("iframe");
  if (!(iframe instanceof HTMLIFrameElement)) {
    throw new Error("ScriptSandbox should render an iframe");
  }

  return { root, container, iframe };
}

function dispatchShimReady(iframe: HTMLIFrameElement, iframeId: string): void {
  if (!iframe.contentWindow) {
    throw new Error("iframe contentWindow is required for SHIM_READY");
  }

  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "SHIM_READY",
        payload: { iframeId },
      },
      source: iframe.contentWindow,
    }),
  );
}

function unmountSandbox(rendered: RenderedSandbox): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("ScriptSandbox lifecycle", () => {
  it("allows modal apis inside the sandbox iframe", () => {
    const rendered = renderSandbox("segment_modal_permissions");

    expect(rendered.iframe.getAttribute("sandbox")).toContain("allow-modals");

    unmountSandbox(rendered);
  });

  it("keeps legacy global triggerSlash calls intact for shim compatibility", () => {
    const rendered = renderSandbox(
      "segment_legacy_trigger_slash",
    );

    act(() => {
      rendered.root.render(
        <ScriptSandbox
          id="segment_legacy_trigger_slash"
          html={`<html><body><script>
            if (typeof triggerSlash === "function") {
              triggerSlash('/send hello|/trigger');
            }
          </script></body></html>`}
        />,
      );
    });

    const srcdoc = rendered.iframe.getAttribute("srcdoc") || "";

    expect(srcdoc).toContain("typeof triggerSlash === \"function\"");
    expect(srcdoc).toContain("triggerSlash('/send hello|/trigger')");

    unmountSandbox(rendered);
  });

  it("preserves locally declared legacy api helpers", () => {
    const rendered = renderSandbox("segment_legacy_message_api");

    act(() => {
      rendered.root.render(
        <ScriptSandbox
          id="segment_legacy_message_api"
          html={`<html><body><script>
            function triggerSlash(command) {
              return command;
            }
            triggerSlash('/send hello');
          </script></body></html>`}
        />,
      );
    });

    const srcdoc = rendered.iframe.getAttribute("srcdoc") || "";

    expect(srcdoc).toContain("function triggerSlash(command)");
    expect(srcdoc).toContain("triggerSlash('/send hello');");
    expect(srcdoc).not.toContain("function (window.TavernHelper?.triggerSlash");

    unmountSandbox(rendered);
  });

  it("clears character switch listeners by internal iframe id on unmount", () => {
    const internalIframeId = "iframe_lifecycle_internal_cleanup";
    const segmentId = "segment_lifecycle_cleanup";

    const rendered = renderSandbox(segmentId);
    dispatchShimReady(rendered.iframe, internalIframeId);

    registerListener(
      internalIframeId,
      "character:switch_completed",
      "handler_cleanup",
      false,
    );
    expect(getListenerStats(internalIframeId)).toMatchObject({
      "character:switch_completed": 1,
    });

    unmountSandbox(rendered);

    expect(getListenerStats(internalIframeId)).toEqual({});

    clearIframeListeners(internalIframeId);
  });

  it("does not keep stale listeners after iframe remount", () => {
    const eventType = "character:switch_completed";
    const firstIframeId = "iframe_lifecycle_first_mount";
    const secondIframeId = "iframe_lifecycle_second_mount";

    const first = renderSandbox("segment_lifecycle_first");
    dispatchShimReady(first.iframe, firstIframeId);
    registerListener(firstIframeId, eventType, "handler_old", false);
    unmountSandbox(first);

    expect(emitEvent(eventType, { from: "first" })).toEqual([]);

    const second = renderSandbox("segment_lifecycle_second");
    dispatchShimReady(second.iframe, secondIframeId);
    registerListener(secondIframeId, eventType, "handler_new", false);

    expect(emitEvent(eventType, { from: "second" })).toEqual(["handler_new"]);

    unmountSandbox(second);

    clearIframeListeners(firstIframeId);
    clearIframeListeners(secondIframeId);
  });
});
