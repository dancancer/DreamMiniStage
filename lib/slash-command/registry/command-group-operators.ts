/**
 * @input  lib/slash-command/registry/handlers/*
 * @output OPERATOR_COMMAND_ENTRIES
 * @pos    算子与 JS-Slash-Runner 命令
 * @update 一旦我被更新，务必更新所属 README 与 PRD slash command 附录。
 */

import type { CommandEntry } from "./types";
import * as OperatorHandlers from "./handlers/operators";
import * as JSSlashRunnerHandlers from "./handlers/js-slash-runner";

export const OPERATOR_COMMAND_ENTRIES: CommandEntry[] = [
  ["add", OperatorHandlers.handleAdd],
  ["sub", OperatorHandlers.handleSub],
  ["mul", OperatorHandlers.handleMul],
  ["div", OperatorHandlers.handleDiv],
  ["mod", OperatorHandlers.handleMod],
  ["pow", OperatorHandlers.handlePow],
  ["max", OperatorHandlers.handleMax],
  ["min", OperatorHandlers.handleMin],
  ["rand", OperatorHandlers.handleRand],
  ["sin", OperatorHandlers.handleSin],
  ["cos", OperatorHandlers.handleCos],
  ["log", OperatorHandlers.handleLog],
  ["abs", OperatorHandlers.handleAbs],
  ["sqrt", OperatorHandlers.handleSqrt],
  ["round", OperatorHandlers.handleRound],
  ["len", OperatorHandlers.handleLen],
  ["length", OperatorHandlers.handleLen],
  ["trim", OperatorHandlers.handleTrim],
  ["split", OperatorHandlers.handleSplit],
  ["join", OperatorHandlers.handleJoin],
  ["replace", OperatorHandlers.handleReplace],
  ["re", OperatorHandlers.handleReplace],
  ["match", OperatorHandlers.handleMatch],
  ["test", OperatorHandlers.handleTest],
  ["event-emit", JSSlashRunnerHandlers.handleEventEmit],
  ["eventemit", JSSlashRunnerHandlers.handleEventEmit],
  ["audioenable", JSSlashRunnerHandlers.handleAudioEnable],
  ["audioplay", JSSlashRunnerHandlers.handleAudioPlay],
  ["audioplaypause", JSSlashRunnerHandlers.handleAudioPlayPause],
  ["audioimport", JSSlashRunnerHandlers.handleAudioImport],
  ["audioselect", JSSlashRunnerHandlers.handleAudioSelect],
  ["audiomode", JSSlashRunnerHandlers.handleAudioMode],
  ["audiopause", JSSlashRunnerHandlers.handleAudioPause],
  ["audioresume", JSSlashRunnerHandlers.handleAudioResume],
  ["audiostop", JSSlashRunnerHandlers.handleAudioStop],
  ["audiovolume", JSSlashRunnerHandlers.handleAudioVolume],
  ["audioqueue", JSSlashRunnerHandlers.handleAudioQueue],
  ["audioclear", JSSlashRunnerHandlers.handleAudioClear],
];
