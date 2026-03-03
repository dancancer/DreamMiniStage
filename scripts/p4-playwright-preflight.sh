#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# P4 Playwright MCP 前置清理脚本
# 目标：清理 mcp-chrome / Playwright 残留进程，降低 profile 抢占导致的假失败。
# ============================================================================

readonly PROCESS_PATTERN="mcp-chrome|playwright.*chrome|chromium.*remote-debugging-port"

log() {
  printf "[p4-preflight] %s\n" "$1"
}

pids=$(pgrep -f "${PROCESS_PATTERN}" || true)

if [[ -z "${pids}" ]]; then
  log "未发现残留浏览器进程，跳过清理。"
  exit 0
fi

log "发现残留进程：$(echo "${pids}" | tr "\n" " ")"
log "发送 SIGTERM ..."
# shellcheck disable=SC2086
kill -TERM ${pids} || true
sleep 1

alive_pids=$(pgrep -f "${PROCESS_PATTERN}" || true)
if [[ -n "${alive_pids}" ]]; then
  log "仍有进程存活，发送 SIGKILL：$(echo "${alive_pids}" | tr "\n" " ")"
  # shellcheck disable=SC2086
  kill -KILL ${alive_pids} || true
fi

log "清理完成。"
