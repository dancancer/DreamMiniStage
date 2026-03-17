import type { ContentSegment } from "@/types/content-segment";

export type MessageRenderPhase = "preview" | "transition" | "parsed";

export interface MessageRenderPipelineState {
  phase: MessageRenderPhase;
  isParsing: boolean;
  displayHtml: string;
  segments: ContentSegment[];
}
