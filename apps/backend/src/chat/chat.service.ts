import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { LlmService } from '../llm/llm.service';
import { Turn } from '../common/types/chat.types';

export interface SendMessageResult {
  reply: string;
  turnIndex: number;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly llmService: LlmService,
  ) {}

  async sendMessage(
    sessionId: string,
    message: string,
  ): Promise<SendMessageResult> {
    const historyBeforeReply = this.sessionService.getTurns(sessionId);

    // Store user turn first
    const userTurn: Turn = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    this.sessionService.addTurn(sessionId, userTurn);

    // Call Gemini with the history prior to this message
    const reply = await this.llmService.generateReply(
      historyBeforeReply,
      message,
    );

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
