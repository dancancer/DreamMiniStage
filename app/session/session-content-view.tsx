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
    <>
      <main className="relative flex h-full flex-1 overflow-hidden" aria-label="会话主内容">
        <div className="flex h-full min-w-0 flex-1 flex-col">
          {mainView}
        </div>
      </main>
      {loginModal}
      {dialogueTreeModal}
    </>
  );
}
