import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-qr-1",
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

describe("P3 reasoning/quick-reply command gaps", () => {
  it("/reasoning-parse 与 /parse-reasoning 支持 strict/return 语义", async () => {
    const ctx = createContext();

    const parseReasoning = await executeSlashCommandScript(
      "/reasoning-parse <thinking>步骤一</thinking> 输出",
      ctx,
    );
    const parseContent = await executeSlashCommandScript(
      "/parse-reasoning return=content <thinking>步骤一</thinking> 输出",
      ctx,
    );
    const nonStrict = await executeSlashCommandScript(
      "/parse-reasoning strict=false 前缀 <think>中段</think> 后缀",
      ctx,
    );

    expect(parseReasoning.isError).toBe(false);
    expect(parseContent.isError).toBe(false);
    expect(nonStrict.isError).toBe(false);
    expect(parseReasoning.pipe).toBe("步骤一");
    expect(parseContent.pipe).toBe("输出");
    expect(nonStrict.pipe).toBe("中段");
  });

  it("/parse-reasoning 在 strict 模式未命中时返回空字符串或原文", async () => {
    const ctx = createContext();

    const reasoningMiss = await executeSlashCommandScript(
      "/parse-reasoning 前缀 <thinking>abc</thinking>",
      ctx,
    );
    const contentMiss = await executeSlashCommandScript(
      "/parse-reasoning return=content 前缀 <thinking>abc</thinking>",
      ctx,
    );

    expect(reasoningMiss.isError).toBe(false);
    expect(contentMiss.isError).toBe(false);
    expect(reasoningMiss.pipe).toBe("");
    expect(contentMiss.pipe).toBe("前缀 <thinking>abc</thinking>");
  });

  it("/parse-reasoning 支持 host parse/regex 回调覆盖", async () => {
    const parseReasoningBlock = vi.fn().mockResolvedValue({
      reasoning: "host-think",
      content: "host-content",
    });
    const applyReasoningRegex = vi.fn().mockResolvedValue("regexed-host-think");
    const ctx = createContext({
      parseReasoningBlock,
      applyReasoningRegex,
    });

    const withRegex = await executeSlashCommandScript(
      "/parse-reasoning strict=false regex=true source-text",
      ctx,
    );
    const noRegex = await executeSlashCommandScript(
      "/parse-reasoning regex=false source-text",
      ctx,
    );
    const contentMode = await executeSlashCommandScript(
      "/parse-reasoning return=content source-text",
      ctx,
    );

    expect(withRegex.isError).toBe(false);
    expect(noRegex.isError).toBe(false);
    expect(contentMode.isError).toBe(false);
    expect(withRegex.pipe).toBe("regexed-host-think");
    expect(noRegex.pipe).toBe("host-think");
    expect(contentMode.pipe).toBe("host-content");
    expect(parseReasoningBlock).toHaveBeenNthCalledWith(1, "source-text", { strict: false });
    expect(parseReasoningBlock).toHaveBeenNthCalledWith(2, "source-text", { strict: true });
    expect(parseReasoningBlock).toHaveBeenNthCalledWith(3, "source-text", { strict: true });
    expect(applyReasoningRegex).toHaveBeenCalledTimes(1);
    expect(applyReasoningRegex).toHaveBeenCalledWith("host-think");
  });

  it("/parse-reasoning 对非法选项与 host 返回值显式 fail-fast", async () => {
    const invalidReturn = await executeSlashCommandScript("/parse-reasoning return=all abc", createContext());
    const invalidRegex = await executeSlashCommandScript("/parse-reasoning regex=maybe abc", createContext());
    const invalidHostPayload = await executeSlashCommandScript(
      "/parse-reasoning abc",
      createContext({
        parseReasoningBlock: vi.fn().mockResolvedValue({
          reasoning: 1,
          content: "ok",
        } as unknown as { reasoning: string; content: string }),
      }),
    );

    expect(invalidReturn.isError).toBe(true);
    expect(invalidRegex.isError).toBe(true);
    expect(invalidHostPayload.isError).toBe(true);
    expect(invalidReturn.errorMessage).toContain("invalid return value");
    expect(invalidRegex.errorMessage).toContain("invalid regex value");
    expect(invalidHostPayload.errorMessage).toContain("invalid reasoning parse payload");
  });

  it("/qr 可执行指定索引并返回宿主结果", async () => {
    const executeQuickReplyByIndex = vi.fn().mockResolvedValue("ok");
    const ctx = createContext({ executeQuickReplyByIndex });

    const result = await executeSlashCommandScript("/qr 2", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("ok");
    expect(executeQuickReplyByIndex).toHaveBeenCalledWith(2);
  });

  it("/qr-list 返回指定 set 的标签列表 JSON", async () => {
    const listQuickReplies = vi
      .fn()
      .mockResolvedValueOnce(["One", "Two"])
      .mockResolvedValueOnce([{ label: "Three" }]);
    const ctx = createContext({ listQuickReplies });

    const plain = await executeSlashCommandScript("/qr-list MainSet", ctx);
    const objectList = await executeSlashCommandScript("/qr-list set=SideSet", ctx);

    expect(plain.isError).toBe(false);
    expect(objectList.isError).toBe(false);
    expect(plain.pipe).toBe("[\"One\",\"Two\"]");
    expect(objectList.pipe).toBe("[\"Three\"]");
    expect(listQuickReplies).toHaveBeenNthCalledWith(1, "MainSet");
    expect(listQuickReplies).toHaveBeenNthCalledWith(2, "SideSet");
  });

  it("/qr-get 支持 label/id 查询并返回 JSON", async () => {
    const getQuickReply = vi
      .fn()
      .mockResolvedValueOnce({ label: "Hello", message: "/echo hi" })
      .mockResolvedValueOnce({ label: "ById", message: "/echo id" })
      .mockResolvedValueOnce(undefined);
    const ctx = createContext({ getQuickReply });

    const byLabel = await executeSlashCommandScript("/qr-get set=MainSet label=Hello", ctx);
    const byId = await executeSlashCommandScript("/qr-get MainSet id=3", ctx);
    const miss = await executeSlashCommandScript("/qr-get set=MainSet label=Missing", ctx);

    expect(byLabel.isError).toBe(false);
    expect(byId.isError).toBe(false);
    expect(miss.isError).toBe(false);
    expect(byLabel.pipe).toBe("{\"label\":\"Hello\",\"message\":\"/echo hi\"}");
    expect(byId.pipe).toBe("{\"label\":\"ById\",\"message\":\"/echo id\"}");
    expect(miss.pipe).toBe("");
    expect(getQuickReply).toHaveBeenNthCalledWith(1, "MainSet", { label: "Hello" });
    expect(getQuickReply).toHaveBeenNthCalledWith(2, "MainSet", { id: 3 });
    expect(getQuickReply).toHaveBeenNthCalledWith(3, "MainSet", { label: "Missing" });
  });

  it("/qr-create 支持参数透传与布尔校验", async () => {
    const createQuickReply = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ createQuickReply });

    const ok = await executeSlashCommandScript(
      "/qr-create set=MainSet label=Hello showlabel=true hidden=false startup=true user=true bot=false load=true new=false group=true generation=false title=Hi automationId=auto-1 hello world",
      ctx,
    );
    const invalid = await executeSlashCommandScript(
      "/qr-create set=MainSet label=Hello showlabel=maybe hello",
      ctx,
    );

    expect(ok.isError).toBe(false);
    expect(ok.pipe).toBe("");
    expect(invalid.isError).toBe(true);
    expect(invalid.errorMessage).toContain("invalid showlabel value");
    expect(createQuickReply).toHaveBeenCalledWith("MainSet", "Hello", "hello world", {
      icon: undefined,
      showLabel: true,
      title: "Hi",
      hidden: false,
      startup: true,
      user: true,
      bot: false,
      load: true,
      new: false,
      group: true,
      generation: false,
      automationId: "auto-1",
    });
  });

  it("/qr-delete 支持 label/id 删除，缺少回调时 fail-fast", async () => {
    const deleteQuickReply = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ deleteQuickReply });

    const byLabel = await executeSlashCommandScript("/qr-delete MainSet Hello", ctx);
    const byId = await executeSlashCommandScript("/qr-delete set=MainSet id=7", ctx);
    const missingHost = await executeSlashCommandScript("/qr-delete set=MainSet label=Hello", createContext());

    expect(byLabel.isError).toBe(false);
    expect(byId.isError).toBe(false);
    expect(missingHost.isError).toBe(true);
    expect(byLabel.pipe).toBe("");
    expect(byId.pipe).toBe("");
    expect(missingHost.errorMessage).toContain("not available");
    expect(deleteQuickReply).toHaveBeenNthCalledWith(1, "MainSet", { label: "Hello" });
    expect(deleteQuickReply).toHaveBeenNthCalledWith(2, "MainSet", { id: 7 });
  });

  it("/qr* 命令在参数缺失或格式错误时显式 fail-fast", async () => {
    const missingSet = await executeSlashCommandScript(
      "/qr-list",
      createContext({ listQuickReplies: vi.fn().mockResolvedValue([]) }),
    );
    const missingLookup = await executeSlashCommandScript(
      "/qr-get set=MainSet",
      createContext({ getQuickReply: vi.fn().mockResolvedValue(undefined) }),
    );
    const invalidIndex = await executeSlashCommandScript(
      "/qr nope",
      createContext({ executeQuickReplyByIndex: vi.fn().mockResolvedValue("") }),
    );

    expect(missingSet.isError).toBe(true);
    expect(missingLookup.isError).toBe(true);
    expect(invalidIndex.isError).toBe(true);
    expect(missingSet.errorMessage).toContain("requires quick reply set name");
    expect(missingLookup.errorMessage).toContain("requires quick reply label or id");
    expect(invalidIndex.errorMessage).toContain("invalid quick reply index");
  });
});
