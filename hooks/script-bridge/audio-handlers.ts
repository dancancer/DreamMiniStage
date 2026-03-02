/**
 * @input  hooks/script-bridge/types, lib/audio/store
 * @output audioHandlers
 * @pos    音频 API Handlers - JS-Slash-Runner 兼容的 BGM/Ambient 音频控制
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Audio Handlers                                     ║
 * ║                                                                            ║
 * ║  实现 JS-Slash-Runner 兼容的音频 API                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { ApiHandlerMap, ApiCallContext } from "./types";
import {
  getAudioManager,
  type AudioTrack,
  type AudioSettings,
  type AudioMode,
} from "@/lib/audio/store";

// ============================================================================
//                              Handler 实现
// ============================================================================

export const audioHandlers: ApiHandlerMap = {
  /**
   * playAudio - 播放音频
   */
  "playAudio": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, audio] = args as ["bgm" | "ambient", AudioTrack?];
    getAudioManager().playAudio(type, audio);
  },

  /**
   * pauseAudio - 暂停音频
   */
  "pauseAudio": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type] = args as ["bgm" | "ambient"];
    getAudioManager().pauseAudio(type);
  },

  /**
   * stopAudio - 停止音频
   */
  "stopAudio": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type] = args as ["bgm" | "ambient"];
    getAudioManager().stopAudio(type);
  },

  /**
   * getAudioList - 获取播放列表
   */
  "getAudioList": (args: unknown[], _ctx: ApiCallContext): AudioTrack[] => {
    const [type] = args as ["bgm" | "ambient"];
    return getAudioManager().getAudioList(type);
  },

  /**
   * replaceAudioList - 替换播放列表
   */
  "replaceAudioList": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, list] = args as ["bgm" | "ambient", AudioTrack[]];
    getAudioManager().replaceAudioList(type, list);
  },

  /**
   * appendAudioList - 追加到播放列表
   */
  "appendAudioList": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, list] = args as ["bgm" | "ambient", AudioTrack[]];
    getAudioManager().appendAudioList(type, list);
  },

  /**
   * getAudioSettings - 获取音频设置
   */
  "getAudioSettings": (args: unknown[], _ctx: ApiCallContext): AudioSettings => {
    const [type] = args as ["bgm" | "ambient"];
    return getAudioManager().getAudioSettings(type);
  },

  /**
   * setAudioSettings - 设置音频参数
   */
  "setAudioSettings": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, settings] = args as ["bgm" | "ambient", Partial<AudioSettings>];
    getAudioManager().setAudioSettings(type, settings);
  },

  /**
   * setAudioEnabled - 启用/禁用音频通道
   */
  "setAudioEnabled": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, enabled] = args as ["bgm" | "ambient", boolean];
    getAudioManager().getChannel(type).setEnabled(enabled);
  },

  /**
   * setAudioMode - 设置播放模式
   */
  "setAudioMode": (args: unknown[], _ctx: ApiCallContext): void => {
    const [type, mode] = args as ["bgm" | "ambient", AudioMode];
    getAudioManager().getChannel(type).setMode(mode);
  },

  /**
   * setGlobalVolume - 设置全局音量
   */
  "setGlobalVolume": (args: unknown[], _ctx: ApiCallContext): void => {
    const [volume] = args as [number];
    getAudioManager().setGlobalVolume(volume);
  },

  /**
   * muteAll - 全局静音
   */
  "muteAll": (args: unknown[], _ctx: ApiCallContext): void => {
    const [muted] = args as [boolean];
    getAudioManager().muteAll(muted);
  },
};
