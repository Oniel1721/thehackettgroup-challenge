export interface UserMessage {
  id: string;
  role: "user";
  content: string;
  timestamp: number;
}

export interface BotMessage {
  id: string;
  role: "assistant";
  content: string;
  timestamp: number;
}

export type Message = UserMessage | BotMessage;

export interface Session {
  sessionId: string;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface HistoryResponse {
  turns: Turn[];
}

export interface SendMessageResponse {
  reply: string;
  turnIndex: number;
}
