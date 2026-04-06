import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CLOCK_TOKEN, type ClockFn } from '../common/tokens/clock.token';
import { type ISessionRepository, SESSION_REPOSITORY } from './session.repository.interface';
import { Session, Turn } from '../common/types/chat.types';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class SessionService {
  constructor(
    @Inject(CLOCK_TOKEN) private readonly clock: ClockFn,
    @Inject(SESSION_REPOSITORY) private readonly repository: ISessionRepository,
  ) {}

  async createSession(): Promise<string> {
    const id = randomUUID();
    const session: Session = { id, turns: [], lastActivity: this.clock() };
    await this.repository.save(session);
    return id;
  }

  async getSession(id: string): Promise<Session> {
    const session = await this.repository.findById(id);

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    if (this.clock() - session.lastActivity > SESSION_TTL_MS) {
      await this.repository.delete(id);
      throw new GoneException(`Session ${id} has expired`);
    }

    return session;
  }

  async addTurn(sessionId: string, turn: Turn): Promise<void> {
    const session = await this.getSession(sessionId);
    session.turns.push(turn);
    session.lastActivity = this.clock();
    await this.repository.save(session);
  }

  async deleteSession(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Session ${id} not found`);
    }
  }

  async getTurns(sessionId: string): Promise<Turn[]> {
    const session = await this.getSession(sessionId);
    return session.turns;
  }
}
