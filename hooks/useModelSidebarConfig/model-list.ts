import type { LLMType } from "@/lib/model-runtime";

function assertModelListRequest(type: LLMType, targetUrl: string, targetKey: string): void {
  if ((type === "openai" && (!targetUrl || !targetKey)) || (type === "gemini" && !targetKey)) {
    throw new Error("Missing model list credentials");
  }
}

export async function fetchModelList(
  type: LLMType,
  targetUrl: string,
  targetKey: string,
): Promise<string[]> {
  assertModelListRequest(type, targetUrl, targetKey);

  if (type === "openai") {
    const response = await fetch(`${targetUrl}/models`, {
      headers: { Authorization: `Bearer ${targetKey}` },
    });
    return (await response.json()).data?.map((item: { id: string }) => item.id) || [];
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
  const data = await response.json();
  return data.models
    ?.map((item: { name?: string }) => item.name?.replace(/^models\//, "") || "")
    .filter(Boolean) || [];
}
