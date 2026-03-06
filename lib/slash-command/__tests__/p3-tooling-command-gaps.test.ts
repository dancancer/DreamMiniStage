import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  return {
    characterId: "char-tooling-1",
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

describe("P3 tooling command gaps", () => {
  it("/dupe 可调用宿主复制角色回调", async () => {
    const duplicateCharacter = vi.fn().mockResolvedValue("");
    const ctx = createContext({ duplicateCharacter });

    const result = await executeSlashCommandScript("/dupe", ctx);

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("");
    expect(duplicateCharacter).toHaveBeenCalledTimes(1);
  });

  it("/dupe 在宿主缺失时显式 fail-fast", async () => {
    const result = await executeSlashCommandScript("/dupe", createContext());

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("not available");
  });

  it("/newchat 默认 delete=false，并支持显式 delete=true", async () => {
    const createNewChat = vi.fn().mockResolvedValue(undefined);
    const ctx = createContext({ createNewChat });

    const defaultRun = await executeSlashCommandScript("/newchat", ctx);
    const deleteRun = await executeSlashCommandScript("/newchat delete=true", ctx);

    expect(defaultRun.isError).toBe(false);
    expect(deleteRun.isError).toBe(false);
    expect(defaultRun.pipe).toBe("");
    expect(deleteRun.pipe).toBe("");
    expect(createNewChat).toHaveBeenNthCalledWith(1, { deleteCurrentChat: false });
    expect(createNewChat).toHaveBeenNthCalledWith(2, { deleteCurrentChat: true });
  });

  it("/newchat 对非法 delete 参数显式 fail-fast", async () => {
    const result = await executeSlashCommandScript(
      "/newchat delete=maybe",
      createContext({ createNewChat: vi.fn().mockResolvedValue(undefined) }),
    );

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid delete value");
  });

  it("/length 作为 /len 语义别名返回字符串长度", async () => {
    const fromArg = await executeSlashCommandScript("/length hello", createContext());
    const fromPipe = await executeSlashCommandScript("/echo hello|/length", createContext());

    expect(fromArg.isError).toBe(false);
    expect(fromPipe.isError).toBe(false);
    expect(fromArg.pipe).toBe("5");
    expect(fromPipe.pipe).toBe("5");
  });

  it("/is-mobile 支持宿主回调并校验返回值", async () => {
    const ctx = createContext({ isMobileDevice: vi.fn().mockResolvedValue(true) });
    const ok = await executeSlashCommandScript("/is-mobile", ctx);
    const invalid = await executeSlashCommandScript(
      "/is-mobile",
      createContext({
        isMobileDevice: vi.fn().mockResolvedValue("yes") as unknown as NonNullable<ExecutionContext["isMobileDevice"]>,
      }),
    );

    expect(ok.isError).toBe(false);
    expect(ok.pipe).toBe("true");
    expect(invalid.isError).toBe(true);
    expect(invalid.errorMessage).toContain("non-boolean");
  });

  it("/popup 在 result=false 时返回原文，并透传参数到宿主", async () => {
    const showPopup = vi.fn().mockResolvedValue(0);
    const ctx = createContext({ showPopup });

    const result = await executeSlashCommandScript(
      "/popup scroll=false wide=true okButton=Yes cancelButton=No hello popup",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("hello popup");
    expect(showPopup).toHaveBeenCalledWith("hello popup", {
      header: undefined,
      scroll: false,
      large: false,
      wide: true,
      wider: false,
      transparent: false,
      okButton: "Yes",
      cancelButton: "No",
      result: false,
    });
  });

  it("/popup 在 result=true 时返回弹窗结果，取消返回空字符串", async () => {
    const showPopup = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce("");
    const ctx = createContext({ showPopup });

    const ok = await executeSlashCommandScript("/popup result=true confirm", ctx);
    const cancel = await executeSlashCommandScript("/popup result=true cancel", ctx);

    expect(ok.isError).toBe(false);
    expect(cancel.isError).toBe(false);
    expect(ok.pipe).toBe("1");
    expect(cancel.pipe).toBe("");
  });

  it("/popup 对非法布尔参数显式 fail-fast", async () => {
    const result = await executeSlashCommandScript(
      "/popup result=maybe hello",
      createContext({ showPopup: vi.fn().mockResolvedValue(1) }),
    );

    expect(result.isError).toBe(true);
    expect(result.errorMessage).toContain("invalid result value");
  });

  it("/pick-icon 返回图标名，取消时返回 false 字符串", async () => {
    const pickIcon = vi
      .fn()
      .mockResolvedValueOnce("fa-solid fa-user")
      .mockResolvedValueOnce(false);
    const ctx = createContext({ pickIcon });

    const selected = await executeSlashCommandScript("/pick-icon", ctx);
    const cancelled = await executeSlashCommandScript("/pick-icon", ctx);

    expect(selected.isError).toBe(false);
    expect(cancelled.isError).toBe(false);
    expect(selected.pipe).toBe("fa-solid fa-user");
    expect(cancelled.pipe).toBe("false");
  });

  it("/import 解析 from + as 映射并透传给宿主", async () => {
    const importVariables = vi.fn().mockResolvedValue(2);
    const ctx = createContext({ importVariables });

    const result = await executeSlashCommandScript(
      "/import from=MainSet.MainQR foo bar as baz",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.pipe).toBe("2");
    expect(importVariables).toHaveBeenCalledWith("MainSet.MainQR", [
      { source: "foo", target: "foo" },
      { source: "bar", target: "baz" },
    ]);
  });

  it("/import 在缺参或宿主缺失时显式 fail-fast", async () => {
    const missingFrom = await executeSlashCommandScript(
      "/import foo",
      createContext({ importVariables: vi.fn().mockResolvedValue(1) }),
    );
    const missingHost = await executeSlashCommandScript("/import from=MainSet.MainQR foo", createContext());

    expect(missingFrom.isError).toBe(true);
    expect(missingHost.isError).toBe(true);
    expect(missingFrom.errorMessage).toContain("requires from=<source>");
    expect(missingHost.errorMessage).toContain("not available");
  });
});
