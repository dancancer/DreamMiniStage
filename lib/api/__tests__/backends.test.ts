import { afterEach, describe, expect, it, vi } from "vitest";

import { AnthropicClient } from "@/lib/api/backends";

describe("AnthropicClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards stop_sequences in chatStream requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    } as unknown as Response);

    const client = new AnthropicClient({
      type: "anthropic",
      apiKey: "test-key",
      apiUrl: "https://api.anthropic.test",
    });

    const stream = client.chatStream({
      model: "claude-3-7-sonnet",
      messages: [{ role: "user", content: "hello" }],
      stop: ["END"],
    });

    await stream.next();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.stop_sequences).toEqual(["END"]);
  });
});
