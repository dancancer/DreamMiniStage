/**
 * @input  react
 * @output createSessionChatActions
 * @pos    /session chat 提交动作
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

export function createSessionChatActions(input: {
  executeSessionSlashInput: (script: string) => Promise<string>;
  handleSendMessage: (message: string) => Promise<void>;
  setUserInput: (text: string) => void;
  t: (key: string) => string;
  isSending: boolean;
  activeModes: Record<string, unknown>;
  onError?: (message: string) => void;
}) {
  return {
    handleExecuteQuickReplyPanel: async (index: number): Promise<void> => {
      try {
        await input.executeSessionSlashInput(`/qr ${index}`);
      } catch (error) {
        input.onError?.(error instanceof Error ? error.message : String(error));
      }
    },
    handleSubmit: async (e: React.FormEvent, userInput: string): Promise<void> => {
      e.preventDefault();
      const inputText = userInput;
      const trimmedInput = inputText.trim();
      if (!trimmedInput || input.isSending) return;
      input.setUserInput("");

      if (trimmedInput.startsWith("/")) {
        try {
          await input.executeSessionSlashInput(trimmedInput);
        } catch (error) {
          input.onError?.(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      const hints: string[] = [];
      if (input.activeModes["story-progress"]) {
        hints.push(input.t("characterChat.storyProgressHint"));
      }
      const perspective = input.activeModes["perspective"] as { active?: boolean; mode?: string } | undefined;
      if (perspective?.active) {
        const hintKey = perspective.mode === "novel"
          ? "characterChat.novelPerspectiveHint"
          : "characterChat.protagonistPerspectiveHint";
        hints.push(input.t(hintKey));
      }
      if (input.activeModes["scene-setting"]) {
        hints.push(input.t("characterChat.sceneTransitionHint"));
      }

      const message = hints.length > 0
        ? `
      <input_message>
      ${input.t("characterChat.playerInput")}：${inputText}
      </input_message>
      <response_instructions>
      ${input.t("characterChat.responseInstructions")}：${hints.join(" ")}
      </response_instructions>
        `.trim()
        : `
      <input_message>
      ${input.t("characterChat.playerInput")}：${inputText}
      </input_message>
        `.trim();

      await input.handleSendMessage(message);
    },
  };
}
