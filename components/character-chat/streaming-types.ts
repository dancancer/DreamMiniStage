export interface ChatStreamingIntent {
  enabled: boolean;
  targetIndex: number;
  isSending: boolean;
  activeMessageId: string | null;
}
