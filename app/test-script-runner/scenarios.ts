import {
  clearIframeFunctionTools,
  extensionHandlers,
  handleFunctionToolResult,
  invokeFunctionTool,
  registerIframeDispatcher,
  unregisterIframeDispatcher,
} from "@/hooks/script-bridge/extension-handlers";
import { scopedVariables } from "@/hooks/script-bridge/scoped-variables";
import { variableHandlers } from "@/hooks/script-bridge/variable-handlers";
import { createMinimalContext, executeSlashCommandScript } from "@/lib/slash-command/executor";
import {
  createApiContext,
  createAudioContext,
  emptyVariableSnapshot,
} from "./scenario-helpers";

export interface P4ScenarioDefinition {
  id: string;
  title: string;
  assetReferences: string[];
  expectation: string;
}

export interface P4ScenarioResult {
  id: string;
  title: string;
  passed: boolean;
  durationMs: number;
  detail: Record<string, unknown>;
}

const scenarioDefinitions: P4ScenarioDefinition[] = [
  {
    id: "script-tool-loop",
    title: "脚本工具注册与调用闭环",
    assetReferences: [
      "test-baseline-assets/character-card/Sgw3.card.json",
    ],
    expectation: "registerFunctionTool -> invokeFunctionTool 返回 iframe 回调结果",
  },
  {
    id: "slash-control-flow",
    title: "Slash 控制流与宏条件",
    assetReferences: [
      "test-baseline-assets/character-card/Sgw3.card.json",
      "test-baseline-assets/preset/明月秋青v3.94.json",
    ],
    expectation: "while + if 宏条件收敛到稳定输出 control-flow-ok",
  },
  {
    id: "mvu-variable-chain",
    title: "MVU 变量更新链路",
    assetReferences: [
      "test-baseline-assets/worldbook/服装随机化.json",
    ],
    expectation: "replace -> updateVariablesWith -> insertVariables 结果一致",
  },
  {
    id: "audio-event-chain",
    title: "音频命令 + 事件广播链路",
    assetReferences: [
      "test-baseline-assets/preset/夏瑾 Pro - Beta 0.70.json",
    ],
    expectation: "audioimport/audioplay/event-emit 全链路执行且事件可观测",
  },
];

async function runScriptToolLoopScenario(): Promise<P4ScenarioResult> {
  const startedAt = performance.now();
  const iframeId = `p4_iframe_${Date.now()}`;
  const toolName = "p4_tool_echo";
  let passed = false;
  let detail: Record<string, unknown> = {};

  try {
    registerIframeDispatcher(iframeId, (_type, payload) => {
      const { callbackId, args } = payload as {
        callbackId: string;
        args: Record<string, unknown>;
      };
      handleFunctionToolResult(callbackId, {
        message: `echo:${String(args.input ?? "")}`,
      });
    });

    const context = createApiContext(iframeId);
    const registered = extensionHandlers.registerFunctionTool(
      [
        toolName,
        "P4 e2e echo tool",
        { type: "object", properties: {} },
        false,
        iframeId,
      ],
      context,
    ) === true;

    const invokeResult = await invokeFunctionTool(toolName, { input: "ping" }) as {
      message?: string;
    };

    passed = registered && invokeResult.message === "echo:ping";
    detail = {
      registered,
      invokeResult,
    };
  } catch (error) {
    detail = {
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearIframeFunctionTools(iframeId);
    unregisterIframeDispatcher(iframeId);
  }

  return {
    id: "script-tool-loop",
    title: "脚本工具注册与调用闭环",
    passed,
    durationMs: Math.round(performance.now() - startedAt),
    detail,
  };
}

async function runSlashControlFlowScenario(): Promise<P4ScenarioResult> {
  const startedAt = performance.now();
  let passed = false;
  let detail: Record<string, unknown> = {};

  try {
    const ctx = createMinimalContext();
    await executeSlashCommandScript("/setvar i 0", ctx);
    const loopResult = await executeSlashCommandScript(
      "/while {{getvar::i}} < 3 {: /incvar i :}",
      ctx,
    );
    const finalResult = await executeSlashCommandScript(
      "/if {{getvar::i}} == 3 {: /echo control-flow-ok :} {: /echo control-flow-failed :}",
      ctx,
    );
    const iValue = await executeSlashCommandScript("/getvar i", ctx);

    passed = !loopResult.isError && !finalResult.isError && finalResult.pipe === "control-flow-ok" && iValue.pipe === "3";
    detail = {
      loopResult,
      finalResult,
      iValue: iValue.pipe,
    };
  } catch (error) {
    detail = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    id: "slash-control-flow",
    title: "Slash 控制流与宏条件",
    passed,
    durationMs: Math.round(performance.now() - startedAt),
    detail,
  };
}

async function runMvuVariableChainScenario(): Promise<P4ScenarioResult> {
  const startedAt = performance.now();
  let passed = false;
  let detail: Record<string, unknown> = {};

  try {
    scopedVariables.restoreFromSnapshot(emptyVariableSnapshot);
    const ctx = createApiContext("p4-mvu");

    const registered = variableHandlers.registerVariableSchema(
      [{ type: "object", properties: { hp: { type: "number" } } }, { type: "chat" }],
      ctx,
    ) === true;

    variableHandlers.replaceVariables([{ hp: 10, nested: { level: 1 } }, { type: "chat" }], ctx);

    const updated = variableHandlers.updateVariablesWith(
      [{ hp: 15, nested: { level: 2 } }, { type: "chat" }],
      ctx,
    ) as Record<string, unknown>;

    const inserted = variableHandlers.insertVariables(
      [{ hp: 999, nested: { level: 7, bonus: 3 }, fresh: true }, { type: "chat" }],
      ctx,
    ) as Record<string, unknown>;

    const snapshot = variableHandlers.getVariables([{ type: "chat" }], ctx) as Record<string, unknown>;

    passed =
      registered
      && updated.hp === 15
      && (updated.nested as Record<string, unknown>).level === 2
      && inserted.hp === 15
      && (inserted.nested as Record<string, unknown>).bonus === 3
      && snapshot.fresh === true;

    detail = {
      registered,
      updated,
      inserted,
      snapshot,
    };
  } catch (error) {
    detail = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    id: "mvu-variable-chain",
    title: "MVU 变量更新链路",
    passed,
    durationMs: Math.round(performance.now() - startedAt),
    detail,
  };
}

async function runAudioEventChainScenario(): Promise<P4ScenarioResult> {
  const startedAt = performance.now();
  let passed = false;
  let detail: Record<string, unknown> = {};

  const { ctx, channels } = createAudioContext();
  let eventDetail: unknown;
  const eventName = "stage_change";
  const eventListener = (event: Event): void => {
    eventDetail = (event as CustomEvent).detail;
  };

  window.addEventListener(`DreamMiniStage:${eventName}`, eventListener);

  try {
    const importResult = await executeSlashCommandScript(
      "/audioimport type=bgm play=false https://audio.example/main.mp3,https://audio.example/boss.mp3",
      ctx,
    );
    const playResult = await executeSlashCommandScript("/audioplay type=bgm", ctx);
    const eventResult = await executeSlashCommandScript(
      `/event-emit ${eventName} source=p4-audio`,
      ctx,
    );

    passed =
      !importResult.isError
      && !playResult.isError
      && !eventResult.isError
      && channels.bgm.playlist.length === 2
      && channels.bgm.isPlaying
      && (eventDetail as Record<string, unknown> | undefined)?.source === "p4-audio";

    detail = {
      importResult,
      playResult,
      eventResult,
      channelSnapshot: {
        playlist: channels.bgm.playlist,
        isPlaying: channels.bgm.isPlaying,
        currentUrl: channels.bgm.currentUrl,
      },
      eventDetail,
    };
  } catch (error) {
    detail = {
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    window.removeEventListener(`DreamMiniStage:${eventName}`, eventListener);
  }

  return {
    id: "audio-event-chain",
    title: "音频命令 + 事件广播链路",
    passed,
    durationMs: Math.round(performance.now() - startedAt),
    detail,
  };
}

export function getP4ScenarioDefinitions(): P4ScenarioDefinition[] {
  return scenarioDefinitions.map((scenario) => ({ ...scenario }));
}

export async function runP4ScenarioById(id: string): Promise<P4ScenarioResult> {
  if (id === "script-tool-loop") {
    return runScriptToolLoopScenario();
  }
  if (id === "slash-control-flow") {
    return runSlashControlFlowScenario();
  }
  if (id === "mvu-variable-chain") {
    return runMvuVariableChainScenario();
  }
  if (id === "audio-event-chain") {
    return runAudioEventChainScenario();
  }

  return {
    id,
    title: `未知场景: ${id}`,
    passed: false,
    durationMs: 0,
    detail: {
      error: `Scenario not found: ${id}`,
    },
  };
}

export async function runAllP4Scenarios(): Promise<P4ScenarioResult[]> {
  const results: P4ScenarioResult[] = [];
  for (const scenario of scenarioDefinitions) {
    const result = await runP4ScenarioById(scenario.id);
    results.push(result);
  }
  return results;
}
