/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║            JS-Slash-Runner 兼容命令                                       ║
 * ║                                                                           ║
 * ║  移植自 SillyTavern JS-Slash-Runner 插件：                                 ║
 * ║  • /event-emit        - 发送事件                                          ║
 * ║  • /audioenable       - 启用/禁用音频通道                                  ║
 * ║  • /audioplay         - 播放/暂停当前通道                                  ║
 * ║  • /audioimport       - 导入音频链接                                      ║
 * ║  • /audioselect       - 选择并播放指定链接                                 ║
 * ║  • /audiomode         - 设置通道模式（repeat/random/single/stop）         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import type { CommandHandler } from "../types";
import type { AudioChannelType, AudioChannelSnapshot, ExecutionContext } from "../../types";

// ============================================================================
//                              音频系统状态
// ============================================================================

type RunnerAudioMode = AudioChannelSnapshot["mode"];
type AudioTrack = { url: string; title?: string };

interface FallbackAudioState {
  enabled: boolean;
  mode: RunnerAudioMode;
  currentUrl: string | null;
  playlist: AudioTrack[];
  isPlaying: boolean;
  volume: number;
}

const audioState: Record<AudioChannelType, FallbackAudioState> = {
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

function parseAudioType(raw: unknown): AudioChannelType | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "bgm" || value === "ambient") return value;
  return undefined;
}

function parseAudioMode(raw: unknown): RunnerAudioMode | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "repeat" || value === "random" || value === "single" || value === "stop") {
    return value;
  }
  return undefined;
}

function parseBoolean(raw: unknown, fallback: boolean): boolean {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "on" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "off" || value === "no") return false;
  return fallback;
}

function parseCommaSeparatedUrls(raw: string): string[] {
  const dedupe = new Set<string>();
  for (const token of raw.split(",")) {
    const url = token.trim();
    if (url !== "") {
      dedupe.add(url);
    }
  }
  return Array.from(dedupe);
}

function resolveAudioType(
  args: string[],
  namedArgs: Record<string, string>,
): { type?: AudioChannelType; restArgs: string[] } {
  const namedType = parseAudioType(namedArgs.type);
  if (namedType) {
    return { type: namedType, restArgs: args };
  }

  const positionalType = parseAudioType(args[0]);
  if (positionalType) {
    return { type: positionalType, restArgs: args.slice(1) };
  }

  return { type: undefined, restArgs: args };
}

function getAudioList(ctx: ExecutionContext, type: AudioChannelType): AudioTrack[] {
  if (ctx.getAudioListByType) {
    return ctx.getAudioListByType(type).map((track) => ({ url: track.url, title: track.title }));
  }
  return [...audioState[type].playlist];
}

async function appendAudioList(ctx: ExecutionContext, type: AudioChannelType, tracks: AudioTrack[]): Promise<void> {
  if (tracks.length === 0) return;
  if (ctx.appendAudioListByType) {
    await ctx.appendAudioListByType(type, tracks);
  }

  const existing = new Set(audioState[type].playlist.map((track) => track.url));
  for (const track of tracks) {
    if (!existing.has(track.url)) {
      audioState[type].playlist.push(track);
      existing.add(track.url);
    }
  }
}

async function replaceAudioList(ctx: ExecutionContext, type: AudioChannelType, tracks: AudioTrack[]): Promise<void> {
  if (ctx.replaceAudioListByType) {
    await ctx.replaceAudioListByType(type, tracks);
  }
  audioState[type].playlist = [...tracks];
}

function markAudioPlaying(type: AudioChannelType, playing: boolean): void {
  audioState[type].isPlaying = playing;
  if (!playing) {
    return;
  }

  if (!audioState[type].currentUrl) {
    audioState[type].currentUrl = audioState[type].playlist[0]?.url ?? null;
  }
}

function markAudioTrack(type: AudioChannelType, url: string): void {
  audioState[type].currentUrl = url;
  audioState[type].isPlaying = true;
}

// ============================================================================
//                              事件命令
// ============================================================================

/**
 * /event-emit <eventName> [data]
 * 发送自定义事件
 *
 * 参数：
 * - eventName: 事件名称
 * - data: JSON 格式的事件数据（可选）
 *
 * 示例：
 * /event-emit my_event {"key": "value"}
 */
export const handleEventEmit: CommandHandler = async (args, namedArgs, _ctx, pipe) => {
  if (args.length === 0) {
    console.warn("[/event-emit] Missing event name");
    return pipe;
  }

  const eventName = args[0];
  let eventData: unknown = {};

  // 解析事件数据
  if (args.length > 1) {
    const dataStr = args.slice(1).join(" ");
    try {
      eventData = JSON.parse(dataStr);
    } catch {
      // 非 JSON 字符串，作为纯文本
      eventData = { text: dataStr };
    }
  }

  // 添加命名参数
  if (Object.keys(namedArgs).length > 0) {
    eventData = { ...(eventData as object), ...namedArgs };
  }

  // 发送事件
  if (typeof window !== "undefined") {
    // 1. 广播到所有 iframe 沙箱
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:broadcast", {
        detail: { eventName, data: eventData },
      }),
    );

    // 2. 在主窗口触发命名事件
    window.dispatchEvent(
      new CustomEvent(`DreamMiniStage:${eventName}`, {
        detail: eventData,
      }),
    );

    console.log(`[/event-emit] Emitted: ${eventName}`, eventData);
  }

  return pipe;
};

// ============================================================================
//                              音频命令
// ============================================================================

/**
 * /audioenable type=bgm|ambient [state=true|false]
 */
export const handleAudioEnable: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  if (!type) {
    console.warn("[/audioenable] Missing or invalid type, expected bgm|ambient");
    return pipe;
  }

  const enabled = parseBoolean(namedArgs.state ?? restArgs[0], true);

  if (ctx.setAudioEnabledByType) {
    await ctx.setAudioEnabledByType(type, enabled);
  } else if (type === "bgm" && !enabled) {
    await ctx.stopAudio?.();
  }

  audioState[type].enabled = enabled;
  if (!enabled) {
    audioState[type].isPlaying = false;
  }

  return pipe;
};

/**
 * /audioplay type=bgm|ambient [play=true|false]
 */
export const handleAudioPlay: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  if (!type) {
    console.warn("[/audioplay] Missing or invalid type, expected bgm|ambient");
    return pipe;
  }

  if (!audioState[type].enabled) {
    console.warn("[/audioplay] Audio channel is disabled");
    return pipe;
  }

  const shouldPlay = parseBoolean(namedArgs.play ?? restArgs[0], true);

  if (!shouldPlay) {
    if (ctx.pauseAudioByType) {
      await ctx.pauseAudioByType(type);
    } else if (type === "bgm") {
      await ctx.pauseAudio?.();
    }
    markAudioPlaying(type, false);
    return pipe;
  }

  if (ctx.playAudioByType) {
    await ctx.playAudioByType(type);
  } else if (type === "bgm") {
    const url = audioState[type].currentUrl ?? audioState[type].playlist[0]?.url;
    if (url && ctx.playAudio) {
      await ctx.playAudio(url, { volume: audioState[type].volume });
    } else {
      await ctx.resumeAudio?.();
    }
  }

  markAudioPlaying(type, true);
  return pipe;
};

/**
 * /audioimport type=bgm|ambient [play=true|false] <url[,url2,...]>
 */
export const handleAudioImport: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  if (!type) {
    console.warn("[/audioimport] Missing or invalid type, expected bgm|ambient");
    return pipe;
  }

  const rawUrls = namedArgs.url ?? restArgs.join(" ");
  if (!rawUrls) {
    console.warn("[/audioimport] Missing URL");
    return pipe;
  }

  const urls = parseCommaSeparatedUrls(rawUrls);
  const existing = new Set(getAudioList(ctx, type).map((track) => track.url));
  const newTracks = urls
    .filter((url) => !existing.has(url))
    .map((url) => ({ url, title: url }));

  if (newTracks.length === 0) {
    console.warn("[/audioimport] Invalid or duplicate URLs");
    return pipe;
  }

  await appendAudioList(ctx, type, newTracks);

  const shouldPlay = parseBoolean(namedArgs.play, true);
  if (!shouldPlay) {
    return pipe;
  }

  if (ctx.playAudioByType) {
    await ctx.playAudioByType(type, newTracks[0]);
  } else if (type === "bgm" && ctx.playAudio) {
    await ctx.playAudio(newTracks[0].url, { volume: audioState[type].volume });
  }

  markAudioTrack(type, newTracks[0].url);
  return pipe;
};

/**
 * /audioselect type=bgm|ambient <url>
 */
export const handleAudioSelect: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  if (!type) {
    console.warn("[/audioselect] Missing or invalid type, expected bgm|ambient");
    return pipe;
  }

  const positionalUrl = restArgs.join(" ");
  const url = namedArgs.url ?? (positionalUrl || pipe);
  if (!url) {
    console.warn("[/audioselect] Missing URL");
    return pipe;
  }

  const existing = getAudioList(ctx, type);
  if (!existing.some((track) => track.url === url)) {
    await appendAudioList(ctx, type, [{ url, title: url }]);
  }

  if (ctx.playAudioByType) {
    await ctx.playAudioByType(type, { url, title: url });
  } else if (type === "bgm" && ctx.playAudio) {
    await ctx.playAudio(url, { volume: audioState[type].volume });
  }

  markAudioTrack(type, url);
  return pipe;
};

/**
 * /audiomode type=bgm|ambient mode=repeat|random|single|stop
 */
export const handleAudioMode: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  if (!type) {
    console.warn("[/audiomode] Missing or invalid type, expected bgm|ambient");
    return pipe;
  }

  const mode = parseAudioMode(namedArgs.mode ?? restArgs[0]);
  if (!mode) {
    console.warn("[/audiomode] Invalid mode. Valid: repeat, random, single, stop");
    return pipe;
  }

  if (ctx.setAudioModeByType) {
    await ctx.setAudioModeByType(type, mode);
  }
  audioState[type].mode = mode;

  return pipe;
};

// ============================================================================
//                              辅助音频命令
// ============================================================================

/**
 * /audiopause [type=bgm|ambient] - 暂停音频
 */
export const handleAudioPause: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type } = resolveAudioType(args, namedArgs);
  const channel = type ?? "bgm";

  if (ctx.pauseAudioByType) {
    await ctx.pauseAudioByType(channel);
  } else if (channel === "bgm") {
    await ctx.pauseAudio?.();
  }

  markAudioPlaying(channel, false);
  return pipe;
};

/**
 * /audioresume [type=bgm|ambient] - 恢复音频
 */
export const handleAudioResume: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type } = resolveAudioType(args, namedArgs);
  const channel = type ?? "bgm";

  if (ctx.playAudioByType) {
    await ctx.playAudioByType(channel);
  } else if (channel === "bgm") {
    await ctx.resumeAudio?.();
  }

  markAudioPlaying(channel, true);
  return pipe;
};

/**
 * /audiostop [type=bgm|ambient] - 停止音频
 */
export const handleAudioStop: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type } = resolveAudioType(args, namedArgs);
  const channel = type ?? "bgm";

  if (ctx.stopAudioByType) {
    await ctx.stopAudioByType(channel);
  } else if (channel === "bgm") {
    await ctx.stopAudio?.();
  }

  audioState[channel].currentUrl = null;
  audioState[channel].isPlaying = false;
  return pipe;
};

/**
 * /audiovolume <volume> - 设置音量
 */
export const handleAudioVolume: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const volumeStr = args[0] || namedArgs.volume;
  if (!volumeStr) {
    return String(audioState.bgm.volume);
  }

  const volume = Math.max(0, Math.min(1, parseFloat(volumeStr)));
  if (!Number.isFinite(volume)) {
    return pipe;
  }

  for (const channel of Object.values(audioState)) {
    channel.volume = volume;
  }

  await ctx.setAudioVolume?.(volume);
  return pipe;
};

/**
 * /audioqueue [type=bgm|ambient] <url> - 添加音频到播放列表
 */
export const handleAudioQueue: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type, restArgs } = resolveAudioType(args, namedArgs);
  const channel = type ?? "bgm";
  const url = namedArgs.url ?? restArgs[0] ?? pipe;

  if (!url) {
    return JSON.stringify(audioState[channel].playlist.map((track) => track.url));
  }

  await appendAudioList(ctx, channel, [{ url, title: url }]);
  return pipe;
};

/**
 * /audioclear [type=bgm|ambient] - 清空播放列表
 */
export const handleAudioClear: CommandHandler = async (args, namedArgs, ctx, pipe) => {
  const { type } = resolveAudioType(args, namedArgs);
  const channel = type ?? "bgm";

  await replaceAudioList(ctx, channel, []);
  audioState[channel].currentUrl = null;
  audioState[channel].isPlaying = false;

  if (ctx.stopAudioByType) {
    await ctx.stopAudioByType(channel);
  } else if (channel === "bgm") {
    await ctx.stopAudio?.();
  }

  return pipe;
};
