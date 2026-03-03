import type { ApiCallContext } from "@/hooks/script-bridge/types";
import type {
  AudioChannelSnapshot,
  AudioChannelType,
  ExecutionContext,
} from "@/lib/slash-command/types";

interface RuntimeAudioChannel extends AudioChannelSnapshot {
  volume: number;
}

export const emptyVariableSnapshot = {
  global: {},
  preset: {},
  character: {},
  chat: {},
  message: {},
  script: {},
};

export function createApiContext(iframeId: string): ApiCallContext {
  return {
    iframeId,
    characterId: "p4-character",
    dialogueId: "p4-dialogue",
    chatId: "p4-dialogue",
    messages: [
      { id: "m0", role: "user", content: "hello" },
      { id: "m1", role: "assistant", content: "world" },
    ],
    setScriptVariable: () => undefined,
    deleteScriptVariable: () => undefined,
    getVariablesSnapshot: () => ({
      global: {},
      character: {},
    }),
  };
}

export function createAudioContext(): { ctx: ExecutionContext; channels: Record<AudioChannelType, RuntimeAudioChannel> } {
  const variables = new Map<string, unknown>();
  const channels: Record<AudioChannelType, RuntimeAudioChannel> = {
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
    onSend: async () => undefined,
    onTrigger: async () => undefined,
    getVariable: (key) => variables.get(key),
    setVariable: (key, value) => variables.set(key, value),
    deleteVariable: (key) => variables.delete(key),

    playAudioByType: async (type, track) => {
      if (track?.url) {
        ensureTrack(type, track.url);
        channels[type].currentUrl = track.url;
      } else if (!channels[type].currentUrl) {
        channels[type].currentUrl = channels[type].playlist[0]?.url ?? null;
      }
      channels[type].isPlaying = channels[type].currentUrl !== null;
    },
    pauseAudioByType: async (type) => {
      channels[type].isPlaying = false;
    },
    stopAudioByType: async (type) => {
      channels[type].isPlaying = false;
      channels[type].currentUrl = null;
    },
    setAudioEnabledByType: async (type, enabled) => {
      channels[type].enabled = enabled;
      if (!enabled) {
        channels[type].isPlaying = false;
      }
    },
    setAudioModeByType: async (type, mode) => {
      channels[type].mode = mode;
    },
    getAudioListByType: (type) => channels[type].playlist.map((track) => ({ ...track })),
    replaceAudioListByType: async (type, list) => {
      channels[type].playlist = list.map((track) => ({ ...track }));
      if (!channels[type].playlist.some((track) => track.url === channels[type].currentUrl)) {
        channels[type].currentUrl = null;
        channels[type].isPlaying = false;
      }
    },
    appendAudioListByType: async (type, list) => {
      for (const track of list) {
        ensureTrack(type, track.url);
      }
    },
    getAudioStateByType: (type) => ({ ...channels[type] }),
    setAudioVolume: async (volume) => {
      for (const channel of Object.values(channels)) {
        channel.volume = volume;
      }
    },
  };

  return { ctx, channels };
}
