import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { WorldBookManager } from "@/lib/core/world-book";
import type { MacroEnv } from "@/lib/core/st-preset-types";
import type { DialogueMessage } from "@/lib/models/character-dialogue-model";
import { RegexPlacement } from "@/lib/models/regex-script-model";
import type { WorldBookEntry } from "@/lib/models/world-book-model";

export interface DialogueFlowRegexScript {
  findRegex: string;
  replaceString?: string | null;
  placement?: Array<number | "USER_INPUT" | "AI_OUTPUT">;
  disabled?: boolean;
}

export interface DialogueFlowResult {
  processedInput: string;
  matchedWorldBookEntries: WorldBookEntry[];
  assembledPrompt: string;
  simulatedResponse: string;
  processedResponse: string;
  updatedHistory: DialogueMessage[];
}

export interface DialogueFlowConfig {
  userInput: string;
  macroEnv: MacroEnv;
  worldBook: WorldBookEntry[];
  regexScripts: DialogueFlowRegexScript[];
  history: DialogueMessage[];
  systemPrompt: string;
  characterCard: string;
}

function matchesPlacement(
  script: DialogueFlowRegexScript,
  placement: RegexPlacement,
  legacyName: "USER_INPUT" | "AI_OUTPUT",
): boolean {
  if (!script.placement) {
    return legacyName === "USER_INPUT";
  }

  return script.placement.some(
    (value) => value === placement || value === legacyName,
  );
}

function compileRegex(pattern: string): RegExp | null {
  try {
    const regexMatch = pattern.match(/^\/(.*)\/([gimsuy]*)$/);

    if (regexMatch) {
      return new RegExp(regexMatch[1], regexMatch[2] || "g");
    }

    try {
      return new RegExp(pattern, "g");
    } catch {
      return new RegExp(
        pattern.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"),
        "g",
      );
    }
  } catch {
    return null;
  }
}

export function executeDialogueFlow(
  config: DialogueFlowConfig,
): DialogueFlowResult {
  const {
    userInput,
    macroEnv,
    worldBook,
    regexScripts,
    history,
    systemPrompt,
    characterCard,
  } = config;
  const macroEvaluator = new STMacroEvaluator();
  let processedInput = macroEvaluator.evaluate(userInput, macroEnv);

  const userInputScripts = regexScripts.filter((script) =>
    matchesPlacement(script, RegexPlacement.USER_INPUT, "USER_INPUT"),
  );

  for (const script of userInputScripts) {
    if (script.disabled) {
      continue;
    }

    const findRegex = macroEvaluator.evaluate(script.findRegex || "", macroEnv);
    const replaceString = macroEvaluator.evaluate(
      script.replaceString || "",
      macroEnv,
    );
    const regex = compileRegex(findRegex);

    if (regex) {
      processedInput = processedInput.replace(regex, replaceString);
    }
  }

  const matchedWorldBookEntries = WorldBookManager.getMatchingEntries(
    worldBook,
    processedInput,
    history,
    { contextWindow: 10 },
  );

  matchedWorldBookEntries.forEach((entry) => {
    entry.content = macroEvaluator.evaluate(entry.content, macroEnv);
  });

  const worldBookContents = matchedWorldBookEntries
    .map((entry) => entry.content)
    .join("\n\n");
  const historyText = history
    .map((msg) => `${msg.role === "user" ? "用户" : "助手"}: ${msg.content}`)
    .join("\n");
  const assembledPrompt = [
    macroEvaluator.evaluate(systemPrompt, macroEnv),
    macroEvaluator.evaluate(characterCard, macroEnv),
    worldBookContents,
    historyText,
    `用户: ${processedInput}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const simulatedResponse = `[模拟响应] 针对输入"${processedInput}"的回复`;
  let processedResponse = simulatedResponse;
  const aiOutputScripts = regexScripts.filter((script) =>
    matchesPlacement(script, RegexPlacement.AI_OUTPUT, "AI_OUTPUT"),
  );

  for (const script of aiOutputScripts) {
    if (script.disabled) {
      continue;
    }

    const findRegex = macroEvaluator.evaluate(script.findRegex || "", macroEnv);
    const replaceString = macroEvaluator.evaluate(
      script.replaceString || "",
      macroEnv,
    );
    const regex = compileRegex(findRegex);

    if (regex) {
      processedResponse = processedResponse.replace(regex, replaceString);
    }
  }

  return {
    processedInput,
    matchedWorldBookEntries,
    assembledPrompt,
    simulatedResponse,
    processedResponse,
    updatedHistory: [
      ...history,
      {
        role: "user",
        content: processedInput,
        timestamp: Date.now(),
      } as DialogueMessage,
      {
        role: "assistant",
        content: processedResponse,
        timestamp: Date.now() + 1,
      } as DialogueMessage,
    ],
  };
}

export function createMessage(
  role: "user" | "assistant",
  content: string,
): DialogueMessage {
  return {
    role,
    content,
    timestamp: Date.now(),
  } as DialogueMessage;
}

export function createWorldBookEntry(
  keys: string[],
  content: string,
  options: Partial<WorldBookEntry> = {},
): WorldBookEntry {
  return {
    keys,
    content,
    selective: true,
    constant: false,
    position: 4,
    enabled: true,
    ...options,
  };
}
