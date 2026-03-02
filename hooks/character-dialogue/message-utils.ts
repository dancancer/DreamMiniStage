/**
 * @input  types/character-dialogue
 * @output formatMessages, extractOpeningMessages
 * @pos    对话消息工具 - 格式化对话消息与开场白抽取
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Character Dialogue Message Utils                       ║
 * ║  格式化对话消息与开场白抽取，保持主 Hook 精简                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { DialogueMessage, OpeningMessage } from "@/types/character-dialogue";

export const formatMessages = (rawMessages: any[]): DialogueMessage[] => {
  return rawMessages.map((msg: any) => ({
    id: msg.id,
    role: msg.role === "system" ? "assistant" : msg.role,
    thinkingContent: msg.thinkingContent ?? "",
    content: msg.content,
    swipe: msg.swipe,
  }));
};

export const extractOpeningMessages = (
  dialogue: any,
  formattedMessages: DialogueMessage[]
): { openings: OpeningMessage[]; activeIndex: number; locked: boolean } => {
  const hasUserMessage = formattedMessages.some((msg) => msg.role === "user");
  const rootOpenings =
    dialogue?.tree?.nodes?.filter(
      (node: any) => node?.parentNodeId === "root" && !node?.userInput
    ) || [];

  const processedOpenings = rootOpenings
    .map((node: any) => {
      const content = node?.parsedContent?.regexResult || node?.assistantResponse;
      if (!content) return null;
      return { id: node.nodeId, content };
    })
    .filter(Boolean) as OpeningMessage[];

  if (!hasUserMessage && processedOpenings.length > 0) {
    const activeIndex = processedOpenings.findIndex(
      (item) => item.id === dialogue?.current_nodeId
    );
    return {
      openings: processedOpenings,
      activeIndex: activeIndex >= 0 ? activeIndex : 0,
      locked: false,
    };
  }

  return { openings: [], activeIndex: 0, locked: hasUserMessage };
};
