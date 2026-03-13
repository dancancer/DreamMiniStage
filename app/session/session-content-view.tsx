/**
 * @input  react
 * @output SessionContentView
 * @pos    /session 主视图切换器
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      Session Content View Router                         ║
 * ║                                                                           ║
 * ║  收口 `/session` 的主视图切换，让内容页不再直接堆叠多段条件渲染。             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";

interface Props {
  characterView: "chat" | "worldbook" | "preset" | "regex";
  chatView: React.ReactNode;
  worldbookView: React.ReactNode;
  presetView: React.ReactNode;
  regexView: React.ReactNode;
  loginModal: React.ReactNode;
  dialogueTreeModal: React.ReactNode;
}

export default function SessionContentView({
  characterView,
  chatView,
  worldbookView,
  presetView,
  regexView,
  loginModal,
  dialogueTreeModal,
}: Props) {
  const mainView = characterView === "chat"
    ? chatView
    : characterView === "worldbook"
      ? worldbookView
      : characterView === "preset"
        ? presetView
        : regexView;

  return (
    <div className="flex h-full relative overflow-hidden">
      <div className="flex-1 h-full flex flex-col min-w-0">
        {mainView}
      </div>
      {loginModal}
      {dialogueTreeModal}
    </div>
  );
}
