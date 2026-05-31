import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveModelGatewayProviderConfig } from "@/lib/model-gateway/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GatewayChatRequest {
  model?: string;
  messages?: Array<{ role?: unknown; content?: unknown }>;
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  max_tokens?: number;
  stop?: string[];
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as GatewayChatRequest;
    const provider = resolveModelGatewayProviderConfig(process.env, readLocalEnv());
    const upstreamBody = buildUpstreamBody(body, provider.modelName);
    const upstream = await fetch(chatCompletionsUrl(provider.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function buildUpstreamBody(
  body: GatewayChatRequest,
  defaultModel?: string,
): Record<string, unknown> {
  const messages = normalizeMessages(body.messages);
  if (messages.length === 0) {
    throw new Error("messages[] is required");
  }

  return stripUndefined({
    model: body.model || defaultModel,
    messages,
    stream: body.stream === true,
    stream_options: body.stream && body.stream_options?.include_usage ? { include_usage: true } : undefined,
    max_tokens: finiteNumber(body.max_tokens),
    stop: Array.isArray(body.stop) ? body.stop : undefined,
  });
}

function normalizeMessages(
  messages: GatewayChatRequest["messages"],
): Array<{ role: string; content: string }> {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => ({
      role: String(message.role || ""),
      content: String(message.content || ""),
    }))
    .filter((message) => message.role && message.content);
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
}

function readLocalEnv(): string {
  try {
    return readFileSync(join(process.cwd(), ".env"), "utf8");
  } catch {
    return "";
  }
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Model gateway request failed";
  const status = message === "messages[] is required" ? 400 : 500;
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
