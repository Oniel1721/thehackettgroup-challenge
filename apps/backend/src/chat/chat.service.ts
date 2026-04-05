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

  /**
   * Yields token chunks from the LLM.
   * Stores the user turn immediately; the assistant turn is stored only
   * after the caller has consumed the full stream and calls commitReply().
   */
  async *streamMessage(
    sessionId: string,
    message: string,
  ): AsyncIterable<string> {
    const history = this.sessionService.getTurns(sessionId);
    yield* this.llmService.streamReply(history, message);
  }

  /**
   * Persists both the user message and the completed assistant reply.
   * Must be called after the stream has been fully consumed without errors.
   */
  commitReply(sessionId: string, userMessage: string, reply: string): number {
    const now = Date.now();
    const userTurn: Turn = { role: 'user', content: userMessage, timestamp: now };
    this.sessionService.addTurn(sessionId, userTurn);

    const assistantTurn: Turn = {
      role: 'assistant',
      content: reply,
      timestamp: Date.now(),
    };
    this.sessionService.addTurn(sessionId, assistantTurn);

    const turns = this.sessionService.getTurns(sessionId);
    return Math.floor(turns.length / 2) - 1;
  }

  getHistory(sessionId: string): { turns: Turn[] } {
    return { turns: this.sessionService.getTurns(sessionId) };
  }
}
