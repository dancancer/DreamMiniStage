import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MvuDebuggerPanel from "@/components/mvu/MvuDebuggerPanel";

const mvuRegistry = vi.hoisted(() => ({
  getCharacterVariables: vi.fn(),
  getCurrentMvuTrace: vi.fn(),
  getNodeVariables: vi.fn(),
  getNodeMvuTrace: vi.fn(),
}));

vi.mock("@/lib/mvu", () => ({
  getCharacterVariables: mvuRegistry.getCharacterVariables,
  getCurrentMvuTrace: mvuRegistry.getCurrentMvuTrace,
  getNodeVariables: mvuRegistry.getNodeVariables,
  getNodeMvuTrace: mvuRegistry.getNodeMvuTrace,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { React?: typeof React }).React = React;

interface RenderedPanel {
  container: HTMLDivElement;
  root: Root;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderPanel(): RenderedPanel {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MvuDebuggerPanel
        dialogueId="dlg-1"
        messages={[
          { id: "msg-1", role: "assistant", content: "opening" },
          { id: "msg-2", role: "assistant", content: "_.set('stats.hp', 9);" },
        ]}
      />,
    );
  });

  return { container, root };
}

function unmountPanel(rendered: RenderedPanel): void {
  act(() => {
    rendered.root.unmount();
  });
  rendered.container.remove();
}

describe("MvuDebuggerPanel", () => {
  beforeEach(() => {
    mvuRegistry.getCharacterVariables.mockReset();
    mvuRegistry.getCurrentMvuTrace.mockReset();
    mvuRegistry.getNodeVariables.mockReset();
    mvuRegistry.getNodeMvuTrace.mockReset();
  });

  it("loads current variables plus the selected message snapshot and exposes schema/delta previews", async () => {
    mvuRegistry.getCharacterVariables.mockResolvedValue({
      stat_data: {
        status_bar: {
          hp: [12, "生命值"],
          floor: [3, "当前楼层"],
        },
      },
      display_data: {
        status_bar: {
          hp: "9->12",
        },
      },
      delta_data: {
        status_bar: {
          hp: "9->12",
        },
      },
      schema: {
        type: "object",
        properties: {
          status_bar: {
            type: "object",
            properties: {
              hp: { type: "number", required: true },
              floor: { type: "number", required: true },
            },
          },
        },
      },
    });

    mvuRegistry.getCurrentMvuTrace.mockResolvedValue({
      selectedStrategy: "function-calling",
      appliedPath: "function-calling",
      applied: true,
      hasUpdateProtocol: true,
    });

    mvuRegistry.getNodeVariables.mockImplementation(async (_scope: { dialogueKey: string }, nodeId: string) => {
      if (nodeId === "msg-2") {
        return {
          stat_data: {
            status_bar: {
              hp: [9, "生命值"],
              floor: [3, "当前楼层"],
            },
          },
          display_data: {
            status_bar: {
              hp: "12->9",
            },
          },
          delta_data: {
            status_bar: {
              hp: "12->9",
            },
          },
          schema: {
            type: "object",
            properties: {
              status_bar: {
                type: "object",
                properties: {
                  hp: { type: "number", required: true },
                  floor: { type: "number", required: true },
                },
              },
            },
          },
        };
      }

      return {
        stat_data: {},
        display_data: {},
        delta_data: {},
      };
    });

    mvuRegistry.getNodeMvuTrace.mockImplementation(async (_scope: { dialogueKey: string }, nodeId: string) => {
      if (nodeId === "msg-2") {
        return {
          selectedStrategy: "function-calling",
          appliedPath: "function-calling",
          applied: true,
          hasUpdateProtocol: true,
        };
      }

      return {
        selectedStrategy: "text-delta",
        appliedPath: "none",
        applied: false,
        hasUpdateProtocol: false,
      };
    });

    const rendered = renderPanel();
    await flush();

    expect(rendered.container.textContent).toContain("MVU Debugger");
    expect(rendered.container.textContent).toContain("当前变量");
    expect(rendered.container.textContent).toContain("指定消息快照");
    expect(rendered.container.textContent).toContain("策略矩阵");
    expect(rendered.container.textContent).toContain("路径观测");
    expect(rendered.container.textContent).toContain("text-delta");
    expect(rendered.container.textContent).toContain("function-calling");
    expect(rendered.container.textContent).toContain("extra-model");
    expect(rendered.container.textContent).toContain("当前节点：function-calling");
    expect(rendered.container.textContent).toContain("已选策略：function-calling");
    expect(rendered.container.textContent).toContain("状态栏预览");
    expect(rendered.container.textContent).toContain("状态栏模板");
    expect(rendered.container.textContent).toContain("Schema");
    expect(rendered.container.textContent).toContain("Delta");
    expect(rendered.container.textContent).toContain("12->9");
    expect(rendered.container.textContent).toContain("\"hp\"");
    expect(rendered.container.textContent).toContain("生命值");
    expect(rendered.container.textContent).toContain("当前楼层");
    expect(rendered.container.textContent).toContain("生命值: 9->12");
    expect(mvuRegistry.getCharacterVariables).toHaveBeenCalledWith({ dialogueKey: "dlg-1" });
    expect(mvuRegistry.getCurrentMvuTrace).toHaveBeenCalledWith({ dialogueKey: "dlg-1" });
    expect(mvuRegistry.getNodeVariables).toHaveBeenCalledWith({ dialogueKey: "dlg-1" }, "msg-2");
    expect(mvuRegistry.getNodeMvuTrace).toHaveBeenCalledWith({ dialogueKey: "dlg-1" }, "msg-2");

    const firstMessageButton = rendered.container.querySelector<HTMLButtonElement>("[data-mvu-message-target='msg-1']");
    act(() => {
      firstMessageButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(mvuRegistry.getNodeVariables).toHaveBeenCalledWith({ dialogueKey: "dlg-1" }, "msg-1");
    expect(mvuRegistry.getNodeMvuTrace).toHaveBeenCalledWith({ dialogueKey: "dlg-1" }, "msg-1");
    unmountPanel(rendered);
  });
});
