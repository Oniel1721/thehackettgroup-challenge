export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  turns: Turn[];
  lastActivity: number;
}
