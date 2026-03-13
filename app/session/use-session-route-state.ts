/**
 * @input  react, lib/store/session-store
 * @output useSessionRouteState
 * @pos    /session 路由级会话解析
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Route State                                 ║
 * ║                                                                           ║
 * ║  解析 sessionId 对应的 characterId / 错误态，隔离内容页的路由加载逻辑。      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/lib/store/session-store";

export function useSessionRouteState(
  sessionId: string | null,
  t: (key: string) => string,
) {
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const fetchAllSessions = useSessionStore((state) => state.fetchAllSessions);
  const sessions = useSessionStore((state) => state.sessions);
  const isSessionsLoading = useSessionStore((state) => state.isLoading);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) {
        return;
      }

      if (!hasTriedFetch && sessions.length === 0) {
        setHasTriedFetch(true);
        await fetchAllSessions();
        return;
      }

      if (isSessionsLoading) {
        return;
      }

      const session = getSessionById(sessionId);
      if (session) {
        setCharacterId(session.characterId);
        setSessionError(null);
        return;
      }

      if (hasTriedFetch) {
        setSessionError(t("characterChat.sessionNotFound") || "Session not found");
      }
    };

    void loadSession();
  }, [sessionId, sessions, isSessionsLoading, hasTriedFetch, getSessionById, fetchAllSessions, t]);

  return {
    characterId,
    sessionError,
  };
}
