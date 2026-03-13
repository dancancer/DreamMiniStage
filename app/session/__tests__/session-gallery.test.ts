import { afterEach, describe, expect, it, vi } from "vitest";
import type { DialogueMessage } from "@/types/character-dialogue";

describe("session-gallery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("collects current character avatar plus unique image urls from session messages", async () => {
    const { listSessionGalleryItems } = await import("../session-gallery");

    const messages: DialogueMessage[] = [
      {
        id: "m1",
        role: "assistant",
        content: "Look ![scene](https://img.example/scene.png)",
      },
      {
        id: "m2",
        role: "user",
        content: "and this https://cdn.example/portrait.jpg",
      },
      {
        id: "m3",
        role: "assistant",
        content: "duplicate https://cdn.example/portrait.jpg",
      },
    ];

    await expect(listSessionGalleryItems({
      id: "char-1",
      name: "Alice",
      avatarPath: "/alice.png",
      openingMessages: [{
        id: "o1",
        content: "opening https://img.example/opening.webp",
      }],
      messages,
    })).resolves.toEqual([
      { src: "/alice.png", ephemeral: false },
      { src: "https://img.example/opening.webp", ephemeral: false },
      { src: "https://img.example/scene.png", ephemeral: false },
      { src: "https://cdn.example/portrait.jpg", ephemeral: false },
    ]);
  });

  it("resolves local avatar blob keys before exposing gallery items", async () => {
    vi.mock("@/lib/data/local-storage", () => ({
      getBlob: vi.fn().mockResolvedValue(new Blob(["avatar"], { type: "image/png" })),
    }));

    const createObjectURL = vi.fn().mockReturnValue("blob:avatar-local");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });

    const { listSessionGalleryItems } = await import("../session-gallery");

    await expect(listSessionGalleryItems({
      id: "char-1",
      name: "Alice",
      avatarPath: "char-1.png",
      messages: [],
    })).resolves.toEqual([{ src: "blob:avatar-local", ephemeral: true }]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("still fails fast for unsupported group gallery targets", async () => {
    const { listSessionGalleryItems } = await import("../session-gallery");

    await expect(listSessionGalleryItems({
      id: "char-1",
      name: "Alice",
      avatarPath: "/alice.png",
      messages: [],
    }, {
      group: "Raid Party",
    })).rejects.toThrow("/show-gallery group gallery is not available in /session yet");
  });
});
