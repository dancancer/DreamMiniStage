/**
 * @input  react, hooks/script-bridge/host-debug-state
 * @output useSessionHostDebug
 * @pos    /session 共享 host-debug 控制器
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import { useCallback, useRef, useState } from "react";
import {
  createHostDebugState,
  readHostDebugSnapshot,
} from "@/hooks/script-bridge/host-debug-state";

export function useSessionHostDebug() {
  const hostDebugStateRef = useRef(createHostDebugState());
  const [hostDebug, setHostDebug] = useState(() => readHostDebugSnapshot(hostDebugStateRef.current));

  const syncHostDebug = useCallback(() => {
    setHostDebug(readHostDebugSnapshot(hostDebugStateRef.current));
  }, []);

  return {
    hostDebugState: hostDebugStateRef.current,
    hostDebug,
    syncHostDebug,
  };
}
