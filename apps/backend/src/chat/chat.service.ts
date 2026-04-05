import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { Turn } from '../common/types/chat.types';

export interface SendMessageResult {
  reply: string;
  turnIndex: number;
}

@Injectable()
export class ChatService {
  constructor(private readonly sessionService: SessionService) {}

  sendMessage(sessionId: string, message: string): SendMessageResult {
    // Store user turn
    const userTurn: Turn = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    this.sessionService.addTurn(sessionId, userTurn);

    // Stub reply — will be replaced by LlmService in Phase 3
    const reply = `Echo: ${message}`;

    const assistantTurn: Turn = {
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    };
    this.sessionService.addTurn(sessionId, assistantTurn);

    const turns = this.sessionService.getTurns(sessionId);
    const turnIndex = Math.floor(turns.length / 2) - 1;

    return { reply, turnIndex };
  }

  getHistory(sessionId: string): { turns: Turn[] } {
    return { turns: this.sessionService.getTurns(sessionId) };
  }
}
