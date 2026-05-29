import type { TextTransform } from "@/lib/story-agent/blueprint";

export interface TextTransformResult {
  text: string;
  appliedTransformIds: string[];
}

export function applyTextTransforms(
  text: string,
  transforms: TextTransform[],
): TextTransformResult {
  return transforms.reduce<TextTransformResult>((result, transform) => {
    if (!transform.enabled) return result;
    const regex = compileRegex(transform.pattern);
    if (!regex) return result;
    const nextText = result.text.replace(regex, transform.replacement);
    if (nextText === result.text) return result;
    return {
      text: nextText,
      appliedTransformIds: [...result.appliedTransformIds, transform.id],
    };
  }, {
    text,
    appliedTransformIds: [],
  });
}

function compileRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "g");
  } catch {
    return undefined;
  }
}
