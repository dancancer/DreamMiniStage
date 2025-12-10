/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialogueFlowStyles                                   ║
 * ║                                                                            ║
 * ║  对话树 ReactFlow 自定义样式：边动画、节点过渡、路径高亮                      ║
 * ║  从 DialogueTreeModal.tsx 提取的样式组件                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

export function DialogueFlowStyles() {
  return (
    <style jsx global>{`
      .react-flow__node {
        transition: all 0.3s ease !important;
      }

      .react-flow__edge path {
        stroke-dasharray: none;
        animation: none;
      }

      .react-flow__edge.root-source path {
        stroke-dasharray: 10, 5 !important;
        animation: flowLineRoot 1.5s linear infinite !important;
        filter: none !important;
      }

      .react-flow__edge.current-path path {
        stroke-dasharray: 8, 4 !important;
        animation: flowLineCurrent 1.8s linear infinite !important;
        filter: none !important;
      }

      .react-flow__edge.other-path path {
        stroke-dasharray: 6, 4 !important;
        animation: flowLineOther 2s linear infinite !important;
        opacity: 0.8 !important;
      }

      @keyframes flowLineRoot {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -45; }
      }

      @keyframes flowLineCurrent {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -40; }
      }

      @keyframes flowLineOther {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -30; }
      }
    `}</style>
  );
}
