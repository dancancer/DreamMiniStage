/**
 * @input  @/lib
 * @output ScriptButtonPanel
 * @pos    脚本按钮面板
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

"use client";

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Button Panel                               ║
 * ║                                                                           ║
 * ║  渲染脚本注册的交互按钮                                                     ║
 * ║  点击按钮触发 DreamMiniStage:scriptButton:click 事件                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useEffect, useState } from "react";
import { getScriptButtons, type ScriptButton, type ScriptContext } from "@/lib/script-runner/script-storage";

interface ScriptButtonPanelProps {
  characterId?: string;
  presetId?: string;
  className?: string;
}

export function ScriptButtonPanel({ characterId, presetId, className }: ScriptButtonPanelProps) {
  const [buttons, setButtons] = useState<ScriptButton[]>([]);

  useEffect(() => {
    const ctx: ScriptContext = { characterId, presetId };
    setButtons(getScriptButtons(ctx));

    // 监听按钮更新事件
    const handleUpdate = () => {
      setButtons(getScriptButtons(ctx));
    };

    window.addEventListener("DreamMiniStage:scriptButtons:update", handleUpdate);
    return () => {
      window.removeEventListener("DreamMiniStage:scriptButtons:update", handleUpdate);
    };
  }, [characterId, presetId]);

  if (buttons.length === 0) return null;

  const handleClick = (button: ScriptButton) => {
    window.dispatchEvent(
      new CustomEvent("DreamMiniStage:scriptButton:click", {
        detail: {
          buttonId: button.id,
          scriptId: button.scriptId,
          label: button.label,
        },
      }),
    );
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className || ""}`}>
      {buttons.map((button) => (
        <button
          key={button.id}
          onClick={() => handleClick(button)}
          className="px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          title={button.label}
        >
          {button.icon && <span className="mr-1">{button.icon}</span>}
          {button.label}
        </button>
      ))}
    </div>
  );
}
