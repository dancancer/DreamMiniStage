import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-qr-set-1",
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

describe("P3 quick-reply set/management command gaps", () => {
  it("/qr-set* 全局集合命令透传 visible 并显式校验布尔参数", async () => {
    const toggleGlobalQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const addGlobalQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const removeGlobalQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      toggleGlobalQuickReplySet,
      addGlobalQuickReplySet,
      removeGlobalQuickReplySet,
    });

    const toggle = await executeSlashCommandScript("/qr-set MainSet", ctx);
    const enable = await executeSlashCommandScript("/qr-set-on visible=false SideSet", ctx);
    const disable = await executeSlashCommandScript("/qr-set-off MainSet", ctx);
    const invalidVisible = await executeSlashCommandScript("/qr-set visible=maybe MainSet", ctx);

    expect(toggle.isError).toBe(false);
    expect(enable.isError).toBe(false);
    expect(disable.isError).toBe(false);
    expect(invalidVisible.isError).toBe(true);
    expect(invalidVisible.errorMessage).toContain("invalid visible value");
    expect(toggleGlobalQuickReplySet).toHaveBeenCalledWith("MainSet", { visible: true });
    expect(addGlobalQuickReplySet).toHaveBeenCalledWith("SideSet", { visible: false });
    expect(removeGlobalQuickReplySet).toHaveBeenCalledWith("MainSet");
  });

  it("/qr-chat-set* 与 /qr-set-list 支持 chat/global/all 集合语义", async () => {
    const toggleChatQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const addChatQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const removeChatQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const listQuickReplySets = vi
      .fn()
      .mockResolvedValueOnce(["MainSet", "SideSet"])
      .mockResolvedValueOnce([{ name: "ChatOnly" }]);
    const ctx = createContext({
      toggleChatQuickReplySet,
      addChatQuickReplySet,
      removeChatQuickReplySet,
      listQuickReplySets,
    });

    const toggle = await executeSlashCommandScript("/qr-chat-set ChatSet", ctx);
    const enable = await executeSlashCommandScript("/qr-chat-set-on visible=false ChatSet", ctx);
    const disable = await executeSlashCommandScript("/qr-chat-set-off ChatSet", ctx);
    const allSets = await executeSlashCommandScript("/qr-set-list", ctx);
    const globalSets = await executeSlashCommandScript("/qr-set-list source=global", ctx);

    expect(toggle.isError).toBe(false);
    expect(enable.isError).toBe(false);
    expect(disable.isError).toBe(false);
    expect(allSets.isError).toBe(false);
    expect(globalSets.isError).toBe(false);
    expect(allSets.pipe).toBe("[\"MainSet\",\"SideSet\"]");
    expect(globalSets.pipe).toBe("[\"ChatOnly\"]");
    expect(toggleChatQuickReplySet).toHaveBeenCalledWith("ChatSet", { visible: true });
    expect(addChatQuickReplySet).toHaveBeenCalledWith("ChatSet", { visible: false });
    expect(removeChatQuickReplySet).toHaveBeenCalledWith("ChatSet");
    expect(listQuickReplySets).toHaveBeenNthCalledWith(1, "all");
    expect(listQuickReplySets).toHaveBeenNthCalledWith(2, "global");
  });

  it("/qr-update 支持 id 优先级、布尔参数与消息透传", async () => {
    const updateQuickReply = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ updateQuickReply });

    const byLabel = await executeSlashCommandScript(
      "/qr-update set=MainSet label=Hello newlabel=Renamed showlabel=true hidden=false startup=true user=false bot=true load=false new=true group=false generation=true title=Tip automationId=auto-1 updated message",
      ctx,
    );
    const byId = await executeSlashCommandScript(
      "/qr-update set=MainSet label=Ignored id=5 icon=fa-star",
      ctx,
    );
    const invalid = await executeSlashCommandScript(
      "/qr-update set=MainSet label=Hello showlabel=maybe",
      ctx,
    );

    expect(byLabel.isError).toBe(false);
    expect(byId.isError).toBe(false);
    expect(invalid.isError).toBe(true);
    expect(invalid.errorMessage).toContain("invalid showlabel value");
    expect(updateQuickReply).toHaveBeenNthCalledWith(1, "MainSet", { label: "Hello" }, {
      icon: undefined,
      showLabel: true,
      title: "Tip",
      hidden: false,
      startup: true,
      user: false,
      bot: true,
      load: false,
      new: true,
      group: false,
      generation: true,
      automationId: "auto-1",
      newLabel: "Renamed",
      message: "updated message",
    });
    expect(updateQuickReply).toHaveBeenNthCalledWith(2, "MainSet", { id: 5 }, {
      icon: "fa-star",
      showLabel: undefined,
      title: undefined,
      hidden: undefined,
      startup: undefined,
      user: undefined,
      bot: undefined,
      load: undefined,
      new: undefined,
      group: undefined,
      generation: undefined,
      automationId: undefined,
      newLabel: undefined,
      message: undefined,
    });
  });

  it("/qr-context* 支持上下文菜单增删清与 id/label 双定位", async () => {
    const addQuickReplyContextSet = vi.fn().mockResolvedValue(undefined);
    const removeQuickReplyContextSet = vi.fn().mockResolvedValue(undefined);
    const clearQuickReplyContextSets = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      addQuickReplyContextSet,
      removeQuickReplyContextSet,
      clearQuickReplyContextSets,
    });

    const add = await executeSlashCommandScript(
      "/qr-contextadd set=MainSet label=Hello chain=true ContextSet",
      ctx,
    );
    const del = await executeSlashCommandScript(
      "/qr-contextdel set=MainSet id=7 ContextSet",
      ctx,
    );
    const clear = await executeSlashCommandScript("/qr-contextclear set=MainSet Hello", ctx);
    const invalid = await executeSlashCommandScript(
      "/qr-contextadd set=MainSet label=Hello chain=maybe ContextSet",
      ctx,
    );

    expect(add.isError).toBe(false);
    expect(del.isError).toBe(false);
    expect(clear.isError).toBe(false);
    expect(invalid.isError).toBe(true);
    expect(invalid.errorMessage).toContain("invalid chain value");
    expect(addQuickReplyContextSet).toHaveBeenCalledWith("MainSet", { label: "Hello" }, "ContextSet", {
      chain: true,
    });
    expect(removeQuickReplyContextSet).toHaveBeenCalledWith("MainSet", { id: 7 }, "ContextSet");
    expect(clearQuickReplyContextSets).toHaveBeenCalledWith("MainSet", { label: "Hello" });
  });

  it("/qr-set create/update/delete 与 preset 别名统一到单路径实现", async () => {
    const createQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const updateQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const deleteQuickReplySet = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({
      createQuickReplySet,
      updateQuickReplySet,
      deleteQuickReplySet,
    });

    const create = await executeSlashCommandScript(
      "/qr-set-create MainSet nosend=true before=false inject=true",
      ctx,
    );
    const aliasCreate = await executeSlashCommandScript("/qr-presetadd SideSet", ctx);
    const update = await executeSlashCommandScript("/qr-presetupdate MainSet before=true", ctx);
    const remove = await executeSlashCommandScript("/qr-presetdelete MainSet", ctx);

    expect(create.isError).toBe(false);
    expect(aliasCreate.isError).toBe(false);
    expect(update.isError).toBe(false);
    expect(remove.isError).toBe(false);
    expect(createQuickReplySet).toHaveBeenNthCalledWith(1, "MainSet", {
      nosend: true,
      before: false,
      inject: true,
    });
    expect(createQuickReplySet).toHaveBeenNthCalledWith(2, "SideSet", {
      nosend: false,
      before: false,
      inject: false,
    });
    expect(updateQuickReplySet).toHaveBeenCalledWith("MainSet", {
      nosend: undefined,
      before: true,
      inject: undefined,
    });
    expect(deleteQuickReplySet).toHaveBeenCalledWith("MainSet");
  });

  it("Quick Reply 管理命令在缺少参数或宿主时显式 fail-fast", async () => {
    const invalidSource = await executeSlashCommandScript(
      "/qr-set-list source=sidebar",
      createContext({ listQuickReplySets: vi.fn().mockResolvedValue([]) }),
    );
    const missingSet = await executeSlashCommandScript(
      "/qr-set-on",
      createContext({ addGlobalQuickReplySet: vi.fn().mockResolvedValue(undefined) }),
    );
    const missingLookup = await executeSlashCommandScript(
      "/qr-update set=MainSet",
      createContext({ updateQuickReply: vi.fn().mockResolvedValue(undefined) }),
    );
    const missingContext = await executeSlashCommandScript(
      "/qr-contextadd set=MainSet label=Hello",
      createContext({ addQuickReplyContextSet: vi.fn().mockResolvedValue(undefined) }),
    );
    const missingHost = await executeSlashCommandScript("/qr-set-delete MainSet", createContext());

    expect(invalidSource.isError).toBe(true);
    expect(missingSet.isError).toBe(true);
    expect(missingLookup.isError).toBe(true);
    expect(missingContext.isError).toBe(true);
    expect(missingHost.isError).toBe(true);
    expect(invalidSource.errorMessage).toContain("invalid source");
    expect(missingSet.errorMessage).toContain("requires quick reply set name");
    expect(missingLookup.errorMessage).toContain("requires quick reply label or id");
    expect(missingContext.errorMessage).toContain("requires context quick reply set name");
    expect(missingHost.errorMessage).toContain("not available");
  });
});
