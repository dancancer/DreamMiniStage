import type { GenerationEvent } from "@/lib/generation-runtime/types";
import { parseLegacyDialogueResponsePayload } from "./legacy-dialogue-response";

export type DialogueTransportResult =
  | { kind: "streaming" }
  | { kind: "complete"; event: Extract<GenerationEvent, { type: "complete" }> }
  | { kind: "error"; event: Extract<GenerationEvent, { type: "error" }> };

export function isStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/event-stream");
}

export async function resolveLegacyDialogueTransport(
  response: Response,
): Promise<DialogueTransportResult> {
  if (isStreamingResponse(response)) {
    return { kind: "streaming" };
  }

  const parsed = parseLegacyDialogueResponsePayload(await response.json());
  if (parsed?.type === "complete") {
    return { kind: "complete", event: parsed };
  }

  return {
    kind: "error",
    event: parsed?.type === "error"
      ? parsed
      : { type: "error", message: "请检查网络连接或 API 配置" },
  };
}
