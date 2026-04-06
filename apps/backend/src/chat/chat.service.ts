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

  async *streamMessage(
    sessionId: string,
    message: string,
  ): AsyncIterable<string> {
    const history = await this.sessionService.getTurns(sessionId);
    yield* this.llmService.streamReply(history, message);
  }

  async commitReply(
    sessionId: string,
    userMessage: string,
    reply: string,
  ): Promise<number> {
    const now = Date.now();
    const userTurn: Turn = { role: 'user', content: userMessage, timestamp: now };
    await this.sessionService.addTurn(sessionId, userTurn);

    const assistantTurn: Turn = {
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    };
    await this.sessionService.addTurn(sessionId, assistantTurn);

    const turns = await this.sessionService.getTurns(sessionId);
    return Math.floor(turns.length / 2) - 1;
  }

  async getHistory(sessionId: string): Promise<{ turns: Turn[] }> {
    return { turns: await this.sessionService.getTurns(sessionId) };
  }
}
