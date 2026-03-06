import { describe, expect, it, vi } from "vitest";

import { executeSlashCommandScript } from "../executor";
import type { ExecutionContext } from "../types";

let contextSeed = 0;

function createContext(partial?: Partial<ExecutionContext>): ExecutionContext {
  contextSeed += 1;

  return {
    characterId: `char-image-instruct-${contextSeed}`,
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

describe("P3 image/instruct command gaps", () => {
  it("/imagine 与 /image|/img 别名透传参数并返回 url", async () => {
    const generateImage = vi
      .fn()
      .mockResolvedValueOnce("https://img.example/1.png")
      .mockResolvedValueOnce("https://img.example/2.png")
      .mockResolvedValueOnce("https://img.example/3.png")
      .mockResolvedValueOnce("https://img.example/4.png");
    const ctx = createContext({ generateImage });

    const imagine = await executeSlashCommandScript(
      "/imagine quiet=true width=1024 height=768 cfg=7.5 hires=on 2ndpass=14 sunset city",
      ctx,
    );
    const imageAlias = await executeSlashCommandScript("/image portrait", ctx);
    const imgAlias = await executeSlashCommandScript("/echo rainy alley | /img", ctx);
    const sdAlias = await executeSlashCommandScript("/sd monochrome skyline", ctx);

    expect(imagine).toMatchObject({ isError: false, pipe: "https://img.example/1.png" });
    expect(imageAlias).toMatchObject({ isError: false, pipe: "https://img.example/2.png" });
    expect(imgAlias).toMatchObject({ isError: false, pipe: "https://img.example/3.png" });
    expect(sdAlias).toMatchObject({ isError: false, pipe: "https://img.example/4.png" });

    expect(generateImage).toHaveBeenNthCalledWith(1, "sunset city", {
      quiet: true,
      negative: undefined,
      extend: undefined,
      edit: undefined,
      multimodal: undefined,
      snap: undefined,
      processing: undefined,
      seed: undefined,
      width: 1024,
      height: 768,
      steps: undefined,
      cfg: 7.5,
      skip: undefined,
      model: undefined,
      sampler: undefined,
      scheduler: undefined,
      vae: undefined,
      upscaler: undefined,
      hires: true,
      scale: undefined,
      denoise: undefined,
      secondPassSteps: 14,
      faces: undefined,
    });
    expect(generateImage).toHaveBeenNthCalledWith(2, "portrait", expect.any(Object));
    expect(generateImage).toHaveBeenNthCalledWith(3, "rainy alley", expect.any(Object));
    expect(generateImage).toHaveBeenNthCalledWith(4, "monochrome skyline", expect.any(Object));
  });

  it("/imagine-source|/img-source /imagine-style|/img-style /imagine-comfy-workflow|/icw 支持读写", async () => {
    const getImageGenerationConfig = vi
      .fn()
      .mockResolvedValueOnce({ source: "auto", style: "cinematic", comfyWorkflow: "wf-a" })
      .mockResolvedValueOnce({ source: "comfy", style: "anime", comfyWorkflow: "wf-b" });
    const setImageGenerationConfig = vi
      .fn()
      .mockResolvedValueOnce({ source: "comfy", style: "cinematic", comfyWorkflow: "wf-a" })
      .mockResolvedValueOnce({ source: "comfy", style: "anime", comfyWorkflow: "wf-a" })
      .mockResolvedValueOnce({ source: "comfy", style: "anime", comfyWorkflow: "wf-b" });

    const ctx = createContext({ getImageGenerationConfig, setImageGenerationConfig });

    const currentSource = await executeSlashCommandScript("/imagine-source", ctx);
    const switchedSource = await executeSlashCommandScript("/img-source comfy", ctx);
    const switchedStyle = await executeSlashCommandScript("/img-style anime", ctx);
    const sdSourceAlias = await executeSlashCommandScript("/sd-source sd-next", createContext({
      setImageGenerationConfig: vi.fn().mockResolvedValue({
        source: "sd-next",
        style: "anime",
        comfyWorkflow: "wf-a",
      }),
    }));
    const sdStyleAlias = await executeSlashCommandScript("/sd-style noir", createContext({
      setImageGenerationConfig: vi.fn().mockResolvedValue({
        source: "auto",
        style: "noir",
        comfyWorkflow: "wf-a",
      }),
    }));
    const switchedWorkflow = await executeSlashCommandScript(
      "/imagine-comfy-workflow wf-b",
      ctx,
    );
    const aliasWorkflow = await executeSlashCommandScript("/icw wf-c", createContext({
      setImageGenerationConfig: vi.fn().mockResolvedValue({
        source: "comfy",
        style: "anime",
        comfyWorkflow: "wf-c",
      }),
    }));
    const currentStyle = await executeSlashCommandScript("/imagine-style", ctx);

    expect(currentSource).toMatchObject({ isError: false, pipe: "auto" });
    expect(switchedSource).toMatchObject({ isError: false, pipe: "comfy" });
    expect(switchedStyle).toMatchObject({ isError: false, pipe: "anime" });
    expect(sdSourceAlias).toMatchObject({ isError: false, pipe: "sd-next" });
    expect(sdStyleAlias).toMatchObject({ isError: false, pipe: "noir" });
    expect(switchedWorkflow).toMatchObject({ isError: false, pipe: "wf-b" });
    expect(aliasWorkflow).toMatchObject({ isError: false, pipe: "wf-c" });
    expect(currentStyle).toMatchObject({ isError: false, pipe: "anime" });

    expect(setImageGenerationConfig).toHaveBeenNthCalledWith(1, { source: "comfy" });
    expect(setImageGenerationConfig).toHaveBeenNthCalledWith(2, { style: "anime" });
    expect(setImageGenerationConfig).toHaveBeenNthCalledWith(3, { comfyWorkflow: "wf-b" });
  });

  it("image 命令在宿主缺失、参数非法、返回异常时显式 fail-fast", async () => {
    const missingImagine = await executeSlashCommandScript("/imagine draw cat", createContext());
    const missingSource = await executeSlashCommandScript("/imagine-source", createContext());
    const missingWorkflowArg = await executeSlashCommandScript(
      "/imagine-comfy-workflow",
      createContext({
        setImageGenerationConfig: vi.fn(),
      }),
    );

    const invalidBool = await executeSlashCommandScript(
      "/imagine quiet=maybe draw cat",
      createContext({ generateImage: vi.fn().mockResolvedValue("ok") }),
    );
    const invalidNumber = await executeSlashCommandScript(
      "/imagine width=abc draw cat",
      createContext({ generateImage: vi.fn().mockResolvedValue("ok") }),
    );
    const invalidProcessing = await executeSlashCommandScript(
      "/imagine processing=high draw cat",
      createContext({ generateImage: vi.fn().mockResolvedValue("ok") }),
    );

    const invalidImageReturn = await executeSlashCommandScript(
      "/imagine draw cat",
      createContext({ generateImage: vi.fn().mockResolvedValue(123 as unknown as string) }),
    );
    const invalidConfigReturn = await executeSlashCommandScript(
      "/imagine-source",
      createContext({
        getImageGenerationConfig: vi.fn().mockResolvedValue({
          source: 1,
          style: "anime",
          comfyWorkflow: "wf",
        }),
      }),
    );

    expect(missingImagine.isError).toBe(true);
    expect(missingSource.isError).toBe(true);
    expect(missingWorkflowArg.isError).toBe(true);
    expect(invalidBool.isError).toBe(true);
    expect(invalidNumber.isError).toBe(true);
    expect(invalidProcessing.isError).toBe(true);
    expect(invalidImageReturn.isError).toBe(true);
    expect(invalidConfigReturn.isError).toBe(true);

    expect(missingImagine.errorMessage).toContain("not available");
    expect(missingSource.errorMessage).toContain("not available");
    expect(missingWorkflowArg.errorMessage).toContain("requires workflow name");
    expect(invalidBool.errorMessage).toContain("invalid quiet");
    expect(invalidNumber.errorMessage).toContain("invalid width");
    expect(invalidProcessing.errorMessage).toContain("invalid processing");
    expect(invalidImageReturn.errorMessage).toContain("must return a string");
    expect(invalidConfigReturn.errorMessage).toContain("image config source");
  });

  it("/instruct 支持读取、forceGet 与设置预设", async () => {
    const getInstructMode = vi
      .fn()
      .mockResolvedValueOnce({ enabled: false, preset: "Creative" })
      .mockResolvedValueOnce({ enabled: false, preset: "Creative" });
    const setInstructMode = vi.fn().mockResolvedValue({ enabled: true, preset: "Planner" });
    const ctx = createContext({ getInstructMode, setInstructMode });

    const disabledRead = await executeSlashCommandScript("/instruct", ctx);
    const forceRead = await executeSlashCommandScript("/instruct forceGet=true", ctx);
    const setPreset = await executeSlashCommandScript("/instruct quiet=true Planner", ctx);

    expect(disabledRead).toMatchObject({ isError: false, pipe: "" });
    expect(forceRead).toMatchObject({ isError: false, pipe: "Creative" });
    expect(setPreset).toMatchObject({ isError: false, pipe: "Planner" });

    expect(setInstructMode).toHaveBeenCalledWith({
      preset: "Planner",
      enabled: true,
      quiet: true,
    });
  });

  it("/instruct-on|/instruct-off|/instruct-state|/instruct-toggle 支持状态切换", async () => {
    const getInstructMode = vi
      .fn()
      .mockResolvedValueOnce({ enabled: true, preset: "Planner" })
      .mockResolvedValueOnce({ enabled: true, preset: "Planner" });
    const setInstructMode = vi
      .fn()
      .mockResolvedValueOnce({ enabled: true, preset: "Planner" })
      .mockResolvedValueOnce({ enabled: false, preset: "Planner" })
      .mockResolvedValueOnce({ enabled: false, preset: "Planner" });
    const ctx = createContext({ getInstructMode, setInstructMode });

    const onResult = await executeSlashCommandScript("/instruct-on", ctx);
    const stateRead = await executeSlashCommandScript("/instruct-state", ctx);
    const stateSet = await executeSlashCommandScript("/instruct-state false", ctx);
    const toggleSet = await executeSlashCommandScript("/instruct-toggle false", ctx);
    const offResult = await executeSlashCommandScript(
      "/instruct-off",
      createContext({
        setInstructMode: vi.fn().mockResolvedValue({ enabled: false, preset: "Planner" }),
      }),
    );

    expect(onResult).toMatchObject({ isError: false, pipe: "true" });
    expect(stateRead).toMatchObject({ isError: false, pipe: "true" });
    expect(stateSet).toMatchObject({ isError: false, pipe: "false" });
    expect(toggleSet).toMatchObject({ isError: false, pipe: "false" });
    expect(offResult).toMatchObject({ isError: false, pipe: "false" });

    expect(setInstructMode).toHaveBeenNthCalledWith(1, { enabled: true });
    expect(setInstructMode).toHaveBeenNthCalledWith(2, { enabled: false });
    expect(setInstructMode).toHaveBeenNthCalledWith(3, { enabled: false });
  });

  it("instruct 命令在宿主缺失、参数非法、返回异常时显式 fail-fast", async () => {
    const missingInstruct = await executeSlashCommandScript("/instruct", createContext());
    const missingOn = await executeSlashCommandScript("/instruct-on", createContext());

    const invalidForceGet = await executeSlashCommandScript(
      "/instruct forceGet=maybe",
      createContext({ getInstructMode: vi.fn().mockResolvedValue({ enabled: true, preset: "A" }) }),
    );
    const invalidStateArg = await executeSlashCommandScript(
      "/instruct-state maybe",
      createContext({ setInstructMode: vi.fn().mockResolvedValue({ enabled: true, preset: "A" }) }),
    );

    const invalidStateReturn = await executeSlashCommandScript(
      "/instruct-state",
      createContext({
        getInstructMode: vi.fn().mockResolvedValue({ enabled: "on", preset: "A" } as unknown),
      }),
    );

    expect(missingInstruct.isError).toBe(true);
    expect(missingOn.isError).toBe(true);
    expect(invalidForceGet.isError).toBe(true);
    expect(invalidStateArg.isError).toBe(true);
    expect(invalidStateReturn.isError).toBe(true);

    expect(missingInstruct.errorMessage).toContain("not available");
    expect(missingOn.errorMessage).toContain("not available");
    expect(invalidForceGet.errorMessage).toContain("invalid forceGet");
    expect(invalidStateArg.errorMessage).toContain("invalid state");
    expect(invalidStateReturn.errorMessage).toContain("boolean enabled");
  });
});
