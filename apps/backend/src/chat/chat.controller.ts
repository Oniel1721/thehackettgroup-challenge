import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { Turn } from '../common/types/chat.types';
import { SessionService } from '../session/session.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('session')
  @HttpCode(201)
  createSession(): { sessionId: string } {
    const sessionId = this.sessionService.createSession();
    return { sessionId };
  }

  @Post(':sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullReply = '';

    try {
      for await (const token of this.chatService.streamMessage(
        sessionId,
        dto.message,
      )) {
        fullReply += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // Store the assistant reply only after the stream is complete
      const turnIndex = this.chatService.commitReply(sessionId, dto.message, fullReply);
      res.write(`data: ${JSON.stringify({ done: true, turnIndex })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'LLM unavailable' })}\n\n`);
    }

    res.end();
  }

  @Get(':sessionId/history')
  getHistory(@Param('sessionId') sessionId: string): { turns: Turn[] } {
    return this.chatService.getHistory(sessionId);
  }

  @Delete(':sessionId')
  @HttpCode(204)
  deleteSession(@Param('sessionId') sessionId: string): void {
    this.sessionService.deleteSession(sessionId);
  }
}
