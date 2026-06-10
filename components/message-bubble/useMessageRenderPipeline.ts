"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseContent, parseContentAsync } from "@/lib/utils/content-parser";
import type { ContentSegment } from "@/types/content-segment";
import type { MessageRenderPipelineState } from "./render-types";

interface UseMessageRenderPipelineInput {
  html: string;
  characterId?: string;
  enableStreaming: boolean;
  renderMode: "story" | "legacy";
}

export function useMessageRenderPipeline(
  input: UseMessageRenderPipelineInput,
): MessageRenderPipelineState {
  const { html, characterId, enableStreaming, renderMode } = input;
  const [segments, setSegments] = useState<ContentSegment[]>([]);
  const [isParsing, setIsParsing] = useState(true);
  const [isTransitioningFromStreaming, setIsTransitioningFromStreaming] = useState(false);
  const previousStreamingRef = useRef(enableStreaming);

  useEffect(() => {
    if (previousStreamingRef.current && !enableStreaming) {
      setIsTransitioningFromStreaming(true);
    }
    if (enableStreaming) {
      setIsTransitioningFromStreaming(false);
    }
    previousStreamingRef.current = enableStreaming;
  }, [enableStreaming]);

  useEffect(() => {
    if (enableStreaming) {
      setIsParsing(false);
      return;
    }

    let cancelled = false;

    async function parse() {
      setIsParsing(true);
      const result = renderMode === "story"
        ? parseContent(html)
        : await parseContentAsync(html, characterId);
      if (!cancelled) {
        setSegments(result);
        setIsParsing(false);
        setIsTransitioningFromStreaming(false);
      }
    }

    parse();

    return () => {
      cancelled = true;
    };
  }, [characterId, enableStreaming, html, renderMode]);

  return useMemo(() => {
    if (enableStreaming) {
      return {
        phase: "preview",
        isParsing: false,
        displayHtml: html,
        segments,
      };
    }

    if (isTransitioningFromStreaming && isParsing && html.trim() !== "") {
      return {
        phase: "transition",
        isParsing: true,
        displayHtml: html,
        segments,
      };
    }

    return {
      phase: "parsed",
      isParsing,
      displayHtml: html,
      segments,
    };
  }, [enableStreaming, html, isParsing, isTransitioningFromStreaming, segments]);
}
