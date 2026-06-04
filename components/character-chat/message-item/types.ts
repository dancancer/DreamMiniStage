/**
 * @input  @/lib/story-agent/render-intent
 * @output Message, MessageCharacter, MessageRoleKind
 * @pos    单条消息渲染的共享类型
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Message Item Types                               ║
 * ║                                                                           ║
 * ║  职责：收口消息项渲染需要的角色与消息 Interface                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { RenderIntent } from "@/lib/story-agent/render-intent";

export interface Message {
  id: string;
  role: string;
  thinkingContent?: string;
  content: string;
  name?: string;
  compact?: boolean;
  hidden?: boolean;
  timestamp?: string;
  isUser?: boolean;
  swipe?: { activeIndex: number; total: number };
}

export interface MessageCharacter {
  id: string;
  name: string;
  avatar_path?: string;
  extensions?: {
    storyRenderIntents?: RenderIntent[];
    [key: string]: unknown;
  };
}

export type MessageRoleKind = "assistant" | "system" | "narrator" | "custom";
