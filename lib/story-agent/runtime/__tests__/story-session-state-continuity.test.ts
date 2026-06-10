import { describe, expect, it } from "vitest";
import type { SessionBlueprint } from "@/lib/story-agent/blueprint";
import { defaultMemoryPolicy } from "@/lib/story-agent/memory";
import {
  createStorySession,
  finalizeStoryTurn,
  prepareStoryTurn,
  type StorySessionState,
} from "../story-session";
import { storyActionsSourcePattern } from "../action/options";
import { storyStateSourcePattern } from "../state/update";

describe("StorySession state continuity", () => {
  it("keeps StoryState continuous across action-driven multi-turn updates", async () => {
    const blueprint = {
      ...createBlueprint(),
      initialState: {
        variables: {
          Soyo: { affinity: 1 },
          Scene: { location: "front desk" },
        },
        sources: ["fixture:initial"],
        errors: [],
      },
      renderRules: [stateIntent(), actionIntent()],
    };
    let saved = createStorySession({ dialogueId: "dialogue-state-actions", blueprint });
    const commitSession = async (session: StorySessionState) => {
      saved = session;
    };

    const first = await finalizeStoryTurn(prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "检查侧门",
      model: modelInput(),
      commitSession,
    }), [
      "<gametxt>她靠近侧门。</gametxt>",
      "<UpdateVariable>",
      "_.add('Soyo.affinity', 2);",
      "_.set('Scene.location', 'side door');",
      "</UpdateVariable>",
      "<action>",
      "1. 继续追问 - 保持温和",
      "</action>",
    ].join("\n"));

    expect(first.screenContent).toContain("<StoryState>");
    expect(first.screenContent).toContain("<StoryActions>");
    expect(first.screenContent).not.toContain("<UpdateVariable>");
    expect(first.screenContent).not.toContain("<action>");
    expect(saved.recentTranscript.at(-1)?.content).toBe("她靠近侧门。");
    expect(saved.storyState.variables).toMatchObject({
      Soyo: { affinity: 3 },
      Scene: { location: "side door" },
    });

    const secondTurn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "继续追问",
      model: modelInput(),
      commitSession,
    });
    const secondStateText = storyStateMemoryText(secondTurn.promptMessages);

    expect(countMatches(secondStateText, "<status_current_variables>")).toBe(1);
    expect(secondStateText).toContain("\"affinity\": 3");
    expect(secondStateText).toContain("\"location\": \"side door\"");
    expect(secondStateText).not.toContain("<StoryActions>");

    await finalizeStoryTurn(secondTurn, [
      "<gametxt>她停下脚步，认真听完。</gametxt>",
      "<UpdateVariable>",
      "_.add('Soyo.affinity', 1);",
      "_.set('Scene.location', 'lobby');",
      "</UpdateVariable>",
    ].join("\n"));

    expect(saved.storyState.variables).toMatchObject({
      Soyo: { affinity: 4 },
      Scene: { location: "lobby" },
    });
    expect(saved.storyState.events.map((event) => `${event.op}:${event.path}`)).toEqual([
      "add:Soyo.affinity",
      "set:Scene.location",
      "add:Soyo.affinity",
      "set:Scene.location",
    ]);

    const thirdTurn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "继续",
      model: modelInput(),
    });
    const thirdStateText = storyStateMemoryText(thirdTurn.promptMessages);

    expect(countMatches(thirdStateText, "<status_current_variables>")).toBe(1);
    expect(thirdStateText).toContain("\"affinity\": 4");
    expect(thirdStateText).toContain("\"location\": \"lobby\"");
    expect(thirdStateText).not.toContain("\"side door\"");
  });

  it("keeps StoryState current when transcript episodes are summarized", async () => {
    const blueprint = {
      ...createBlueprint(),
      initialState: {
        variables: { counter: 0 },
        sources: ["fixture:counter"],
        errors: [],
      },
      memoryPolicy: {
        ...defaultMemoryPolicy(),
        summary: {
          maxChars: 400,
          preserveRecentEpisodes: 1,
        },
      },
      renderRules: [stateIntent()],
    };
    let saved = createStorySession({ dialogueId: "dialogue-state-summary", blueprint });
    const commitSession = async (session: StorySessionState) => {
      saved = session;
    };

    for (let index = 0; index < 4; index += 1) {
      await finalizeStoryTurn(prepareStoryTurn({
        blueprint,
        session: saved,
        userInput: `turn ${index} [fact:state checkpoint ${index}]`,
        model: modelInput(),
        commitSession,
      }), [
        `<gametxt>第 ${index} 次推进。</gametxt>`,
        "<UpdateVariable>",
        "_.add('counter', 1);",
        "</UpdateVariable>",
      ].join("\n"));
    }

    expect(saved.memory.runningSummary.content).toContain("turn 0");
    expect(saved.storyState.variables).toMatchObject({ counter: 4 });

    const nextTurn = prepareStoryTurn({
      blueprint,
      session: saved,
      userInput: "继续核对状态",
      model: modelInput(),
    });
    const memoryText = nextTurn.promptMessages
      .filter((message) => message.source === "memory")
      .map((message) => message.content)
      .join("\n");
    const stateText = storyStateMemoryText(nextTurn.promptMessages);

    expect(memoryText).toContain("Long-term summary");
    expect(memoryText).toContain("state checkpoint 3");
    expect(countMatches(stateText, "<status_current_variables>")).toBe(1);
    expect(stateText).toContain("\"counter\": 4");
  });
});

function stateIntent() {
  return {
    schemaVersion: 1 as const,
    id: "state",
    kind: "state-panel" as const,
    sourceScriptId: "state-script",
    title: "Story State",
    confidence: 0.8,
    dataTemplate: "$1",
    sourcePattern: storyStateSourcePattern(),
  };
}

function actionIntent() {
  return {
    schemaVersion: 1 as const,
    id: "actions",
    kind: "choice-list" as const,
    sourceScriptId: "action-script",
    title: "Actions",
    confidence: 0.8,
    options: [],
    dataTemplate: "$1",
    sourcePattern: storyActionsSourcePattern(),
  };
}

function modelInput() {
  return {
    modelName: "gpt-test",
    apiKey: "key",
    llmType: "openai" as const,
    maxTokens: 128,
    streaming: false,
  };
}

function storyStateMemoryText(messages: Array<{ source: string; content: string }>): string {
  return messages
    .filter((message) => message.source === "memory" && message.content.includes("<status_current_variables>"))
    .map((message) => message.content)
    .join("\n");
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
    worldModules: [],
    inputTransforms: [],
    outputTransforms: [],
    promptTransforms: [],
    contentRules: [],
    renderRules: [],
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
