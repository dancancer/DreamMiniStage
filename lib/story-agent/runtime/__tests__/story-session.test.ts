import { describe, expect, it, vi } from "vitest";
import type { SessionBlueprint, WorldModuleEntry } from "@/lib/story-agent/blueprint";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import {
  createStorySession,
  finalizeStoryTurn,
  prepareStoryTurn,
  type StorySessionState,
} from "../story-session";
import { storyActionsSourcePattern } from "../action/options";
import { storyStateSourcePattern } from "../state/update";

describe("SAC-Phase 6a StorySession runtime", () => {
  it("prepares a blueprint-only model request and commits recent transcript plus render state", async () => {
    const blueprint = createBlueprint();
    let saved = createStorySession({
      dialogueId: "dialogue-1",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = vi.fn(async (session: StorySessionState) => {
      saved = session;
    });

    const turn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "alpha",
      model: modelInput(),
      commitSession,
    });
    const result = await finalizeStoryTurn(turn, "raw answer");

    expect(turn.llmConfig.messages?.map((message) => message.content).join("\n")).toContain("Alpha lore");
    expect(turn.llmConfig).not.toHaveProperty("scriptTools");
    expect(result.screenContent).toBe("screen answer");
    expect(saved.recentTranscript.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(saved.renderState.activeIntentIds).toEqual(["choices"]);
  });

  it("keeps sticky, cooldown and delay counters in StorySession state across turns", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({
      dialogueId: "dialogue-2",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha beta later",
      model: modelInput(),
      commitSession,
    }), "first");

    const second = prepareStoryTurn({
      blueprint,
      session,
      userInput: "no direct key",
      model: modelInput(),
      commitSession,
    });

    expect(second.worldHits.map((hit) => `${hit.entryId}:${hit.reason}`)).toEqual([
      "sticky:sticky",
      "delayed:delayed",
    ]);

    await finalizeStoryTurn(second, "second");
    const third = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha",
      model: modelInput(),
      commitSession,
    });

    expect(third.worldHits.map((hit) => hit.entryId)).not.toContain("cooldown");
    expect(blueprint.worldModules[0].entries.find((entry) => entry.id === "sticky")?.content).toBe("Alpha lore");
  });

  it("does not leak ST-shaped prompt_order or runtime placement fields into the prepared request", () => {
    const blueprint = createBlueprint();
    const session = createStorySession({ dialogueId: "dialogue-3", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha",
      model: modelInput(),
    });

    expect(JSON.stringify(turn.llmConfig)).not.toMatch(/"(prompt_order|placement)":/);
    expect(JSON.stringify(turn.promptMessages)).not.toMatch(/"(prompt_order|placement)":/);
  });

  it("uses responseLength as the per-turn output cap", () => {
    const blueprint = {
      ...createBlueprint(),
      modelPolicy: {
        contextWindow: 841_394,
        maxTokens: 65_535,
        temperature: 1.5,
        topP: 0.92,
      },
    };
    const session = createStorySession({ dialogueId: "dialogue-policy", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha",
      model: {
        modelName: "deepseek-v4-pro",
        apiKey: "key",
        llmType: "openai",
        responseLength: 200,
      },
    });

    expect(turn.llmConfig.contextWindow).toBe(1_000_000);
    expect(turn.llmConfig.maxTokens).toBe(200);
    expect(turn.llmConfig.temperature).toBeUndefined();
    expect(turn.llmConfig.topP).toBeUndefined();
  });

  it("keeps the current user input in the final request and resolves prompt macros", () => {
    const blueprint = createBlueprint();
    const session = createStorySession({ dialogueId: "dialogue-macros", blueprint });
    const turn = prepareStoryTurn({
      blueprint: {
        ...blueprint,
        promptStack: {
          messages: [{
            id: "macro",
            role: "user",
            content: "{{lastUserMessage}} for {{char}}/{{user}} and <char>/<user> {{random::alpha::beta}} {{trim}}",
            enabled: true,
            order: 0,
            sourceKind: "preset",
            sourcePath: "fixture",
            sourceField: "prompt",
          }],
        },
      },
      session,
      userInput: "E2E_MARKER",
      model: { ...modelInput(), contextWindow: 200, username: "Tester" },
    });

    const promptJoined = turn.promptMessages.map((message) => message.content).join("\n");
    const modelJoined = turn.llmConfig.messages?.map((message) => message.content).join("\n") ?? "";
    expect(promptJoined).toMatch(/E2E_MARKER for Character\/Tester and Character\/Tester (alpha|beta) /);
    expect(countMatches(modelJoined, "E2E_MARKER")).toBe(1);
    expect(modelJoined).not.toMatch(/\{\{(char|user|lastUserMessage|random|trim)[^}]*\}\}|<char>|<user>/i);
  });

  it("adapts imported template macros without leaking ST syntax to the model", () => {
    const blueprint = createBlueprint();
    const session = {
      ...createStorySession({ dialogueId: "dialogue-imported-template", blueprint }),
      storyState: {
        ...createStorySession({ dialogueId: "dialogue-imported-template", blueprint }).storyState,
        variables: { stat_data: { Soyo: { affection: 3 } } },
      },
    };
    const turn = prepareStoryTurn({
      blueprint: {
        ...blueprint,
        promptStack: {
          messages: [{
            id: "template",
            role: "system",
            content: [
              "\"date\":\"{{当前日期,格式:X年X月X日星期X}}\"",
              "\"state\":{{get_message_variable::stat_data}}",
              "\"roll\":\"{{roll:1d26-1}}\"",
            ].join("\n"),
            enabled: true,
            order: 0,
            sourceKind: "preset",
            sourcePath: "fixture",
            sourceField: "content",
          }],
        },
      },
      session,
      userInput: "continue",
      model: modelInput(),
    });
    const modelJoined = turn.llmConfig.messages?.map((message) => message.content).join("\n") ?? "";

    expect(modelJoined).not.toContain("{{");
    expect(modelJoined).toContain("[当前日期,格式:X年X月X日星期X]");
    expect(modelJoined).toContain("\"affection\": 3");
    expect(modelJoined).toMatch(/"roll":"\d+"/);
  });

  it("preserves current user input even when prompt budget is exhausted", () => {
    const blueprint = createBlueprint();
    const session = createStorySession({ dialogueId: "dialogue-budget", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "E2E_REQUIRED_TAIL",
      model: { ...modelInput(), contextWindow: 1 },
    });

    expect(turn.llmConfig.messages?.at(-1)).toMatchObject({
      role: "user",
      content: "E2E_REQUIRED_TAIL",
    });
  });

  it("injects a required status render contract for follow-up replies", () => {
    const blueprint = {
      ...createBlueprint(),
      renderRules: [{
        schemaVersion: 1 as const,
        id: "status",
        kind: "status-panel" as const,
        sourceScriptId: "status-script",
        title: "状态栏",
        confidence: 0.8,
        fields: [],
        dataTemplate: "$1",
        sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*</SFW>",
      }],
    };
    const session = createStorySession({ dialogueId: "dialogue-status-contract", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "continue",
      model: { ...modelInput(), contextWindow: 1 },
    });
    const renderMessages = turn.promptMessages.filter((message) => message.source === "render");

    expect(renderMessages).toHaveLength(1);
    expect(renderMessages[0]?.content).toContain("<SFW>");
    expect(renderMessages[0]?.content).toContain("After every assistant story reply");
    expect(turn.llmConfig.messages?.at(-1)).toMatchObject({
      role: "user",
      content: "continue",
    });
  });

  it("injects dashboard sections and meters into custom status render contracts", () => {
    const blueprint = {
      ...createBlueprint(),
      renderRules: [{
        schemaVersion: 1 as const,
        id: "dashboard",
        kind: "status-panel" as const,
        sourceScriptId: "dashboard-script",
        title: "Tactical Terminal",
        confidence: 0.8,
        fields: [],
        dataTemplate: "$1",
        sourcePattern: "<StatusDashboard>\\s*(\\{[\\s\\S]*?\\})\\s*<\\/StatusDashboard>",
      }],
    };
    const session = createStorySession({ dialogueId: "dialogue-dashboard-contract", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "continue",
      model: { ...modelInput(), contextWindow: 1 },
    });
    const renderText = turn.promptMessages
      .filter((message) => message.source === "render")
      .map((message) => message.content)
      .join("\n");

    expect(renderText).toContain("<StatusDashboard>");
    expect(renderText).toContain("\"mode\":\"statusdashboard\"");
    expect(renderText).toContain("\"sections\"");
    expect(renderText).toContain("\"meters\"");
    expect(renderText).not.toContain("<SFW>");
  });

  it("keeps prompt provenance granular but sends a compact semantic system block to the model", () => {
    const blueprint = {
      ...createBlueprint(),
      promptStack: {
        messages: [
          {
            id: "persona",
            role: "system" as const,
            content: "Persona rules.",
            enabled: true,
            order: 0,
            sourceKind: "character" as const,
            sourcePath: "character.card",
            sourceField: "description",
          },
          {
            id: "style",
            role: "system" as const,
            content: "Style rules.",
            enabled: true,
            order: 1,
            sourceKind: "preset" as const,
            sourcePath: "preset.json",
            sourceField: "prompt",
          },
          {
            id: "turn-wrapper",
            role: "user" as const,
            content: "{{lastUserMessage}} as turn wrapper.",
            enabled: true,
            order: 2,
            sourceKind: "preset" as const,
            sourcePath: "preset.json",
            sourceField: "prompt",
          },
        ],
      },
      renderRules: [{
        schemaVersion: 1 as const,
        id: "status",
        kind: "status-panel" as const,
        sourceScriptId: "status-script",
        title: "状态栏",
        confidence: 0.8,
        fields: [],
        dataTemplate: "$1",
        sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*</SFW>",
      }],
    };
    const session = createStorySession({ dialogueId: "dialogue-topology", blueprint });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "alpha continue",
      model: modelInput(),
    });
    const modelMessages = turn.llmConfig.messages ?? [];
    const systemMessages = modelMessages.filter((message) => message.role === "system");

    expect(turn.promptMessages.filter((message) => message.source === "prompt-stack")).toHaveLength(3);
    expect(turn.promptMessages.some((message) => message.source === "world")).toBe(true);
    expect(turn.promptMessages.some((message) => message.source === "render")).toBe(true);
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toContain("[Story instructions]");
    expect(systemMessages[0]?.content).toContain("[World context]");
    expect(systemMessages[0]?.content).toContain("[UI render contracts]");
    expect(systemMessages[0]?.content).toContain("as turn wrapper.");
    expect(modelMessages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(modelMessages.some((message) => message.role === "assistant")).toBe(false);
    expect(countMatches(modelMessages.map((message) => message.content).join("\n"), "alpha continue")).toBe(1);
    expect(modelMessages.at(-1)).toMatchObject({ role: "user", content: "alpha continue" });
  });

  it("persists UpdateVariable commands as StoryState and keeps raw blocks out of history", async () => {
    const blueprint = {
      ...createBlueprint(),
      renderRules: [{
        schemaVersion: 1 as const,
        id: "state",
        kind: "state-panel" as const,
        sourceScriptId: "state-script",
        title: "Story State",
        confidence: 0.8,
        dataTemplate: "$1",
        sourcePattern: storyStateSourcePattern(),
      }],
    };
    let saved = createStorySession({ dialogueId: "dialogue-state", blueprint });
    const commitSession = async (session: StorySessionState) => {
      saved = session;
    };

    const result = await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "inspect backstage",
      model: modelInput(),
      commitSession,
    }), [
      "<thinking>hidden plan</thinking>",
      "<gametxt>后台门缝里透出冷光。</gametxt>",
      "<UpdateVariable>",
      "_.set('当前地点', '后台走廊');",
      "_.add('线索数量', 1);",
      "</UpdateVariable>",
    ].join("\n"));

    expect(result.screenContent).toContain("<StoryState>");
    expect(result.screenContent).not.toContain("<UpdateVariable>");
    expect(saved.recentTranscript.at(-1)?.content).toBe("后台门缝里透出冷光。");
    expect(saved.storyState.variables).toMatchObject({
      当前地点: "后台走廊",
      线索数量: 1,
    });

    const nextTurn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "continue",
      model: modelInput(),
    });
    const stateText = nextTurn.promptMessages
      .filter((message) => message.content.includes("<status_current_variables>"))
      .map((message) => message.content)
      .join("\n");

    expect(stateText).toContain("后台走廊");
    expect(stateText).toContain("线索数量");
  });

  it("adds a minimal status source for UI rendering when the model omits status JSON", async () => {
    const blueprint = {
      ...createBlueprint(),
      renderRules: [{
        schemaVersion: 1 as const,
        id: "status",
        kind: "status-panel" as const,
        sourceScriptId: "status-script",
        title: "状态栏",
        confidence: 0.8,
        fields: [],
        dataTemplate: "$1",
        sourcePattern: "<SFW>\\s*(\\{[\\s\\S]*?\\})\\s*</SFW>",
      }],
    };
    let saved = createStorySession({ dialogueId: "dialogue-status-fallback", blueprint });
    const commitSession = async (session: StorySessionState) => {
      saved = session;
    };

    const result = await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "continue",
      model: modelInput(),
      commitSession,
    }), "正文继续。");

    expect(result.screenContent).toContain("<SFW>");
    expect(result.screenContent).toContain("\"status\":\"剧情推进中\"");
    expect(saved.recentTranscript.at(-1)?.content).toBe("正文继续。");
  });

  it("turns action blocks into internal choice-list render data", async () => {
    const blueprint = {
      ...createBlueprint(),
      renderRules: [{
        schemaVersion: 1 as const,
        id: "actions",
        kind: "choice-list" as const,
        sourceScriptId: "action-script",
        title: "Actions",
        confidence: 0.8,
        options: [],
        dataTemplate: "$1",
        sourcePattern: storyActionsSourcePattern(),
      }],
    };
    let saved = createStorySession({ dialogueId: "dialogue-actions", blueprint });
    const commitSession = async (session: StorySessionState) => {
      saved = session;
    };

    const result = await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "look around",
      model: modelInput(),
      commitSession,
    }), [
      "<gametxt>剧场的灯一盏盏熄灭。</gametxt>",
      "<action>",
      "1. 检查侧门",
      "2. 呼唤领座员",
      "</action>",
    ].join("\n"));

    expect(result.screenContent).toContain("<StoryActions>");
    expect(result.screenContent).not.toContain("<action>");
    expect(saved.recentTranscript.at(-1)?.content).toBe("剧场的灯一盏盏熄灭。");

    const nextTurn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "continue",
      model: modelInput(),
    });
    expect(nextTurn.promptMessages.some((message) => message.content.includes("<action>"))).toBe(true);
  });

  it("seeds compiled initial variables before the first user turn", () => {
    const blueprint = {
      ...createBlueprint(),
      initialState: {
        variables: {
          stat_data: {
            祥子: { 好感度: [0, "relationship toward user"] },
          },
        },
        sources: ["fixture:[InitVar]"],
        errors: [],
      },
    };
    const session = createStorySession({
      dialogueId: "dialogue-initial-state",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "continue",
      model: modelInput(),
    });
    const stateText = turn.promptMessages
      .filter((message) => message.content.includes("<status_current_variables>"))
      .map((message) => message.content)
      .join("\n");

    expect(session.storyState.variables).toMatchObject({
      stat_data: {
        祥子: { 好感度: [0, "relationship toward user"] },
      },
    });
    expect(stateText).toContain("status_current_variables");
    expect(stateText).toContain("relationship toward user");
  });

  it("seeds the selected opening into the first story turn", async () => {
    const blueprint = createBlueprint();
    let saved = createStorySession({
      dialogueId: "dialogue-opening",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = vi.fn(async (session: StorySessionState) => {
      saved = session;
    });

    const turn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "continue from this opening",
      model: { ...modelInput(), contextWindow: 1 },
      openingMessage: {
        id: "opening:alternate:1",
        content: "Alternate opening chosen by the user.",
        fullContent: "Alternate opening chosen by the user.",
      },
      commitSession,
    });

    expect(turn.llmConfig.messages?.map((message) => message.content)).toContain(
      "Alternate opening chosen by the user.",
    );

    await finalizeStoryTurn(turn, "raw answer");

    expect(saved.recentTranscript.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(saved.recentTranscript[0]?.content).toBe("Alternate opening chosen by the user.");
  });

  it("uses raw fullContent rather than UI-only opening content in model context", async () => {
    const blueprint = createBlueprint();
    let saved = createStorySession({
      dialogueId: "dialogue-opening-display",
      blueprint,
      now: "2026-05-29T00:00:00.000Z",
    });
    const commitSession = vi.fn(async (session: StorySessionState) => {
      saved = session;
    });

    const turn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "continue",
      model: { ...modelInput(), contextWindow: 1 },
      openingMessage: {
        id: "opening:display",
        content: "Raw opening.\n<SFW>{\"characters\":[]}</SFW>",
        fullContent: "Raw opening.",
      },
      commitSession,
    });

    const promptText = turn.llmConfig.messages?.map((message) => message.content).join("\n") ?? "";
    expect(promptText).toContain("Raw opening.");
    expect(promptText).not.toContain("<SFW>");

    await finalizeStoryTurn(turn, "raw answer");
    expect(saved.recentTranscript[0]?.content).toBe("Raw opening.");
  });

  it("uses summary, facts and relationship memory when recent transcript is trimmed", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({ dialogueId: "dialogue-4", blueprint });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    for (let index = 0; index < 12; index += 1) {
      await finalizeStoryTurn(prepareStoryTurn({
        blueprint,
        session,
        userInput: `turn ${index} [fact:Alice keeps a silver key] [relationship:trust=warm]`,
        model: modelInput(),
        commitSession,
      }), `reply ${index}`);
    }

    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "what do you remember about Alice?",
      model: { ...modelInput(), maxTokens: 80 },
    });
    const memoryText = turn.promptMessages
      .filter((message) => message.source === "memory")
      .map((message) => message.content)
      .join("\n");

    expect(session.memory.runningSummary.content).toContain("turn 0");
    expect(memoryText).toContain("Alice keeps a silver key");
    expect(memoryText).toContain("trust: warm");
  });

  it("degrades when memory extraction fails without blocking the turn commit", async () => {
    const blueprint = createBlueprint();
    let session = createStorySession({ dialogueId: "dialogue-5", blueprint });
    const commitSession = async (next: StorySessionState) => {
      session = next;
    };

    const turn = prepareStoryTurn({
      blueprint,
      session,
      userInput: "remember this",
      model: modelInput(),
      commitSession,
      memoryExtractor: () => {
        throw new Error("extractor unavailable");
      },
    });

    await expect(finalizeStoryTurn(turn, "reply")).resolves.toMatchObject({
      screenContent: "reply",
    });
    expect(session.recentTranscript).toHaveLength(2);
    expect(session.memory.lastError).toBe("extractor unavailable");
  });
});

function modelInput() {
  return {
    modelName: "gpt-test",
    apiKey: "key",
    llmType: "openai" as const,
    maxTokens: 128,
    streaming: false,
  };
}

function countMatches(text: string, value: string): number {
  return text.split(value).length - 1;
}

function createBlueprint(): SessionBlueprint {
  return {
    id: "blueprint:test",
    schemaVersion: 6,
    sourceHash: "hash",
    createdAt: "2026-05-29T00:00:00.000Z",
    profile: {
      id: "char-1",
      name: "Character",
      openings: [],
      promptFragments: [],
    },
    promptStack: {
      messages: [{
        id: "system",
        role: "system",
        content: "Stay in character.",
        enabled: true,
        order: 0,
        sourceKind: "preset",
        sourcePath: "fixture",
        sourceField: "prompt",
      }],
    },
    modelPolicy: {},
    worldModules: [{
      id: "world",
      name: "World",
      sourcePath: "fixture",
      entries: [
        worldEntry("sticky", "Alpha lore", ["alpha"], { sticky: 2 }),
        worldEntry("cooldown", "Beta lore", ["beta"], { cooldown: 2 }),
        worldEntry("delayed", "Later lore", ["later"], { delay: 1 }),
      ],
    }],
    inputTransforms: [],
    outputTransforms: [{
      id: "output",
      name: "output",
      direction: "output",
      enabled: true,
      pattern: "raw",
      replacement: "screen",
      sourcePath: "fixture",
    }],
    promptTransforms: [],
    contentRules: [],
    renderRules: [{
      schemaVersion: 1,
      id: "choices",
      kind: "choice-list",
      sourceScriptId: "script",
      title: "Choices",
      confidence: 0.8,
      options: [{
        id: "choice-1",
        labelTemplate: "$1",
        action: { type: "append-input", valueTemplate: "$1" },
      }],
    }],
    initialState: { variables: {}, sources: [], errors: [] },
    memoryPolicy: defaultMemoryPolicy(),
    diagnostics: [],
    repairReport: {
      appliedPatches: [],
      manualPatches: [],
      rejectedPatches: [],
    },
    provenance: [],
  };
}

function worldEntry(
  id: string,
  content: string,
  primaryKeys: string[],
  activation: Partial<WorldModuleEntry["activation"]>,
): WorldModuleEntry {
  return {
    id,
    enabled: true,
    content,
    primaryKeys,
    secondaryKeys: [],
    secondaryKeyLogic: "AND_ANY",
    constant: false,
    selective: false,
    useRegex: false,
    position: "before",
    depth: 0,
    caseSensitive: false,
    matchWholeWords: false,
    insertionOrder: id === "sticky" ? 1 : id === "cooldown" ? 2 : 3,
    activation: {
      sticky: activation.sticky ?? 0,
      cooldown: activation.cooldown ?? 0,
      delay: activation.delay ?? 0,
    },
    recursion: {
      preventRecursion: false,
      excludeRecursion: false,
    },
    sourceField: "entries",
  };
}
