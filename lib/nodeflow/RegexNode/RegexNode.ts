import { NodeBase } from "@/lib/nodeflow/NodeBase";
import { NodeConfig, NodeInput, NodeOutput, NodeCategory } from "@/lib/nodeflow/types";
import { RegexNodeTools } from "./RegexNodeTools";
import { NodeToolRegistry } from "../NodeTool";

const DEBUG = true;
function log(tag: string, ...args: unknown[]): void {
  if (DEBUG) console.log(`[RegexNode][${tag}]`, ...args);
}

export class RegexNode extends NodeBase {
  static readonly nodeName = "regex";
  static readonly description = "Processes LLM responses with regex patterns";
  static readonly version = "1.0.0";

  constructor(config: NodeConfig) {
    NodeToolRegistry.register(RegexNodeTools);
    super(config);
    this.toolClass = RegexNodeTools;
  }

  protected getDefaultCategory(): NodeCategory {
    return NodeCategory.MIDDLE;
  }

  protected async _call(input: NodeInput): Promise<NodeOutput> {
    log("START", "━━━ RegexNode 开始执行 ━━━");
    log("INPUT", `llmResponse长度=${input.llmResponse?.length}, characterId=${input.characterId}`);

    let llmResponse = input.llmResponse;
    const characterId = input.characterId;

    if (!llmResponse) {
      log("ERROR", "缺少 llmResponse");
      throw new Error("LLM response is required for RegexNode");
    }

    if (!characterId) {
      log("ERROR", "缺少 characterId");
      throw new Error("Character ID is required for RegexNode");
    }

    // 提取思考内容
    let thinkingContent = "";
    const thinkingMatch = llmResponse.match(/<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/);
    if (thinkingMatch) {
      thinkingContent = thinkingMatch[1].trim();
      log("THINK", `提取到思考内容，长度=${thinkingContent.length}`);
    }

    llmResponse = llmResponse
      .replace(/\n*\s*<think>[\s\S]*?<\/think>\s*\n*/g, "")
      .replace(/\n*\s*<thinking>[\s\S]*?<\/thinking>\s*\n*/g, "")
      .trim();

    let mainContent = "";
    let nextPrompts: string[] = [];
    let event = "";

    const cleanedResponse = llmResponse
      .replace(/\s*<\/?output>\s*/g, "")
      .replace(/\s*<\/?outputFormat>\s*/g, "")
      .trim();

    const nextPromptsMatch = cleanedResponse.match(/<next_prompts>([\s\S]*?)<\/next_prompts>/);
    if (nextPromptsMatch) {
      nextPrompts = nextPromptsMatch[1]
        .trim()
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
        .map((l: string) => l.replace(/^[-*]\s*/, "").replace(/^\s*\[|\]\s*$/g, "").trim());
    }

    const eventsMatch = cleanedResponse.match(/<events>([\s\S]*?)<\/events>/);
    if (eventsMatch) {
      event = eventsMatch[1].trim().replace(/\[|\]/g, "");
    }

    mainContent = cleanedResponse
      .replace(/\n*\s*<next_prompts>[\s\S]*?<\/next_prompts>\s*\n*/g, "")
      .replace(/\n*\s*<events>[\s\S]*?<\/events>\s*\n*/g, "")
      .trim();

    const processedResult = await this.executeTool(
      "processRegex",
      mainContent,
      characterId,
    ) as { replacedText: string };

    return {
      thinkingContent,
      screenContent: processedResult.replacedText,
      fullResponse: llmResponse,
      nextPrompts,
      event,
      characterId,
    };
  }
} 
