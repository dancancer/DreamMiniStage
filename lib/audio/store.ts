/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Audio Store (Howler.js)                            ║
 * ║                                                                            ║
 * ║  基于 Howler.js 的音频状态管理                                             ║
 * ║  支持 BGM 和环境音两个独立通道                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { Howl, Howler } from "howler";

// ============================================================================
//                              类型定义
// ============================================================================

export interface AudioTrack {
  title?: string;
  url: string;
}

export type AudioMode = "repeat" | "random" | "single" | "stop";

export interface AudioChannelState {
  enabled: boolean;
  mode: AudioMode;
  volume: number;
  muted: boolean;
  currentUrl: string | null;
  playlist: AudioTrack[];
  currentIndex: number;
  isPlaying: boolean;
}

export interface AudioSettings {
  enabled: boolean;
  mode: AudioMode;
  volume: number;
  muted: boolean;
}

// ============================================================================
//                              音频通道管理
// ============================================================================

class AudioChannel {
  private state: AudioChannelState;
  private howl: Howl | null = null;
  private type: "bgm" | "ambient";

  constructor(type: "bgm" | "ambient") {
    this.type = type;
    this.state = {
      enabled: true,
      mode: "repeat",
      volume: 0.5,
      muted: false,
      currentUrl: null,
      playlist: [],
      currentIndex: 0,
      isPlaying: false,
    };
  }

  // ─── 播放控制 ───

  play(audio?: AudioTrack): void {
    if (!this.state.enabled) return;

    // 如果提供了新音频，先添加到列表并切换
    if (audio?.url) {
      const existingIndex = this.state.playlist.findIndex((t) => t.url === audio.url);
      if (existingIndex >= 0) {
        this.state.currentIndex = existingIndex;
      } else {
        this.state.playlist.push(audio);
        this.state.currentIndex = this.state.playlist.length - 1;
      }
      this.loadAndPlay(audio.url);
      return;
    }

    // 恢复播放当前音频
    if (this.howl && !this.state.isPlaying) {
      this.howl.play();
      this.state.isPlaying = true;
    } else if (this.state.playlist.length > 0) {
      const track = this.state.playlist[this.state.currentIndex];
      if (track) this.loadAndPlay(track.url);
    }
  }

  pause(): void {
    if (this.howl) {
      this.howl.pause();
      this.state.isPlaying = false;
    }
  }

  stop(): void {
    if (this.howl) {
      this.howl.stop();
      this.state.isPlaying = false;
    }
  }

  // ─── 播放列表 ───

  getPlaylist(): AudioTrack[] {
    return [...this.state.playlist];
  }

  setPlaylist(tracks: AudioTrack[]): void {
    this.state.playlist = tracks;
    this.state.currentIndex = 0;
  }

  appendPlaylist(tracks: AudioTrack[]): void {
    this.state.playlist.push(...tracks);
  }

  // ─── 设置 ───

  getSettings(): AudioSettings {
    return {
      enabled: this.state.enabled,
      mode: this.state.mode,
      volume: this.state.volume,
      muted: this.state.muted,
    };
  }

  setSettings(settings: Partial<AudioSettings>): void {
    if (settings.enabled !== undefined) this.state.enabled = settings.enabled;
    if (settings.mode !== undefined) this.state.mode = settings.mode;
    if (settings.volume !== undefined) {
      this.state.volume = Math.max(0, Math.min(1, settings.volume));
      if (this.howl) this.howl.volume(this.state.volume);
    }
    if (settings.muted !== undefined) {
      this.state.muted = settings.muted;
      if (this.howl) this.howl.mute(this.state.muted);
    }
  }

  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (!enabled) this.stop();
  }

  setMode(mode: AudioMode): void {
    this.state.mode = mode;
  }

  // ─── 内部方法 ───

  private loadAndPlay(url: string): void {
    // 清理旧实例
    if (this.howl) {
      this.howl.unload();
    }

    this.state.currentUrl = url;
    this.howl = new Howl({
      src: [url],
      volume: this.state.volume,
      loop: this.state.mode === "repeat" || this.state.mode === "single",
      mute: this.state.muted,
      onend: () => this.onTrackEnd(),
      onloaderror: (_id, err) => {
        console.error(`[AudioChannel:${this.type}] 加载失败:`, url, err);
      },
    });

    this.howl.play();
    this.state.isPlaying = true;
  }

  private onTrackEnd(): void {
    if (this.state.mode === "single" || this.state.mode === "repeat") {
      return; // loop 属性处理
    }

    if (this.state.mode === "stop") {
      this.state.isPlaying = false;
      return;
    }

    // random 或播放下一首
    if (this.state.playlist.length <= 1) return;

    if (this.state.mode === "random") {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * this.state.playlist.length);
      } while (nextIndex === this.state.currentIndex && this.state.playlist.length > 1);
      this.state.currentIndex = nextIndex;
    } else {
      this.state.currentIndex = (this.state.currentIndex + 1) % this.state.playlist.length;
    }

    const track = this.state.playlist[this.state.currentIndex];
    if (track) this.loadAndPlay(track.url);
  }

  getState(): AudioChannelState {
    return { ...this.state };
  }
}

// ============================================================================
//                              全局音频管理器
// ============================================================================

class AudioManager {
  private bgm: AudioChannel;
  private ambient: AudioChannel;

  constructor() {
    this.bgm = new AudioChannel("bgm");
    this.ambient = new AudioChannel("ambient");
  }

  getChannel(type: "bgm" | "ambient"): AudioChannel {
    return type === "bgm" ? this.bgm : this.ambient;
  }

  // ─── 便捷方法 ───

  playAudio(type: "bgm" | "ambient", audio?: AudioTrack): void {
    this.getChannel(type).play(audio);
  }

  pauseAudio(type: "bgm" | "ambient"): void {
    this.getChannel(type).pause();
  }

  stopAudio(type: "bgm" | "ambient"): void {
    this.getChannel(type).stop();
  }

  getAudioList(type: "bgm" | "ambient"): AudioTrack[] {
    return this.getChannel(type).getPlaylist();
  }

  replaceAudioList(type: "bgm" | "ambient", list: AudioTrack[]): void {
    this.getChannel(type).setPlaylist(list);
  }

  appendAudioList(type: "bgm" | "ambient", list: AudioTrack[]): void {
    this.getChannel(type).appendPlaylist(list);
  }

  getAudioSettings(type: "bgm" | "ambient"): AudioSettings {
    return this.getChannel(type).getSettings();
  }

  setAudioSettings(type: "bgm" | "ambient", settings: Partial<AudioSettings>): void {
    this.getChannel(type).setSettings(settings);
  }

  // ─── 全局控制 ───

  setGlobalVolume(volume: number): void {
    Howler.volume(Math.max(0, Math.min(1, volume)));
  }

  muteAll(muted: boolean): void {
    Howler.mute(muted);
  }
}

// ============================================================================
//                              单例导出
// ============================================================================

let audioManager: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  return audioManager;
}

export { AudioChannel, AudioManager };
