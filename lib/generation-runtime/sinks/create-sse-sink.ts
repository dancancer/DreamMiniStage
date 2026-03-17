import { formatSSEData, formatSSEDone } from "@/lib/streaming";
import type { DialogueGenerationSink } from "@/lib/generation-runtime/run-dialogue-generation";
import type { GenerationEvent } from "@/lib/generation-runtime/types";
import { toLegacySsePayload } from "@/lib/generation-runtime/transport/legacy-dialogue-response";

interface CreateSseSinkInput {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}

export function createSseSink(
  input: CreateSseSinkInput,
): DialogueGenerationSink {
  const { controller, encoder } = input;

  return {
    emit: (event: GenerationEvent) => {
      const payload = toLegacySsePayload(event);
      if (!payload) {
        return;
      }

      controller.enqueue(encoder.encode(formatSSEData(payload)));

      if (event.type === "complete") {
        controller.enqueue(encoder.encode(formatSSEDone()));
        controller.close();
        return;
      }

      if (event.type === "error") {
        controller.enqueue(encoder.encode(formatSSEDone()));
        controller.close();
      }
    },
  };
}
