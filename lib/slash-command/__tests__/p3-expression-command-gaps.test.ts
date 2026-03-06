import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-expression-${contextSeed}`,
    messages: [
      { id: `m-${contextSeed}-0`, role: "user", content: "hello" },
      { id: `m-${contextSeed}-1`, role: "assistant", content: "world" },
    ],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    deleteVariable: vi.fn(),
    ...partial,
  };
}

describe("P3 expression command gaps", () => {
  it("/expression-set 与别名支持 type 透传", async () => {
    const setExpression = vi
      .fn()
      .mockResolvedValueOnce("joy")
      .mockResolvedValueOnce("calm");
    const ctx = createContext({ setExpression });

    const spriteSet = await executeSlashCommandScript("/expression-set type=sprite joy", ctx);
    const emoteSet = await executeSlashCommandScript("/emote calm", ctx);

    expect(spriteSet).toMatchObject({ isError: false, pipe: "joy" });
    expect(emoteSet).toMatchObject({ isError: false, pipe: "calm" });
    expect(setExpression).toHaveBeenNthCalledWith(1, "joy", { type: "sprite" });
    expect(setExpression).toHaveBeenNthCalledWith(2, "calm", { type: "expression" });
  });

  it("/expression-folder-override 与 /costume 支持目录覆盖与清空", async () => {
    const setExpressionFolderOverride = vi
      .fn()
      .mockResolvedValueOnce("party/look")
      .mockResolvedValueOnce("");
    const ctx = createContext({ setExpressionFolderOverride });

    const setFolder = await executeSlashCommandScript(
      "/expression-folder-override name=Alice party/look",
      ctx,
    );
    const clearFolder = await executeSlashCommandScript("/costume", ctx);

    expect(setFolder).toMatchObject({ isError: false, pipe: "party/look" });
    expect(clearFolder).toMatchObject({ isError: false, pipe: "" });
    expect(setExpressionFolderOverride).toHaveBeenNthCalledWith(1, "party/look", { name: "Alice" });
    expect(setExpressionFolderOverride).toHaveBeenNthCalledWith(2, "", { name: undefined });
  });

  it("/expression-last /expression-list /classify 支持查询与分类链路", async () => {
    const getLastExpression = vi.fn().mockResolvedValue("joy");
    const listExpressions = vi.fn().mockResolvedValue(["joy", "sad"]);
    const classifyExpression = vi.fn().mockResolvedValue("joy");
    const ctx = createContext({
      getLastExpression,
      listExpressions,
      classifyExpression,
    });

    const last = await executeSlashCommandScript("/expression-last Alice", ctx);
    const listed = await executeSlashCommandScript("/expression-list return=json filter=false", ctx);
    const classified = await executeSlashCommandScript(
      "/classify api=extras filter=true I am very happy today",
      ctx,
    );

    expect(last).toMatchObject({ isError: false, pipe: "joy" });
    expect(listed).toMatchObject({ isError: false, pipe: "[\"joy\",\"sad\"]" });
    expect(classified).toMatchObject({ isError: false, pipe: "joy" });
    expect(getLastExpression).toHaveBeenCalledWith("Alice");
    expect(listExpressions).toHaveBeenCalledWith({ filterAvailable: false });
    expect(classifyExpression).toHaveBeenCalledWith("I am very happy today", {
      api: "extras",
      prompt: undefined,
      filterAvailable: true,
    });
  });

  it("/expression-upload|/uploadsprite 支持 URL 上传参数透传", async () => {
    const uploadExpressionAsset = vi
      .fn()
      .mockResolvedValueOnce("joy")
      .mockResolvedValueOnce("idle_v2");
    const ctx = createContext({ uploadExpressionAsset });

    const canonical = await executeSlashCommandScript(
      "/expression-upload name=Alice label=joy folder=party spriteName=joy_v2 https://example.com/joy.png",
      ctx,
    );
    const alias = await executeSlashCommandScript(
      "/uploadsprite label=idle https://example.com/idle.png",
      ctx,
    );

    expect(canonical).toMatchObject({ isError: false, pipe: "joy" });
    expect(alias).toMatchObject({ isError: false, pipe: "idle_v2" });
    expect(uploadExpressionAsset).toHaveBeenNthCalledWith(1, "https://example.com/joy.png", {
      name: "Alice",
      label: "joy",
      folder: "party",
      spriteName: "joy_v2",
    });
    expect(uploadExpressionAsset).toHaveBeenNthCalledWith(2, "https://example.com/idle.png", {
      name: undefined,
      label: "idle",
      folder: undefined,
      spriteName: undefined,
    });
  });

  it("expression 命令簇在宿主缺失、参数非法、返回异常时显式 fail-fast", async () => {
    const noHostResult = await executeSlashCommandScript("/expression-list", createContext());
    expect(noHostResult.isError).toBe(true);
    expect(noHostResult.errorMessage).toContain("not available");

    const badTypeCtx = createContext({ setExpression: vi.fn().mockResolvedValue("joy") });
    const badType = await executeSlashCommandScript("/expression-set type=icon joy", badTypeCtx);
    const missingLabel = await executeSlashCommandScript("/expression-set", badTypeCtx);
    expect(badType.isError).toBe(true);
    expect(missingLabel.isError).toBe(true);
    expect(badType.errorMessage).toContain("invalid type");
    expect(missingLabel.errorMessage).toContain("requires expression label");

    const badListCtx = createContext({ listExpressions: vi.fn().mockResolvedValue(["joy"]) });
    const badFilter = await executeSlashCommandScript("/expression-list filter=maybe", badListCtx);
    const badReturnType = await executeSlashCommandScript("/expression-list return=xml", badListCtx);
    expect(badFilter.isError).toBe(true);
    expect(badReturnType.isError).toBe(true);
    expect(badFilter.errorMessage).toContain("invalid filter");
    expect(badReturnType.errorMessage).toContain("invalid return type");

    const badClassifyCtx = createContext({
      classifyExpression: vi.fn().mockResolvedValue(123 as unknown as string),
    });
    const missingText = await executeSlashCommandScript("/expression-classify", badClassifyCtx);
    const badClassifyReturn = await executeSlashCommandScript("/expression-classify hi", badClassifyCtx);
    expect(missingText.isError).toBe(true);
    expect(badClassifyReturn.isError).toBe(true);
    expect(missingText.errorMessage).toContain("requires text");
    expect(badClassifyReturn.errorMessage).toContain("must return a string");

    const badUploadCtx = createContext({
      uploadExpressionAsset: vi.fn().mockResolvedValue(42 as unknown as string),
    });
    const missingUploadHost = await executeSlashCommandScript(
      "/expression-upload label=joy https://example.com/a.png",
      createContext(),
    );
    const missingUploadLabel = await executeSlashCommandScript(
      "/expression-upload",
      badUploadCtx,
    );
    const missingUploadUrl = await executeSlashCommandScript(
      "/expression-upload label=joy",
      badUploadCtx,
    );
    const badUploadReturn = await executeSlashCommandScript(
      "/expression-upload label=joy https://example.com/a.png",
      badUploadCtx,
    );
    expect(missingUploadHost.isError).toBe(true);
    expect(missingUploadLabel.isError).toBe(true);
    expect(missingUploadUrl.isError).toBe(true);
    expect(badUploadReturn.isError).toBe(true);
    expect(missingUploadHost.errorMessage).toContain("not available");
    expect(missingUploadLabel.errorMessage).toContain("requires label");
    expect(missingUploadUrl.errorMessage).toContain("requires image url");
    expect(badUploadReturn.errorMessage).toContain("must return a string");
  });
});
