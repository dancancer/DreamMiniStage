import { describe, expect, it, vi } from "vitest";

import { createMinimalContext, executeSlashCommandScript } from "../executor";
import type { AudioChannelSnapshot, AudioChannelType, ExecutionContext } from "../types";

type RuntimeChannelState = AudioChannelSnapshot & { volume: number };

function createAudioContext(): {
  ctx: ExecutionContext;
  channels: Record<AudioChannelType, RuntimeChannelState>;
  } {
  const variables = new Map<string, unknown>();
  const channels: Record<AudioChannelType, RuntimeChannelState> = {
    bgm: {
      enabled: true,
      mode: "repeat",
      currentUrl: null,
      playlist: [],
      isPlaying: false,
      volume: 1,
    },
    ambient: {
      enabled: true,
      mode: "repeat",
      currentUrl: null,
      playlist: [],
      isPlaying: false,
      volume: 1,
    },
  };

  const ensureTrack = (type: AudioChannelType, url: string): void => {
    if (!channels[type].playlist.some((track) => track.url === url)) {
      channels[type].playlist.push({ url, title: url });
    }
  };

  const ctx: ExecutionContext = {
    messages: [],
    onSend: vi.fn().mockResolvedValue(undefined),
    onTrigger: vi.fn().mockResolvedValue(undefined),
    getVariable: (key) => variables.get(key),
    setVariable: (key, value) => variables.set(key, value),
    deleteVariable: (key) => variables.delete(key),

    playAudioByType: vi.fn((type: AudioChannelType, track?: { url: string; title?: string }) => {
      if (track?.url) {
        ensureTrack(type, track.url);
        channels[type].currentUrl = track.url;
      } else if (!channels[type].currentUrl) {
        channels[type].currentUrl = channels[type].playlist[0]?.url ?? null;
      }
      channels[type].isPlaying = channels[type].currentUrl !== null;
    }),
    pauseAudioByType: vi.fn((type: AudioChannelType) => {
      channels[type].isPlaying = false;
    }),
    stopAudioByType: vi.fn((type: AudioChannelType) => {
      channels[type].isPlaying = false;
      channels[type].currentUrl = null;
    }),
    setAudioEnabledByType: vi.fn((type: AudioChannelType, enabled: boolean) => {
      channels[type].enabled = enabled;
      if (!enabled) {
        channels[type].isPlaying = false;
      }
    }),
    setAudioModeByType: vi.fn((type: AudioChannelType, mode: AudioChannelSnapshot["mode"]) => {
      channels[type].mode = mode;
    }),
    getAudioListByType: vi.fn((type: AudioChannelType) => {
      return channels[type].playlist.map((track) => ({ ...track }));
    }),
    replaceAudioListByType: vi.fn((type: AudioChannelType, list: Array<{ url: string; title?: string }>) => {
      channels[type].playlist = list.map((track) => ({ ...track }));
      if (!channels[type].playlist.some((track) => track.url === channels[type].currentUrl)) {
        channels[type].currentUrl = null;
        channels[type].isPlaying = false;
      }
    }),
    appendAudioListByType: vi.fn((type: AudioChannelType, list: Array<{ url: string; title?: string }>) => {
      for (const track of list) {
        ensureTrack(type, track.url);
      }
    }),
    getAudioStateByType: vi.fn((type: AudioChannelType) => ({ ...channels[type] })),
    setAudioVolume: vi.fn((volume: number) => {
      for (const channel of Object.values(channels)) {
        channel.volume = volume;
      }
    }),
  };

  return { ctx, channels };
}

describe("JS-Slash-Runner audio semantics", () => {
  it("aligns /audiomode with repeat/random/single/stop enum", async () => {
    const { ctx, channels } = createAudioContext();

    const result = await executeSlashCommandScript("/audiomode type=ambient mode=random", ctx);

    expect(result.isError).toBe(false);
    expect(channels.ambient.mode).toBe("random");
    expect(channels.bgm.mode).toBe("repeat");
  });

  it("imports multiple URLs and respects play=false", async () => {
    const { ctx, channels } = createAudioContext();

    const result = await executeSlashCommandScript(
      "/audioimport type=bgm play=false https://a.example/1.mp3,https://a.example/2.mp3",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(channels.bgm.playlist.map((track) => track.url)).toEqual([
      "https://a.example/1.mp3",
      "https://a.example/2.mp3",
    ]);
    expect(channels.bgm.isPlaying).toBe(false);
  });

  it("selects URL and starts playback even when URL was not imported", async () => {
    const { ctx, channels } = createAudioContext();

    const result = await executeSlashCommandScript(
      "/audioselect type=ambient https://a.example/amb.mp3",
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(channels.ambient.playlist.map((track) => track.url)).toEqual([
      "https://a.example/amb.mp3",
    ]);
    expect(channels.ambient.currentUrl).toBe("https://a.example/amb.mp3");
    expect(channels.ambient.isPlaying).toBe(true);
  });

  it("toggles play/pause state with /audioplay play=true|false", async () => {
    const { ctx, channels } = createAudioContext();

    await executeSlashCommandScript(
      "/audioimport type=bgm https://a.example/main.mp3",
      ctx,
    );
    expect(channels.bgm.isPlaying).toBe(true);

    await executeSlashCommandScript("/audioplay type=bgm play=false", ctx);
    expect(channels.bgm.isPlaying).toBe(false);

    await executeSlashCommandScript("/audioplay type=bgm", ctx);
    expect(channels.bgm.isPlaying).toBe(true);
  });

  it("keeps legacy /audioplaypause semantics aligned with /audioplay", async () => {
    const { ctx, channels } = createAudioContext();

    await executeSlashCommandScript(
      "/audioimport type=bgm https://a.example/main.mp3",
      ctx,
    );
    expect(channels.bgm.isPlaying).toBe(true);

    await executeSlashCommandScript("/audioplaypause type=bgm play=false", ctx);
    expect(channels.bgm.isPlaying).toBe(false);

    await executeSlashCommandScript("/audioplaypause type=bgm", ctx);
    expect(channels.bgm.isPlaying).toBe(true);
  });

  it("fails fast when host audio callbacks are missing", async () => {
    const ctx = createMinimalContext();

    const playResult = await executeSlashCommandScript("/audioplay type=bgm", ctx);
    const importResult = await executeSlashCommandScript(
      "/audioimport type=bgm https://a.example/missing-callback.mp3",
      ctx,
    );

    expect(playResult.isError).toBe(true);
    expect(playResult.errorMessage).toContain("/audioplay is not available in current context");
    expect(importResult.isError).toBe(true);
    expect(importResult.errorMessage).toContain("/audioimport is not available in current context");
  });
});
