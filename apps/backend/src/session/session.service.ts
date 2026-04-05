import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CLOCK_TOKEN, type ClockFn } from '../common/tokens/clock.token';
import { Session, Turn } from '../common/types/chat.types';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, Session>();

  constructor(@Inject(CLOCK_TOKEN) private readonly clock: ClockFn) {}

  createSession(): string {
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      turns: [],
      lastActivity: this.clock(),
    });
    return id;
  }

  getSession(id: string): Session {
    const session = this.sessions.get(id);

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    if (this.clock() - session.lastActivity > SESSION_TTL_MS) {
      this.sessions.delete(id);
      throw new GoneException(`Session ${id} has expired`);
    }

    return session;
  }

  addTurn(sessionId: string, turn: Turn): void {
    const session = this.getSession(sessionId);
    session.turns.push(turn);
    session.lastActivity = this.clock();
  }

  deleteSession(id: string): void {
    if (!this.sessions.has(id)) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    this.sessions.delete(id);
  }

  getTurns(sessionId: string): Turn[] {
    return this.getSession(sessionId).turns;
  }
}
