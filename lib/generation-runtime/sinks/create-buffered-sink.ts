import type { DialogueGenerationSink } from "@/lib/generation-runtime/run-dialogue-generation";
import type { GenerationEvent } from "@/lib/generation-runtime/types";
import { toLegacyBufferedPayload } from "@/lib/generation-runtime/transport/legacy-dialogue-response";

type BufferedResult = ReturnType<typeof toLegacyBufferedPayload>;

interface BufferedSink extends DialogueGenerationSink {
  getResult: () => BufferedResult;
}

export function createBufferedSink(): BufferedSink {
  let result: BufferedResult = null;

  return {
    emit: (event: GenerationEvent) => {
      const payload = toLegacyBufferedPayload(event);
      if (payload) {
        result = payload;
      }
    },
    getResult: () => result,
  };
}
