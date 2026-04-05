import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ChatService, type SendMessageResult } from './chat.service';
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
  ): Promise<SendMessageResult> {
    return this.chatService.sendMessage(sessionId, dto.message);
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
