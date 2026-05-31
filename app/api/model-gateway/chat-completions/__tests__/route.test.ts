import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/model-gateway/chat-completions/route";

describe("model gateway chat completions route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards chat completions with server-side provider credentials", async () => {
    vi.stubEnv("MODEL_GATEWAY_API_KEY", "server-key");
    vi.stubEnv("MODEL_GATEWAY_BASE_URL", "https://provider.example/v1");
    const fetchMock = vi.fn(async () => Response.json({
      choices: [{ message: { content: "Hello" } }],
    }, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/model-gateway/chat-completions", {
      method: "POST",
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: "hello" }],
        stream: false,
        max_tokens: 8192,
      }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      choices: [{ message: { content: "Hello" } }],
    });
    expect(fetchMock).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer server-key",
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        messages: [{ role: "user", content: "hello" }],
        stream: false,
        max_tokens: 8192,
      }),
    });
  });

  it("rejects requests without model messages", async () => {
    vi.stubEnv("MODEL_GATEWAY_API_KEY", "server-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new Request("http://localhost/api/model-gateway/chat-completions", {
      method: "POST",
      body: JSON.stringify({ model: "deepseek-v4-pro" }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "messages[] is required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
