/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        ToolCall 去重与优先级测试                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, expect, it } from "vitest";
import {
  ToolCallExecutor,
  createToolCallParser,
  extractToolCallsFromResponse,
} from "../tool-call-parser";

describe("ToolCallParser 去重与优先级", () => {
  it("同名同参时去重重复 tool_calls", () => {
    const parser = createToolCallParser();
    parser.processDelta({
      content: "",
      tool_calls: [
        {
          index: 0,
          id: "modern-1",
          type: "function",
          function: { name: "ping", arguments: "{\"x\":1}" },
        },
        {
          index: 1,
          id: "modern-2",
          type: "function",
          function: { name: "ping", arguments: "{\"x\":1}" },
        },
      ],
    });
    parser.markComplete();

    const result = parser.getResult();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].id).toBe("modern-1");
  });

  it("保留参数不同的 tool_calls", () => {
    const parser = createToolCallParser();
    parser.processDelta({
      content: "",
      tool_calls: [
        {
          index: 0,
          id: "modern-1",
          type: "function",
          function: { name: "ping", arguments: "{\"x\":1}" },
        },
        {
          index: 1,
          id: "modern-2",
          type: "function",
          function: { name: "ping", arguments: "{\"x\":2}" },
        },
      ],
    });
    parser.markComplete();

    const result = parser.getResult();
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].function.name).toBe("ping");
    expect(result.toolCalls[0].parsedArguments).toEqual({ x: 1 });
    expect(result.toolCalls[1].parsedArguments).toEqual({ x: 2 });
  });

  it("去重重复的 tool_call 项（同名+参数）", () => {
    const entries = extractToolCallsFromResponse({
      choices: [
        {
          message: {
            tool_calls: [
              { id: "a", type: "function", function: { name: "dup", arguments: "{\"k\":1}" } },
              { id: "b", type: "function", function: { name: "dup", arguments: "{\"k\":1}" } },
            ],
          },
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].function.name).toBe("dup");
  });

  it("执行器仅执行一次重复调用", async () => {
    const executor = new ToolCallExecutor();
    let called = 0;
    executor.registerTool({
      name: "echo",
      description: "echo",
      parameters: {},
      handler: async (args) => {
        called += 1;
        return args;
      },
    });

    const results = await executor.executeToolCalls([
      {
        id: "t1",
        index: 0,
        type: "function",
        function: { name: "echo", arguments: "{\"v\":1}" },
        status: "complete",
        parsedArguments: { v: 1 },
      },
      {
        id: "t2",
        index: 1,
        type: "function",
        function: { name: "echo", arguments: "{\"v\":1}" },
        status: "complete",
        parsedArguments: { v: 1 },
      },
    ]);

    expect(results).toHaveLength(1);
    expect(called).toBe(1);
  });
});
