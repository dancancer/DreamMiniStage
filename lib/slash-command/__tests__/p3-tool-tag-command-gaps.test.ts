import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext, SlashToolDefinition } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-tool-tag-1",
    messages: [
      { id: "m-0", role: "user", content: "hello" },
      { id: "m-1", role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

const TOOL_DEFINITIONS: SlashToolDefinition[] = [
  {
    name: "weather",
    description: "Read the weather",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
];

describe("P3 tool/tag command gaps", () => {
  it("/tools-list|/tool-list 输出 OpenAI 工具 JSON，并支持 return=pipe/none", async () => {
    const listTools = vi.fn().mockResolvedValue(TOOL_DEFINITIONS);
    const ctx = createContext({ listTools });

    const canonical = await executeSlashCommandScript("/tools-list", ctx);
    const alias = await executeSlashCommandScript("/tool-list return=pipe", ctx);
    const silent = await executeSlashCommandScript("/tool-list return=none", ctx);

    expect(canonical.isError).toBe(false);
    expect(alias.isError).toBe(false);
    expect(silent.isError).toBe(false);
    expect(JSON.parse(canonical.pipe)).toEqual([
      {
        type: "function",
        function: {
          name: "weather",
          description: "Read the weather",
          parameters: TOOL_DEFINITIONS[0].parameters,
        },
      },
    ]);
    expect(alias.pipe).toBe("weather");
    expect(silent.pipe).toBe("");
  });

  it("/tools-invoke|/tool-invoke 解析 JSON 参数并序列化结果", async () => {
    const invokeTool = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, city: "Shanghai" })
      .mockResolvedValueOnce("done");
    const ctx = createContext({ invokeTool });

    const canonical = await executeSlashCommandScript(
      "/tools-invoke weather parameters={\"city\":\"Shanghai\"}",
      ctx,
    );
    const alias = await executeSlashCommandScript(
      "/tool-invoke weather parameters={\"city\":\"Paris\"}",
      ctx,
    );

    expect(canonical).toMatchObject({ isError: false, pipe: "{\"ok\":true,\"city\":\"Shanghai\"}" });
    expect(alias).toMatchObject({ isError: false, pipe: "done" });
    expect(invokeTool).toHaveBeenNthCalledWith(1, "weather", { city: "Shanghai" });
    expect(invokeTool).toHaveBeenNthCalledWith(2, "weather", { city: "Paris" });
  });

  it("tool 命令在缺参、非法 JSON、宿主缺失或返回异常时显式 fail-fast", async () => {
    const listMissing = await executeSlashCommandScript("/tool-list", createContext());
    const listBadReturn = await executeSlashCommandScript(
      "/tool-list",
      createContext({ listTools: vi.fn().mockResolvedValue("oops") as unknown as ExecutionContext["listTools"] }),
    );
    const listBadMode = await executeSlashCommandScript(
      "/tool-list return=popup-html",
      createContext({ listTools: vi.fn().mockResolvedValue(TOOL_DEFINITIONS) }),
    );
    const invokeMissingHost = await executeSlashCommandScript("/tool-invoke weather parameters={}", createContext());
    const invokeMissingName = await executeSlashCommandScript(
      "/tool-invoke parameters={}",
      createContext({ invokeTool: vi.fn().mockResolvedValue("") }),
    );
    const invokeMissingParams = await executeSlashCommandScript(
      "/tool-invoke weather",
      createContext({ invokeTool: vi.fn().mockResolvedValue("") }),
    );
    const invokeBadParams = await executeSlashCommandScript(
      "/tool-invoke weather parameters=[]",
      createContext({ invokeTool: vi.fn().mockResolvedValue("") }),
    );

    expect(listMissing.isError).toBe(true);
    expect(listBadReturn.isError).toBe(true);
    expect(listBadMode.isError).toBe(true);
    expect(invokeMissingHost.isError).toBe(true);
    expect(invokeMissingName.isError).toBe(true);
    expect(invokeMissingParams.isError).toBe(true);
    expect(invokeBadParams.isError).toBe(true);
    expect(listMissing.errorMessage).toContain("not available");
    expect(listBadReturn.errorMessage).toContain("tool definitions");
    expect(listBadMode.errorMessage).toContain("invalid return type");
    expect(invokeMissingHost.errorMessage).toContain("not available");
    expect(invokeMissingName.errorMessage).toContain("requires tool name");
    expect(invokeMissingParams.errorMessage).toContain("requires parameters=<json>");
    expect(invokeBadParams.errorMessage).toContain("JSON object");
  });

  it("/tools-register|/tool-register 与 /tools-unregister|/tool-unregister 透传工具注册信息", async () => {
    const registerTool = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const unregisterTool = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const ctx = createContext({ registerTool, unregisterTool });

    const registered = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={\"type\":\"object\",\"properties\":{\"message\":{\"type\":\"string\"}},\"required\":[\"message\"]} {: /echo {{var::arg.message}} :}",
      ctx,
    );
    const aliasRegistered = await executeSlashCommandScript(
      "/tool-register name=noop description=Noop parameters={} {: /pass ok :}",
      ctx,
    );
    const removed = await executeSlashCommandScript("/tools-unregister echo", ctx);
    const aliasRemoved = await executeSlashCommandScript("/tool-unregister noop", ctx);

    expect(registered).toMatchObject({ isError: false, pipe: "true" });
    expect(aliasRegistered).toMatchObject({ isError: false, pipe: "false" });
    expect(removed).toMatchObject({ isError: false, pipe: "true" });
    expect(aliasRemoved).toMatchObject({ isError: false, pipe: "false" });
    expect(registerTool).toHaveBeenNthCalledWith(1, {
      name: "echo",
      description: "Echo",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      action: "/echo {{var::arg.message}}",
      displayName: undefined,
      formatMessage: undefined,
      shouldRegister: undefined,
      stealth: undefined,
    });
    expect(registerTool).toHaveBeenNthCalledWith(2, {
      name: "noop",
      description: "Noop",
      parameters: {
        type: "object",
        properties: {},
        required: undefined,
      },
      action: "/pass ok",
      displayName: undefined,
      formatMessage: undefined,
      shouldRegister: undefined,
      stealth: undefined,
    });
    expect(unregisterTool).toHaveBeenNthCalledWith(1, "echo");
    expect(unregisterTool).toHaveBeenNthCalledWith(2, "noop");
  });

  it("tool 注册命令在缺块、缺参、宿主缺失或返回异常时显式 fail-fast", async () => {
    const missingHost = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={} {: /echo ok :}",
      createContext(),
    );
    const missingName = await executeSlashCommandScript(
      "/tools-register description=Echo parameters={} {: /echo ok :}",
      createContext({ registerTool: vi.fn().mockResolvedValue(true) }),
    );
    const missingAction = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={}",
      createContext({ registerTool: vi.fn().mockResolvedValue(true) }),
    );
    const badSchema = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters=[] {: /echo ok :}",
      createContext({ registerTool: vi.fn().mockResolvedValue(true) }),
    );
    const badSchemaType = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={\"type\":\"array\"} {: /echo ok :}",
      createContext({ registerTool: vi.fn().mockResolvedValue(true) }),
    );
    const badBool = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={} shouldRegister=maybe {: /echo ok :}",
      createContext({ registerTool: vi.fn().mockResolvedValue(true) }),
    );
    const badReturn = await executeSlashCommandScript(
      "/tools-register name=echo description=Echo parameters={} {: /echo ok :}",
      createContext({ registerTool: vi.fn().mockResolvedValue("yes") as unknown as ExecutionContext["registerTool"] }),
    );
    const unregisterMissingHost = await executeSlashCommandScript("/tool-unregister echo", createContext());
    const unregisterMissingName = await executeSlashCommandScript(
      "/tool-unregister",
      createContext({ unregisterTool: vi.fn().mockResolvedValue(true) }),
    );
    const unregisterBadReturn = await executeSlashCommandScript(
      "/tool-unregister echo",
      createContext({ unregisterTool: vi.fn().mockResolvedValue("yes") as unknown as ExecutionContext["unregisterTool"] }),
    );

    expect(missingHost.isError).toBe(true);
    expect(missingName.isError).toBe(true);
    expect(missingAction.isError).toBe(true);
    expect(badSchema.isError).toBe(true);
    expect(badSchemaType.isError).toBe(true);
    expect(badBool.isError).toBe(true);
    expect(badReturn.isError).toBe(true);
    expect(unregisterMissingHost.isError).toBe(true);
    expect(unregisterMissingName.isError).toBe(true);
    expect(unregisterBadReturn.isError).toBe(true);
    expect(missingHost.errorMessage).toContain("not available");
    expect(missingName.errorMessage).toContain("requires name");
    expect(missingAction.errorMessage).toContain("requires closure block action");
    expect(badSchema.errorMessage).toContain("JSON object");
    expect(badSchemaType.errorMessage).toContain("parameters.type");
    expect(badBool.errorMessage).toContain("invalid shouldRegister");
    expect(badReturn.errorMessage).toContain("must return boolean");
    expect(unregisterMissingHost.errorMessage).toContain("not available");
    expect(unregisterMissingName.errorMessage).toContain("requires tool name");
    expect(unregisterBadReturn.errorMessage).toContain("must return boolean");
  });

  it("/tag-add|/tag-remove|/tag-exists|/tag-list 透传角色名并返回字符串结果", async () => {
    const addCharacterTag = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const removeCharacterTag = vi.fn().mockResolvedValue(true);
    const hasCharacterTag = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const listCharacterTags = vi.fn().mockResolvedValue(["OC", "edited, funny"]);
    const ctx = createContext({
      addCharacterTag,
      removeCharacterTag,
      hasCharacterTag,
      listCharacterTags,
    });

    const added = await executeSlashCommandScript("/tag-add name=Alice scenario", ctx);
    const duplicate = await executeSlashCommandScript("/tag-add name=Alice scenario", ctx);
    const exists = await executeSlashCommandScript("/tag-exists name=Alice scenario", ctx);
    const removed = await executeSlashCommandScript("/tag-remove name=Alice scenario", ctx);
    const listed = await executeSlashCommandScript("/tag-list name=Alice", ctx);
    const missing = await executeSlashCommandScript("/tag-exists name=Alice lore", ctx);

    expect(added).toMatchObject({ isError: false, pipe: "true" });
    expect(duplicate).toMatchObject({ isError: false, pipe: "false" });
    expect(exists).toMatchObject({ isError: false, pipe: "true" });
    expect(removed).toMatchObject({ isError: false, pipe: "true" });
    expect(listed).toMatchObject({ isError: false, pipe: "OC, edited, funny" });
    expect(missing).toMatchObject({ isError: false, pipe: "false" });
    expect(addCharacterTag).toHaveBeenNthCalledWith(1, "scenario", { name: "Alice" });
    expect(removeCharacterTag).toHaveBeenCalledWith("scenario", { name: "Alice" });
    expect(hasCharacterTag).toHaveBeenNthCalledWith(1, "scenario", { name: "Alice" });
    expect(hasCharacterTag).toHaveBeenNthCalledWith(2, "lore", { name: "Alice" });
    expect(listCharacterTags).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("tag 命令在缺参、宿主缺失或返回异常时显式 fail-fast", async () => {
    const missingHost = await executeSlashCommandScript("/tag-list", createContext());
    const missingTag = await executeSlashCommandScript(
      "/tag-add",
      createContext({ addCharacterTag: vi.fn().mockResolvedValue(true) }),
    );
    const badBool = await executeSlashCommandScript(
      "/tag-remove scenario",
      createContext({
        removeCharacterTag: vi.fn().mockResolvedValue("yes") as unknown as ExecutionContext["removeCharacterTag"],
      }),
    );
    const badList = await executeSlashCommandScript(
      "/tag-list",
      createContext({
        listCharacterTags: vi.fn().mockResolvedValue(["ok", 1]) as unknown as ExecutionContext["listCharacterTags"],
      }),
    );

    expect(missingHost.isError).toBe(true);
    expect(missingTag.isError).toBe(true);
    expect(badBool.isError).toBe(true);
    expect(badList.isError).toBe(true);
    expect(missingHost.errorMessage).toContain("not available");
    expect(missingTag.errorMessage).toContain("requires tag name");
    expect(badBool.errorMessage).toContain("must return boolean");
    expect(badList.errorMessage).toContain("must return string[]");
  });
});
