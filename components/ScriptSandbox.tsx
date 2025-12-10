/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         ScriptSandbox 组件                                 ║
 * ║                                                                            ║
 * ║  职责：在 iframe 沙箱中安全执行用户脚本                                     ║
 * ║  设计：独立组件，可复用、可测试，生命周期由 React 管理                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useRef, useEffect, useCallback, useState, memo, useLayoutEffect } from "react";
import type { ScriptMessageData } from "@/types/script-message";
import { clearIframeListeners } from "@/hooks/script-bridge";

// API Shim 脚本标签（实际代码位于 public/iframe-libs/slash-runner-shim.js）
const SLASH_RUNNER_API_SHIM = "<script src=\"/iframe-libs/slash-runner-shim.js\"></script>";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface ScriptSandboxProps {
  id: string;
  html: string;
  variables?: Record<string, unknown>;
  onMessage?: (data: ScriptMessageData) => Promise<unknown> | unknown;
  onHeightChange?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export const ScriptSandbox = memo(function ScriptSandbox({
  id,
  html,
  variables,
  onMessage,
  onHeightChange,
}: ScriptSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  const lastHeightRef = useRef(240);
  const heightChangedRef = useRef(false);
  const onHeightChangeRef = useRef(onHeightChange);

  // 保持回调引用最新，避免依赖数组变化
  onHeightChangeRef.current = onHeightChange;

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  构建 srcdoc：注入 API shim + 透明背景样式                         ║
  // ╚══════════════════════════════════════════════════════════════════╝
  const srcdoc = buildSrcdoc(html);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  消息处理：只处理来自当前 iframe 的消息                            ║
  // ╚══════════════════════════════════════════════════════════════════╝
  const handleMessage = useCallback(
    async (e: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow) return;

      const { type, id: msgId, payload } = e.data || {};

      // API 调用
      if (type === "API_CALL" && onMessage && msgId) {
        const method = payload?.method;
        console.log("[ScriptSandbox] 收到 API_CALL:", method, "id:", msgId, "payload:", payload);
        try {
          const result = await onMessage(e.data);
          console.log("[ScriptSandbox] API_CALL 处理完成:", method, "id:", msgId, "result:", result);
          iframe.contentWindow?.postMessage(
            { type: "API_RESPONSE", id: msgId, payload: { result } },
            "*",
          );
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.error("[ScriptSandbox] API_CALL 处理失败:", method, "id:", msgId, "error:", error);
          iframe.contentWindow?.postMessage(
            { type: "API_RESPONSE", id: msgId, payload: { error } },
            "*",
          );
        }
      }

      // 高度更新（去重：避免循环触发）
      if (type === "HEIGHT_UPDATE" && payload?.height) {
        const newHeight = Math.min(Math.max(payload.height + 10, 240), 1600);
        if (Math.abs(lastHeightRef.current - newHeight) < 5) return;
        lastHeightRef.current = newHeight;
        heightChangedRef.current = true;
        setHeight(newHeight);
      }

      // 事件透传
      if (type === "EVENT_EMIT" && onMessage) {
        onMessage(e.data);
      }

      // 控制台日志
      if (type === "CONSOLE_LOG" && onMessage) {
        onMessage(e.data);
      }
    },
    [onMessage],
  );

  // 高度变化后通知父组件（仅在真正变化时触发，跳过初始渲染）
  useLayoutEffect(() => {
    if (!heightChangedRef.current) return;
    heightChangedRef.current = false;
    onHeightChangeRef.current?.();
  }, [height]);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  变量同步：向 iframe 发送变量更新                                  ║
  // ╚══════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !variables) return;

    iframe.contentWindow.postMessage(
      { type: "UPDATE_VARIABLES", payload: variables },
      "*",
    );
  }, [variables]);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  全局广播事件监听                                                  ║
  // ╚══════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    const handleBroadcast = (e: CustomEvent) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      iframe.contentWindow.postMessage(
        { type: "EVENT_EMIT", payload: e.detail },
        "*",
      );
    };

    window.addEventListener(
      "DreamMiniStage:broadcast",
      handleBroadcast as EventListener,
    );
    return () => {
      window.removeEventListener(
        "DreamMiniStage:broadcast",
        handleBroadcast as EventListener,
      );
    };
  }, []);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  消息监听生命周期                                                  ║
  // ╚══════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  iframe 销毁时清理事件监听器                                       ║
  // ╚══════════════════════════════════════════════════════════════════╝
  useEffect(() => {
    const sandboxId = id;
    return () => {
      clearIframeListeners(sandboxId);
    };
  }, [id]);

  return (
    <div className="slash-runner-embed my-3 rounded-lg overflow-hidden border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-canvas)_35%,transparent)]">
      <iframe
        ref={iframeRef}
        data-sandbox-id={id}
        srcDoc={srcdoc}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        className="block w-full border-0 bg-transparent"
        style={{ height: `${height}px`, background: "transparent" }}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

function buildSrcdoc(html: string): string {
  const withTransparentBg = injectTransparentBackground(html);
  // React 的 srcDoc 属性会自动处理转义，无需手动 escape
  return SLASH_RUNNER_API_SHIM + withTransparentBg;
}

function injectTransparentBackground(html: string): string {
  const style = `
    <style>
      :root, html, body {
        background: transparent !important;
        background-color: transparent !important;
        color-scheme: dark;
      }
      :root::before, :root::after,
      html::before, html::after,
      body::before, body::after {
        background: transparent !important;
      }
    </style>
  `;

  // 尝试在 <head> 后插入
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    return html.replace(headMatch[0], headMatch[0] + style);
  }

  // 尝试在 <html> 后插入
  const htmlMatch = /<html[^>]*>/i.exec(html);
  if (htmlMatch) {
    return html.replace(htmlMatch[0], htmlMatch[0] + style);
  }

  // 兜底：直接前置
  return style + html;
}

